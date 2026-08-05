import type { UserProfile } from '../types'

/** Зал, в котором человек сейчас отметился */
export function getCheckedInGymId(user: Pick<UserProfile, 'isActive' | 'checkedInGymId' | 'homeGymId'>) {
  if (!user.isActive) return ''
  if (user.checkedInGymId) return user.checkedInGymId
  // Миграция старых профилей без checkedInGymId
  return user.homeGymId || ''
}

/** Live session length: `12:34` or `1:02:15` */
export function formatCheckInElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

export function getCheckInStartedAt(
  user: Pick<UserProfile, 'isActive' | 'checkedInAt' | 'lastSeenAt'>,
): string {
  if (!user.isActive) return ''
  if (user.checkedInAt) return user.checkedInAt
  return user.lastSeenAt || ''
}

/** Виден как «в зале» именно в этом клубе */
export function isPresentInGym(
  user: Pick<UserProfile, 'isActive' | 'checkedInGymId' | 'homeGymId' | 'gymIds'>,
  gymId: string,
) {
  if (!gymId || !user.isActive) return false
  if (!user.gymIds?.includes(gymId)) return false
  return getCheckedInGymId(user) === gymId
}
