import { prisma } from '../db.js'
import { expireStaleCheckIns } from './checkInExpiry.js'
import {
  buildPasswordResetSummary,
  type PasswordResetSummary,
} from './passwordResetAnalytics.js'
import { opsFaultCounts } from './opsFaults.js'

/** Europe/Moscow is UTC+3 year-round */
const MSK_OFFSET_MS = 3 * 60 * 60 * 1000
const RR_DAYS = [1, 3, 7, 14, 30, 60] as const
const RR_COHORT_WINDOW = 28

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
  /** Distinct users with a check-in started today (MSK) */
  checkedInToday: number
  dau: number
  mau: number
  retention: AdminRetentionPoint[]
  byCity: { city: string; count: number }[]
  byGym: { gymId: string; label: string; count: number }[]
  byGender: { male: number; female: number; unknown: number }
  avgAge: number | null
  /** Align with FE ticketCounts: incoming = new|open, closed = resolved|closed */
  tickets: { incoming: number; in_progress: number; closed: number; total: number }
  blockedEmails: number
  passwordResets: PasswordResetSummary
  ops: { last24h: number; last5xx24h: number }
}

function utf8ByteLength(value: string) {
  return Buffer.byteLength(value, 'utf8')
}

/** Same idea as FE estimatePhotosBytes — storage size of data-URL strings. */
export function estimatePhotosBytes(photos: string[] | undefined | null) {
  if (!Array.isArray(photos) || !photos.length) return 0
  return photos.reduce((sum, p) => sum + (typeof p === 'string' ? utf8ByteLength(p) : 0), 0)
}

export function moscowDayKey(date: Date): string {
  const shifted = new Date(date.getTime() + MSK_OFFSET_MS)
  return shifted.toISOString().slice(0, 10)
}

export function moscowDayStartUtc(dayKey: string): Date {
  return new Date(`${dayKey}T00:00:00+03:00`)
}

function addDaysKey(dayKey: string, days: number): string {
  const start = moscowDayStartUtc(dayKey)
  return moscowDayKey(new Date(start.getTime() + days * 24 * 60 * 60 * 1000))
}

function computeDayNRetention(
  users: { registeredAt: Date; lastSeenAt: Date }[],
  n: number,
  todayKey: string,
): AdminRetentionPoint {
  // Cohorts D where D+N is before today (fully observed)
  const latestCohort = addDaysKey(todayKey, -(n + 1))
  const earliestCohort = addDaysKey(latestCohort, -(RR_COHORT_WINDOW - 1))

  const byRegDay = new Map<string, { total: number; retained: number }>()
  for (const u of users) {
    const regKey = moscowDayKey(u.registeredAt)
    if (regKey < earliestCohort || regKey > latestCohort) continue
    const bucket = byRegDay.get(regKey) || { total: 0, retained: 0 }
    bucket.total += 1
    const targetDay = addDaysKey(regKey, n)
    if (moscowDayKey(u.lastSeenAt) === targetDay) bucket.retained += 1
    byRegDay.set(regKey, bucket)
  }

  let cohortUsers = 0
  let retained = 0
  let cohorts = 0
  let rateSum = 0
  for (const bucket of byRegDay.values()) {
    if (bucket.total <= 0) continue
    cohorts += 1
    cohortUsers += bucket.total
    retained += bucket.retained
    rateSum += bucket.retained / bucket.total
  }

  return {
    day: n,
    rate: cohorts > 0 ? rateSum / cohorts : null,
    cohorts,
    cohortUsers,
    retained,
  }
}

export async function buildAdminAnalytics(): Promise<AdminAnalytics> {
  await expireStaleCheckIns()

  const now = new Date()
  const todayKey = moscowDayKey(now)
  const todayStart = moscowDayStartUtc(todayKey)
  const mauStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [
    users,
    activityRows,
    photoRows,
    activeNow,
    checkedInTodayRows,
    cityGroups,
    gymGroups,
    genderGroups,
    ageAgg,
    ticketGroups,
    blockedEmails,
    gyms,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        registeredAt: true,
        lastSeenAt: true,
        onboardingDone: true,
        isCoach: true,
        age: true,
      },
    }),
    prisma.user.findMany({
      where: { deletedAt: null },
      select: { photos: true },
    }),
    prisma.checkIn.count({ where: { checkedOutAt: null } }),
    prisma.checkIn.findMany({
      where: { checkedInAt: { gte: todayStart } },
      select: { userId: true },
      distinct: ['userId'],
    }),
    prisma.user.groupBy({
      by: ['city'],
      _count: { _all: true },
      where: { deletedAt: null },
      orderBy: { _count: { city: 'desc' } },
    }),
    prisma.user.groupBy({
      by: ['homeGymId'],
      _count: { _all: true },
      where: { homeGymId: { not: null }, deletedAt: null },
      orderBy: { _count: { homeGymId: 'desc' } },
    }),
    prisma.user.groupBy({
      by: ['gender'],
      _count: { _all: true },
    }),
    prisma.user.aggregate({ _avg: { age: true } }),
    prisma.feedbackTicket.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    prisma.blockedEmail.count(),
    prisma.gym.findMany({ select: { id: true, name: true, network: true } }),
  ])

  let onboarded = 0
  let coaches = 0
  let dau = 0
  let mau = 0
  for (const u of activityRows) {
    if (u.onboardingDone) onboarded += 1
    if (u.isCoach) coaches += 1
    if (u.lastSeenAt >= todayStart) dau += 1
    if (u.lastSeenAt >= mauStart) mau += 1
  }

  let withPhotos = 0
  let totalPhotos = 0
  let photosBytes = 0
  for (const row of photoRows) {
    const photos = row.photos || []
    if (photos.length) {
      withPhotos += 1
      totalPhotos += photos.length
      photosBytes += estimatePhotosBytes(photos)
    }
  }

  const gymMap = new Map(gyms.map((g) => [g.id, g]))
  const byGym = gymGroups
    .filter((g) => g.homeGymId)
    .map((g) => {
      const gymId = g.homeGymId as string
      const gym = gymMap.get(gymId)
      const short = gym
        ? gym.name
            .replace(/^DDX\s+/i, '')
            .replace(/^Spirit\.?\s*Fitness\s+/i, '')
            .replace(/^World Class\s+/i, '')
            .trim()
        : gymId
      const label = gym ? `${gym.network} · ${short || gym.name}` : gymId
      return { gymId, label, count: g._count._all }
    })

  const byCity = cityGroups
    .map((c) => ({
      city: (c.city || '').trim() || 'Без города',
      count: c._count._all,
    }))
    .filter((c) => c.count > 0)

  const byGender = { male: 0, female: 0, unknown: 0 }
  for (const g of genderGroups) {
    if (g.gender === 'male') byGender.male = g._count._all
    else if (g.gender === 'female') byGender.female = g._count._all
    else byGender.unknown += g._count._all
  }

  const tickets = { incoming: 0, in_progress: 0, closed: 0, total: 0 }
  for (const t of ticketGroups) {
    const n = t._count._all
    tickets.total += n
    if (t.status === 'open' || t.status === 'new') tickets.incoming += n
    else if (t.status === 'in_progress') tickets.in_progress = n
    else if (t.status === 'resolved' || t.status === 'closed') tickets.closed += n
  }

  const retention = RR_DAYS.map((day) =>
    computeDayNRetention(
      activityRows.map((u) => ({ registeredAt: u.registeredAt, lastSeenAt: u.lastSeenAt })),
      day,
      todayKey,
    ),
  )

  const avgAgeRaw = ageAgg._avg.age
  const avgAge =
    avgAgeRaw != null && Number.isFinite(avgAgeRaw) ? Math.round(avgAgeRaw * 10) / 10 : null

  const passwordResets = await buildPasswordResetSummary()
  const ops = await opsFaultCounts(new Date(now.getTime() - 24 * 60 * 60 * 1000)).catch(() => ({
    last24h: 0,
    last5xx24h: 0,
  }))

  return {
    timezone: 'Europe/Moscow',
    generatedAt: now.toISOString(),
    users,
    onboarded,
    coaches,
    withPhotos,
    totalPhotos,
    photosBytes,
    activeNow,
    checkedInToday: checkedInTodayRows.length,
    dau,
    mau,
    retention,
    byCity,
    byGym,
    byGender,
    avgAge,
    tickets,
    blockedEmails,
    passwordResets,
    ops,
  }
}
