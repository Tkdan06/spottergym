import type { Gym } from '../types'
import { isMemberOfGym } from './userGyms'

/** Текущий порядок списка «Залы»: сначала свои клубы, потом по названию. */
export function compareGymsStandard(
  a: Pick<Gym, 'id' | 'name'>,
  b: Pick<Gym, 'id' | 'name'>,
  user: { gymIds?: string[] } | null | undefined,
) {
  const am = isMemberOfGym(user, a.id) ? 0 : 1
  const bm = isMemberOfGym(user, b.id) ? 0 : 1
  if (am !== bm) return am - bm
  return a.name.localeCompare(b.name, 'ru')
}

/**
 * В городе наверх — один зал с наибольшим числом прикреплённых.
 * Остальные — как compareGymsStandard. При нулях у всех топ не двигаем.
 */
export function sortGymsInCity<T extends Pick<Gym, 'id' | 'name'>>(
  gyms: T[],
  membersOf: (gym: T) => number,
  user: { gymIds?: string[] } | null | undefined,
): T[] {
  if (gyms.length < 2) return gyms

  let topCount = 0
  for (const gym of gyms) {
    const n = membersOf(gym)
    if (n > topCount) topCount = n
  }

  if (topCount <= 0) {
    return [...gyms].sort((a, b) => compareGymsStandard(a, b, user))
  }

  const featured = gyms
    .filter((gym) => membersOf(gym) === topCount)
    .sort((a, b) => compareGymsStandard(a, b, user))[0]
  if (!featured) {
    return [...gyms].sort((a, b) => compareGymsStandard(a, b, user))
  }

  return [...gyms].sort((a, b) => {
    if (a.id === featured.id) return -1
    if (b.id === featured.id) return 1
    return compareGymsStandard(a, b, user)
  })
}
