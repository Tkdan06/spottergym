import { getGym } from '../data/mock'
import type { AdminDirectoryUser, FeedbackTicket } from '../types'
import {
  estimatePhotosBytes,
  listStoredAccountEmails,
  loadBlockedEmails,
  loadDirectory,
  loadStoredAccountProfile,
  mergeStoredAccountsIntoDirectory,
  utf8ByteLength,
} from './adminDirectory'
import { ticketCounts } from './feedback'
export type AdminCityStat = { city: string; count: number }
export type AdminGymStat = { gymId: string; label: string; count: number }

export type AdminOverview = {
  /** Все записи в директории */
  totalDirectory: number
  /** Реальные аккаунты (не mock-сиды) */
  realPlayers: number
  /** Прошли онбординг */
  onboarded: number
  /** Сейчас отметились в зале */
  activeNow: number
  /** Демо-сиды в зале */
  demoSeeds: number
  blockedEmails: number
  tickets: ReturnType<typeof ticketCounts>
  totalTickets: number
  coaches: number
  withPhotos: number
  totalPhotos: number
  photosBytes: number
  /** Суммарный размер всех spotter.* ключей localStorage */
  storageBytes: number
  storageKeys: number
  accountsOnDevice: number
  byCity: AdminCityStat[]
  byGym: AdminGymStat[]
  byGender: { male: number; female: number; unknown: number }
  avgAge: number | null
  players: AdminDirectoryUser[]
  generatedAt: string
}

function formatGymLabel(gymId: string) {
  const gym = getGym(gymId)
  if (!gym) return gymId || '—'
  const short = gym.name
    .replace(/^DDX\s+/i, '')
    .replace(/^Spirit\.?\s*Fitness\s+/i, '')
    .replace(/^World Class\s+/i, '')
    .trim()
  return `${gym.network} · ${short || gym.name}`
}

/** Device-only Spotter localStorage footprint (not server storage). */
export function scanDeviceStorageHint() {
  let bytes = 0
  let keys = 0
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (!key?.startsWith('spotter.')) continue
      keys += 1
      const value = localStorage.getItem(key) || ''
      bytes += utf8ByteLength(key) + utf8ByteLength(value)
    }
  } catch {
    /* ignore */
  }
  return { bytes, keys }
}

function scanSpotterStorageBytes() {
  return scanDeviceStorageHint()
}

function enrichPlayer(entry: AdminDirectoryUser): AdminDirectoryUser {
  if (entry.isDemoSeed) return entry
  const stored = loadStoredAccountProfile(entry.email)
  if (!stored) return entry
  const photos = Array.isArray(stored.photos) ? stored.photos : []
  return {
    ...entry,
    name: stored.name || entry.name,
    age: stored.age ?? entry.age,
    gender: stored.gender ?? entry.gender,
    city: stored.city || entry.city,
    homeGymId: stored.homeGymId || entry.homeGymId,
    gymIds: stored.gymIds?.length ? [...stored.gymIds] : entry.gymIds,
    intent: stored.intent ?? entry.intent,
    experienceLevel: stored.experienceLevel ?? entry.experienceLevel,
    isCoach: stored.isCoach ?? entry.isCoach,
    onboardingDone: stored.onboardingDone ?? entry.onboardingDone,
    isActive: stored.isActive ?? entry.isActive,
    checkedInGymId: stored.checkedInGymId || entry.checkedInGymId,
    photosCount: photos.length,
    photosBytes: estimatePhotosBytes(photos),
    registeredAt: stored.registeredAt || entry.registeredAt,
    lastSeenAt: stored.lastSeenAt || entry.lastSeenAt,
    isDemoSeed: false,
  }
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function formatAdminDate(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (!Number.isFinite(+d)) return '—'
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Полный снимок для админ-дашборда (этот браузер / localStorage) */
export function collectAdminOverview(tickets: FeedbackTicket[] = []): AdminOverview {
  mergeStoredAccountsIntoDirectory()
  const directory = loadDirectory().map(enrichPlayer)
  const storage = scanSpotterStorageBytes()
  const accountsOnDevice = listStoredAccountEmails().length

  const real = directory.filter((u) => !u.isDemoSeed)
  const demoSeeds = directory.filter((u) => u.isDemoSeed).length

  const cityMap = new Map<string, number>()
  const gymMap = new Map<string, number>()
  let male = 0
  let female = 0
  let unknownGender = 0
  let ageSum = 0
  let ageCount = 0
  let totalPhotos = 0
  let photosBytes = 0
  let withPhotos = 0
  let coaches = 0
  let onboarded = 0
  let activeNow = 0

  for (const p of real) {
    if (p.onboardingDone) onboarded += 1
    if (p.isActive) activeNow += 1
    if (p.isCoach) coaches += 1

    const city = (p.city || '').trim() || 'Без города'
    cityMap.set(city, (cityMap.get(city) || 0) + 1)

    const gymId = p.homeGymId || p.gymIds?.[0] || ''
    if (gymId) gymMap.set(gymId, (gymMap.get(gymId) || 0) + 1)

    if (p.gender === 'female') female += 1
    else if (p.gender === 'male') male += 1
    else unknownGender += 1

    if (typeof p.age === 'number' && p.age > 0) {
      ageSum += p.age
      ageCount += 1
    }

    const pc = p.photosCount || 0
    totalPhotos += pc
    photosBytes += p.photosBytes || 0
    if (pc > 0) withPhotos += 1
  }

  const byCity = [...cityMap.entries()]
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city, 'ru'))

  const byGym = [...gymMap.entries()]
    .map(([gymId, count]) => ({
      gymId,
      label: formatGymLabel(gymId),
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ru'))

  const players = [...directory].sort((a, b) => {
    const ar = a.isDemoSeed ? 1 : 0
    const br = b.isDemoSeed ? 1 : 0
    if (ar !== br) return ar - br
    const at = a.registeredAt ? +new Date(a.registeredAt) : 0
    const bt = b.registeredAt ? +new Date(b.registeredAt) : 0
    return bt - at || a.name.localeCompare(b.name, 'ru')
  })

  return {
    totalDirectory: directory.length,
    realPlayers: real.length,
    onboarded,
    activeNow,
    demoSeeds,
    blockedEmails: loadBlockedEmails().length,
    tickets: ticketCounts(tickets),
    totalTickets: tickets.length,
    coaches,
    withPhotos,
    totalPhotos,
    photosBytes,
    storageBytes: storage.bytes,
    storageKeys: storage.keys,
    accountsOnDevice,
    byCity,
    byGym,
    byGender: { male, female, unknown: unknownGender },
    avgAge: ageCount ? Math.round((ageSum / ageCount) * 10) / 10 : null,
    players,
    generatedAt: new Date().toISOString(),
  }
}
