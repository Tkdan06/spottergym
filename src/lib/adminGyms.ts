export type GymSortKey = 'activeUsers' | 'retention' | 'social' | 'growth'

export const GYM_SORT_OPTIONS: { id: GymSortKey; label: string }[] = [
  { id: 'activeUsers', label: 'Active users' },
  { id: 'retention', label: 'Retention' },
  { id: 'social', label: 'Social' },
  { id: 'growth', label: 'Growth' },
]

export type GymRetentionCell = {
  day: number
  eligible: number
  retained: number
  rate: number | null
  thin: boolean
}

export type GymRow = {
  id: string
  name: string
  network: string
  city: string
  catalog: boolean
  totalUsers: number
  members: number
  activeUsers: number
  activeToday: number
  wau: number
  mau: number
  r7: GymRetentionCell
  r30: GymRetentionCell
  socialActors: number
  socialActions: number
  socialRate: number | null
  chats: number
  workouts: number
  checkIns: number
  viewedUsers: number
  viewedOtherUsers: number
  growth: number
  lowDensity: boolean
  empty: boolean
}

export type PearsonCell = {
  n: number
  r: number | null
  thin: boolean
}

export type AdminGymsPayload = {
  timezone: 'Europe/Moscow'
  generatedAt: string
  range: { preset: string; from: string; to: string; fromKey: string; toKey: string }
  sort: GymSortKey
  current: {
    gymsWithUsers: number
    users: number
    activeUsers: number
    socialActors: number
    socialActions: number
    chats: number
    workouts: number
    checkIns: number
    r7: GymRetentionCell
    r30: GymRetentionCell
    noHomeUsers: number
    missingCatalogUsers: number
  }
  density: {
    usersPerGym: { label: string; gyms: number }[]
    activePerGym: { label: string; gyms: number }[]
    peopleAvailablePerGym: { label: string; gyms: number }[]
    socialPerGym: { label: string; gyms: number }[]
    percentiles: {
      users: { p50: number | null; p90: number | null }
      active: { p50: number | null; p90: number | null }
      members: { p50: number | null; p90: number | null }
      socialActors: { p50: number | null; p90: number | null }
    }
    note: 'observed_distribution'
  }
  gyms: GymRow[]
  lowDensity: GymRow[]
  empty: GymRow[]
  network: {
    points: {
      id: string
      name: string
      activeUsers: number
      socialRate: number | null
      r7: number | null
      r7Eligible: number
    }[]
    correlations: {
      activeVsSocial: PearsonCell
      activeVsR7: PearsonCell
      socialVsR7: PearsonCell
    }
    disclaimer: 'correlation_not_causation'
  }
  viewed: {
    checkInUsers: number
    checkInOtherGymUsers: number
    peopleListHome: number
    peopleListGymCard: number
    gymCardHasGymId: false
    rows: {
      id: string
      name: string
      homeUsers: number
      viewedUsers: number
      viewedOtherUsers: number
      checkIns: number
    }[]
  }
}

export function isGymSortKey(value: string | null | undefined): value is GymSortKey {
  return GYM_SORT_OPTIONS.some((item) => item.id === value)
}

export function formatGymCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '0'
  return Math.round(value).toLocaleString('ru-RU')
}

export function formatGymRate(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${Math.round(value * 1000) / 10}%`
}

export function formatPearson(cell: PearsonCell | undefined): string {
  if (!cell || cell.r == null || !Number.isFinite(cell.r)) return '—'
  return cell.r.toFixed(2)
}
