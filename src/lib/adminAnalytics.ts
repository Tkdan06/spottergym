/** Server admin analytics payload (Europe/Moscow activity windows). */

export type AdminRetentionPoint = {
  day: number
  rate: number | null
  cohorts: number
  cohortUsers: number
  retained: number
}

export type AdminAnalytics = {
  timezone: 'Europe/Moscow'
  generatedAt: string
  users: number
  onboarded: number
  coaches: number
  withPhotos: number
  totalPhotos: number
  photosBytes: number
  activeNow: number
  /** Distinct users who checked in today (MSK) */
  checkedInToday?: number
  dau: number
  mau: number
  retention: AdminRetentionPoint[]
  byCity: { city: string; count: number }[]
  byGym: { gymId: string; label: string; count: number }[]
  byGender: { male: number; female: number; unknown: number }
  avgAge: number | null
  tickets: { incoming: number; in_progress: number; closed: number; total: number }
  blockedEmails: number
  passwordResets?: {
    last24h: number
    last7d: number
    last30d: number
    completed7d: number
    uniqueEmails7d: number
    noAccount7d: number
  }
}

export function formatRetentionRate(rate: number | null) {
  if (rate == null || !Number.isFinite(rate)) return '—'
  return `${Math.round(rate * 1000) / 10}%`
}

export function retentionMap(analytics: AdminAnalytics | null) {
  const map = new Map<number, AdminRetentionPoint>()
  for (const row of analytics?.retention || []) map.set(row.day, row)
  return map
}
