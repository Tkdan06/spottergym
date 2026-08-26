import type { Gym } from '../types'
import { apiFetchGyms } from './apiClient'

const FRESH_MS = 60_000
const STORAGE_PREFIX = 'spotter.cityGyms.v1:'

type Entry = { gyms: Gym[]; at: number }

const memory = new Map<string, Entry>()
const inflight = new Map<string, Promise<Gym[]>>()

function persist(city: string, gyms: Gym[]) {
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${city}`, JSON.stringify(gyms))
  } catch {
    /* quota / private mode */
  }
}

function readStored(city: string): Gym[] | null {
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${city}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || !parsed.length) return null
    if (!parsed.every((g) => g && typeof g === 'object' && typeof (g as Gym).id === 'string')) {
      return null
    }
    return parsed as Gym[]
  } catch {
    return null
  }
}

/** Живой клуб из кэша каталога (после списка «Залы»), не сиды из gyms.json. */
export function peekGym(gymId: string, cities: (string | undefined)[]): Gym | undefined {
  if (!gymId) return undefined
  const seen = new Set<string>()
  for (const city of cities) {
    const key = city?.trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    const hit = peekCityGyms(key)?.find((g) => g.id === gymId)
    if (hit) return hit
  }
  return undefined
}

/** Сиды activeNow/membersCount из локального JSON — не показывать как онлайн. */
export function gymWithoutSeedStats(gym: Gym): Gym {
  return { ...gym, activeNow: 0, membersCount: 0 }
}

/** Синхронный снимок города — память или sessionStorage, без сети. */
export function peekCityGyms(city: string): Gym[] | null {
  const key = city.trim()
  if (!key) return null
  const mem = memory.get(key)
  if (mem?.gyms.length) return mem.gyms
  const stored = readStored(key)
  if (stored) {
    memory.set(key, { gyms: stored, at: 0 })
    return stored
  }
  return null
}

/** Все клубы города с живыми счётчиками. Повтор за минуту не бьёт сеть. */
export function loadCityGyms(city: string): Promise<Gym[]> {
  const key = city.trim()
  if (!key) return Promise.resolve([])

  const mem = memory.get(key)
  if (mem && Date.now() - mem.at < FRESH_MS) return Promise.resolve(mem.gyms)

  const pending = inflight.get(key)
  if (pending) return pending

  const request = apiFetchGyms({ city })
    .then((gyms) => {
      memory.set(key, { gyms, at: Date.now() })
      persist(key, gyms)
      inflight.delete(key)
      return gyms
    })
    .catch((err: unknown) => {
      inflight.delete(key)
      const stale = peekCityGyms(key)
      if (stale) return stale
      throw err
    })

  inflight.set(key, request)
  return request
}

export function prefetchCityGyms(city: string) {
  const key = city.trim()
  if (!key) return
  void loadCityGyms(key).catch(() => {})
}
