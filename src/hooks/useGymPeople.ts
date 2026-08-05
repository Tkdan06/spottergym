import { useEffect, useMemo, useState } from 'react'
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

/**
 * When API is online — members from Postgres.
 * Demo / offline — local mock helpers (dev only for offline).
 */
export function useGymPeople({ gymId, user, apiOnline, mode, blockedUserIds }: Options) {
  const [remote, setRemote] = useState<UserProfile[] | null>(null)
  const [loading, setLoading] = useState(false)

  const demo = Boolean(user && isDemoAccount(user.email))
  const useApi = Boolean(gymId && user && apiOnline && !demo)

  useEffect(() => {
    if (!useApi || !gymId) {
      setRemote(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void apiFetchGymPeople(gymId)
      .then((people) => {
        if (!cancelled) setRemote(people)
      })
      .catch(() => {
        if (!cancelled) setRemote(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [
    useApi,
    gymId,
    user?.id,
    user?.isActive,
    user?.checkedInGymId,
    user?.gymIds?.join(','),
  ])

  const people = useMemo(() => {
    if (!gymId || !user) return []

    let list: UserProfile[]
    if (useApi && remote) {
      list = remote.map((p) =>
        p.id === user.id
          ? { ...p, ...user, isActive: isPresentInGym(user, gymId) }
          : p,
      )
      if (!list.some((p) => p.id === user.id) && user.gymIds.includes(gymId)) {
        list = [{ ...user, isActive: isPresentInGym(user, gymId) }, ...list]
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

  return { people, loading, fromApi: Boolean(useApi && remote) }
}
