import type { Gym } from '../types'

type RankGym = Pick<Gym, 'id' | 'name' | 'network'>

/** Сколько клубов каждой сети в выборке (обычно все залы города). */
export function networkHallCounts<T extends Pick<Gym, 'network'>>(gyms: T[]) {
  const map = new Map<string, number>()
  for (const gym of gyms) {
    const key = gym.network || ''
    map.set(key, (map.get(key) || 0) + 1)
  }
  return map
}

/**
 * В городе: сначала клубы с людьми (5 → 4 → 1), затем пустые по размеру сети
 * (больше залов сети — выше). При равных счётчиках — та же сетка сетей.
 */
export function sortGymsInCity<T extends RankGym>(
  gyms: T[],
  membersOf: (gym: T) => number,
  hallCountOf?: (gym: T) => number,
): T[] {
  if (gyms.length < 2) return gyms

  const fallback = hallCountOf ? null : networkHallCounts(gyms)
  const halls = (gym: T) => hallCountOf?.(gym) ?? fallback?.get(gym.network || '') ?? 0

  return [...gyms].sort((a, b) => {
    const byPeople = membersOf(b) - membersOf(a)
    if (byPeople) return byPeople
    const byNetwork = halls(b) - halls(a)
    if (byNetwork) return byNetwork
    const byNetworkName = (a.network || '').localeCompare(b.network || '', 'ru')
    if (byNetworkName) return byNetworkName
    return a.name.localeCompare(b.name, 'ru')
  })
}
