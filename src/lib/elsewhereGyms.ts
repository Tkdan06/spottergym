import { GYMS } from '../data/mock'
import type { Gym } from '../types'

export const ELSEWHERE_QUERY_MIN = 3
export const ELSEWHERE_CITY_MAX = 3

export type ElsewhereSuggestion = {
  city: string
  gym: Gym
  /** Сколько ещё клубов в этом городе совпало с запросом (кроме показанного) */
  moreInCity: number
}

/** Локальный каталог: клубы вне excludeCity по строке поиска */
export function searchElsewhereLocal(qRaw: string, excludeCity: string): Gym[] {
  const q = qRaw.toLowerCase().trim()
  if (q.length < ELSEWHERE_QUERY_MIN) return []
  const picked: Gym[] = []
  const perCity = new Map<string, number>()
  for (const g of GYMS) {
    if (g.city === excludeCity) continue
    const hay = `${g.name} ${g.network} ${g.district} ${g.address}`.toLowerCase()
    if (!hay.includes(q)) continue
    const n = perCity.get(g.city) || 0
    if (n >= 2) continue
    perCity.set(g.city, n + 1)
    picked.push(g)
    if (picked.length >= 8) break
  }
  return picked
}

/** Группировка: до maxCities городов, по одному представителю */
export function buildElsewhereSuggestions(
  gyms: Gym[],
  maxCities = ELSEWHERE_CITY_MAX,
): ElsewhereSuggestion[] {
  const byCity = new Map<string, Gym[]>()
  for (const g of gyms) {
    const list = byCity.get(g.city) || []
    list.push(g)
    byCity.set(g.city, list)
  }
  const rows: ElsewhereSuggestion[] = []
  for (const [city, list] of byCity) {
    rows.push({ city, gym: list[0], moreInCity: Math.max(0, list.length - 1) })
    if (rows.length >= maxCities) break
  }
  return rows
}
