import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { peopleForGymPage, peopleInGym } from '../data/mock'
import { ApiError, apiFetchGymPeople } from '../lib/apiClient'
import { isDemoAccount } from '../lib/demoAccount'
import { isPresentInGym } from '../lib/presence'
import type { AppUser, UserProfile } from '../types'

type Options = {
  gymId: string
  user: AppUser | null
  apiOnline: boolean
  /** Home floor vs gym detail page seed rules */
  mode: 'floor' | 'gymPage'
  blockedUserIds: string[]
}

const LOADER_DELAY_MS = 1000
/** Quiet refresh while the floor/detail stays open */
const POLL_MS = 45_000
const PEOPLE_PAGE = 80

function withSelfOnFloor(list: UserProfile[], user: AppUser, gymId: string) {
  if (!user.gymIds.includes(gymId)) return list
  if (list.some((p) => p.id === user.id)) {
    return list.map((p) =>
      p.id === user.id ? { ...p, ...user, isActive: isPresentInGym(user, gymId) } : p,
    )
  }
  return [{ ...user, isActive: isPresentInGym(user, gymId) }, ...list]
}

/**
 * When API is online — members from Postgres.
 * Demo / offline — local mock helpers (dev only for offline).
 *
 * Check-in / check-out does NOT refetch: own status is merged from `user` locally
 * so the floor list does not blink. Background poll refreshes others’ presence.
 */
export function useGymPeople({ gymId, user, apiOnline, mode, blockedUserIds }: Options) {
  const [remote, setRemote] = useState<UserProfile[] | null>(null)
  const [loading, setLoading] = useState(() =>
    Boolean(gymId && user && apiOnline && !isDemoAccount(user.email)),
  )
  const [showLoader, setShowLoader] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryTick, setRetryTick] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  /** Last successful fetch key — avoid wiping list on presence-only updates */
  const loadedKeyRef = useRef<string | null>(null)
  const lastGoodKeyRef = useRef<string | null>(null)
  const fetchKeyRef = useRef('')
  const inFlightRef = useRef(false)
  const loadedCountRef = useRef(0)

  const demo = Boolean(user && isDemoAccount(user.email))
  const useApi = Boolean(gymId && user && apiOnline && !demo)
  const gymIdsKey = user?.gymIds?.join(',') ?? ''
  const fetchKey = useApi && user ? `${user.id}:${gymId}:${gymIdsKey}` : ''
  fetchKeyRef.current = fetchKey

  const load = useCallback(
    async (opts: { quiet?: boolean; force?: boolean }) => {
      const key = fetchKeyRef.current
      if (!useApi || !gymId || !key) return
      if (!opts.force && loadedKeyRef.current === key && !opts.quiet) return
      if (inFlightRef.current) return

      const keepPrevious = lastGoodKeyRef.current === key
      const quiet = Boolean(opts.quiet && keepPrevious)

      inFlightRef.current = true
      if (!quiet) {
        if (!keepPrevious) setRemote(null)
        setLoading(true)
        setError(null)
      }

      try {
        const take = opts.quiet
          ? Math.min(240, Math.max(PEOPLE_PAGE, loadedCountRef.current || PEOPLE_PAGE))
          : PEOPLE_PAGE
        const page = await apiFetchGymPeople(gymId, { limit: take, offset: 0 })
        if (fetchKeyRef.current !== key) return
        setRemote(page.people)
        loadedCountRef.current = page.people.length
        setHasMore(page.hasMore)
        loadedKeyRef.current = key
        lastGoodKeyRef.current = key
        setError(null)
      } catch (err) {
        if (fetchKeyRef.current !== key) return
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Не удалось загрузить людей'
        if (!quiet) {
          setError(message)
          if (!keepPrevious) setRemote(null)
        }
      } finally {
        inFlightRef.current = false
        if (!quiet) setLoading(false)
      }
    },
    [useApi, gymId],
  )

  const retry = useCallback(() => {
    loadedKeyRef.current = null
    setRetryTick((n) => n + 1)
  }, [])

  const loadMore = useCallback(async () => {
    const key = fetchKeyRef.current
    if (!useApi || !gymId || !key || !hasMore || loadingMore || inFlightRef.current) return
    const offset = remote?.length ?? 0
    if (!offset) return
    setLoadingMore(true)
    try {
      const page = await apiFetchGymPeople(gymId, { limit: PEOPLE_PAGE, offset })
      if (fetchKeyRef.current !== key) return
      setRemote((prev) => {
        const cur = prev || []
        const seen = new Set(cur.map((p) => p.id))
        const next = [...cur, ...page.people.filter((p) => !seen.has(p.id))]
        loadedCountRef.current = next.length
        return next
      })
      setHasMore(page.hasMore)
    } catch {
      /* keep current page */
    } finally {
      setLoadingMore(false)
    }
  }, [useApi, gymId, hasMore, loadingMore, remote?.length])

  useEffect(() => {
    if (!useApi || !gymId || !fetchKey) {
      setRemote(null)
      setLoading(false)
      setError(null)
      setHasMore(false)
      loadedKeyRef.current = null
      lastGoodKeyRef.current = null
      loadedCountRef.current = 0
      return
    }

    void load({ force: true })
  }, [useApi, gymId, fetchKey, retryTick, load])

  // Background presence refresh while tab is visible
  useEffect(() => {
    if (!useApi || !gymId || !fetchKey) return

    const tick = () => {
      if (document.visibilityState === 'hidden') return
      void load({ quiet: true, force: true })
    }

    const id = window.setInterval(tick, POLL_MS)
    const onVis = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [useApi, gymId, fetchKey, load])

  // Лоадер только если ответ дольше 1 с — быстрые ответы без мигания
  useEffect(() => {
    if (!loading) {
      setShowLoader(false)
      return
    }
    const id = window.setTimeout(() => setShowLoader(true), LOADER_DELAY_MS)
    return () => window.clearTimeout(id)
  }, [loading])

  const people = useMemo(() => {
    if (!gymId || !user) return []

    let list: UserProfile[]
    if (useApi) {
      if (remote === null) {
        // Ждём API или ошибка без кэша — только себя, без демо-мока чужого зала
        list = user.gymIds.includes(gymId)
          ? [{ ...user, isActive: isPresentInGym(user, gymId) }]
          : []
      } else {
        list = remote.map((p) => {
          const merged = p.id === user.id ? { ...p, ...user } : p
          return { ...merged, isActive: isPresentInGym(merged, gymId) }
        })
        list = withSelfOnFloor(list, user, gymId)
      }
    } else if (demo) {
      // Seed faces only for the demo account — never for real users offline
      list =
        mode === 'gymPage'
          ? peopleForGymPage(gymId, user, { includeSeedPeople: true })
          : peopleInGym(gymId, user, { includeSeedPeople: true })
    } else {
      // API offline / not ready: self only, no mock strangers
      list = user.gymIds.includes(gymId)
        ? [{ ...user, isActive: isPresentInGym(user, gymId) }]
        : []
    }

    if (blockedUserIds.length) {
      list = list.filter((p) => !blockedUserIds.includes(p.id))
    }
    return list
  }, [gymId, user, useApi, remote, mode, demo, blockedUserIds])

  return {
    people,
    loading,
    /** true только после 1 с ожидания ответа API */
    showLoader,
    fromApi: Boolean(useApi && remote !== null),
    /** Set when people fetch failed (may still show last good list) */
    error,
    retry,
    hasMore: Boolean(useApi && hasMore),
    loadingMore,
    loadMore,
  }
}
