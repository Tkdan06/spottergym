import type { AppUser } from '../types'
import { normalizeEmail } from './adminConfig'
import { listStoredAccountEmails, loadStoredAccountProfile } from './adminDirectory'
import { isPresentInGym } from './presence'

export type GymLiveStats = {
  membersCount: number
  activeNow: number
}

/**
 * Реальная статистика клуба по профилям в этом браузере (+ текущая сессия).
 * Без бэкенда это максимум: аккаунты на устройстве, не «все пользователи сервера».
 */
export function getRealGymStats(
  gymId: string,
  currentUser?: AppUser | null,
): GymLiveStats {
  if (!gymId) return { membersCount: 0, activeNow: 0 }

  const seen = new Set<string>()
  let membersCount = 0
  let activeNow = 0

  for (const email of listStoredAccountEmails()) {
    const profile = loadStoredAccountProfile(email)
    if (!profile?.gymIds?.includes(gymId)) continue
    const key = normalizeEmail(profile.email || email)
    if (!key || seen.has(key)) continue

    const live =
      currentUser && normalizeEmail(currentUser.email) === key ? currentUser : profile
    seen.add(key)
    membersCount += 1
    if (isPresentInGym(live, gymId)) activeNow += 1
  }

  if (currentUser?.email && currentUser.gymIds?.includes(gymId)) {
    const key = normalizeEmail(currentUser.email)
    if (key && !seen.has(key)) {
      membersCount += 1
      if (isPresentInGym(currentUser, gymId)) activeNow += 1
    }
  }

  return { membersCount, activeNow }
}

/** Карта stats по id залов (для списков карточек) */
export function buildRealGymStatsMap(
  gymIds: string[],
  currentUser?: AppUser | null,
): Record<string, GymLiveStats> {
  const map: Record<string, GymLiveStats> = {}
  for (const id of gymIds) {
    map[id] = getRealGymStats(id, currentUser)
  }
  return map
}
