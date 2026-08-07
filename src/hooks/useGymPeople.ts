import { useEffect, useMemo, useRef, useState } from 'react'
import { peopleForGymPage, peopleInGym } from '../data/mock'
import { apiFetchGymPeople } from '../lib/apiClient'
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
 * so the floor list does not blink. Full reload runs on gym / account change.
 */
export function useGymPeople({ gymId, user, apiOnline, mode, blockedUserIds }: Options) {
  const [remote, setRemote] = useState<UserProfile[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [showLoader, setShowLoader] = useState(false)
  /** Last successful fetch key — avoid wiping list on presence-only updates */
  const loadedKeyRef = useRef<string | null>(null)

  const demo = Boolean(user && isDemoAccount(user.email))
  const useApi = Boolean(gymId && user && apiOnline && !demo)
  const gymIdsKey = user?.gymIds?.join(',') ?? ''
  const fetchKey = useApi && user ? `${user.id}:${gymId}:${gymIdsKey}` : ''

  useEffect(() => {
    if (!useApi || !gymId || !fetchKey) {
      setRemote(null)
      setLoading(false)
      loadedKeyRef.current = null
      return
    }

    // Same hall already loaded — skip. Check-in only updates `user` in useMemo.
    if (loadedKeyRef.current === fetchKey) return

    let cancelled = false
    // Invalidate cache while in flight so A→B→A still refetches A
    loadedKeyRef.current = null
    setRemote(null)
    setLoading(true)

    void apiFetchGymPeople(gymId)
      .then((people) => {
        if (cancelled) return
        setRemote(people)
        loadedKeyRef.current = fetchKey
      })
      .catch(() => {
        if (!cancelled) setRemote([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [useApi, gymId, fetchKey])

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
        // Ждём API — не подмешиваем демо-мок чужого зала
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
    } else if (mode === 'gymPage') {
      list = peopleForGymPage(gymId, user, { includeSeedPeople: demo })
    } else {
      list = peopleInGym(gymId, user, { includeSeedPeople: demo })
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
  }
}
