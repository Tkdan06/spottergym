import type { AppUser, UserProfile } from '../types'

type GymLegacy = {
  gymId?: string
  gymIds?: string[]
  homeGymId?: string
}

/** Поддержка старого формата с gymId из localStorage */
export function normalizeGymFields<T extends GymLegacy>(
  user: T,
): T & Pick<UserProfile, 'gymIds' | 'homeGymId'> {
  const legacyId = typeof user.gymId === 'string' ? user.gymId : ''
  const rawIds = Array.isArray(user.gymIds)
    ? user.gymIds.filter((id): id is string => typeof id === 'string' && Boolean(id))
    : []
  const gymIds = rawIds.length ? [...new Set(rawIds)] : legacyId ? [legacyId] : []
  const homeGymId =
    (typeof user.homeGymId === 'string' && gymIds.includes(user.homeGymId) && user.homeGymId) ||
    gymIds[0] ||
    ''

  return { ...user, gymIds, homeGymId }
}

export function isMemberOfGym(
  user: Pick<UserProfile, 'gymIds'> | Pick<AppUser, 'gymIds'> | null | undefined,
  gymId: string,
) {
  return Boolean(user?.gymIds?.includes(gymId))
}

export function withGymMembership(
  user: AppUser,
  gymId: string,
  join: boolean,
  options?: { makeHome?: boolean },
): AppUser {
  let gymIds = user.gymIds ?? []
  if (join) {
    gymIds = gymIds.includes(gymId) ? gymIds : [...gymIds, gymId]
  } else {
    gymIds = gymIds.filter((id) => id !== gymId)
  }

  let homeGymId = user.homeGymId
  if (join && (options?.makeHome || !homeGymId)) {
    homeGymId = gymId
  } else if (!join && homeGymId === gymId) {
    homeGymId = gymIds[0] || ''
  } else if (homeGymId && !gymIds.includes(homeGymId)) {
    homeGymId = gymIds[0] || ''
  }

  let checkedInGymId = user.checkedInGymId || ''
  let isActive = user.isActive
  if (checkedInGymId && !gymIds.includes(checkedInGymId)) {
    checkedInGymId = ''
    isActive = false
  }

  return {
    ...user,
    gymIds,
    homeGymId,
    checkedInGymId,
    isActive,
    lastSeenAt: new Date().toISOString(),
  }
}
