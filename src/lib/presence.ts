import type { UserProfile } from '../types'

/** Зал, в котором человек сейчас отметился */
export function getCheckedInGymId(user: Pick<UserProfile, 'isActive' | 'checkedInGymId' | 'homeGymId'>) {
  if (!user.isActive) return ''
  if (user.checkedInGymId) return user.checkedInGymId
  // Миграция старых профилей без checkedInGymId
  return user.homeGymId || ''
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
