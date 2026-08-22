import { prisma } from '../db.js'
import { moscowDayKey, moscowDayStartUtc } from './adminAnalytics.js'

export type ActivityRange = 7 | 30 | 90

export function parseActivityRange(raw: string | undefined): ActivityRange {
  const n = Number(raw)
  return n === 7 || n === 30 || n === 90 ? n : 30
}

export type ActivityDay = {
  date: string
  minutes: number
  sessions: number
  gymIds: string[]
  /** Check-in intervals (ISO UTC); render in the user's local timezone on the client. */
  intervals: { start: string; end: string }[]
}

export type ActivityDayHighlight = {
  date: string
  minutes: number
  sessions: number
}

export type ActivityStats = {
  range: ActivityRange
  timezone: 'Europe/Moscow'
  generatedAt: string
  totalMinutes: number
  totalSessions: number
  streakDays: number
  busiestDay: ActivityDayHighlight | null
  quietestDay: ActivityDayHighlight | null
  days: ActivityDay[]
}

const MAX_SESSION_MS = 6 * 60 * 60 * 1000

function addDaysKey(dayKey: string, days: number): string {
  const start = moscowDayStartUtc(dayKey)
  return moscowDayKey(new Date(start.getTime() + days * 24 * 60 * 60 * 1000))
}

function sessionEndMs(
  checkedInAt: Date,
  checkedOutAt: Date | null,
  expiresAt: Date | null,
  now: Date,
): number {
  const candidates = [checkedOutAt?.getTime(), expiresAt?.getTime(), now.getTime()].filter(
    (n): n is number => typeof n === 'number' && Number.isFinite(n),
  )
  const end = Math.min(...candidates)
  const start = checkedInAt.getTime()
  if (end <= start) return start
  return Math.min(end, start + MAX_SESSION_MS)
}

function buildEmptyDays(rangeStartKey: string, todayKey: string): ActivityDay[] {
  const days: ActivityDay[] = []
  let cursor = rangeStartKey
  while (true) {
    days.push({ date: cursor, minutes: 0, sessions: 0, gymIds: [], intervals: [] })
    if (cursor === todayKey) break
    cursor = addDaysKey(cursor, 1)
  }
  return days
}

/** Consecutive MSK days with ≥1 session ending at today (or yesterday if today empty). */
function computeStreak(days: ActivityDay[], todayKey: string): number {
  const byDate = new Map(days.map((d) => [d.date, d]))
  let streak = 0
  let cursor = todayKey
  const today = byDate.get(todayKey)
  if (!today || today.sessions === 0) {
    cursor = addDaysKey(todayKey, -1)
  }
  while (true) {
    const row = byDate.get(cursor)
    if (!row || row.sessions <= 0) break
    streak += 1
    cursor = addDaysKey(cursor, -1)
  }
  return streak
}

export async function buildMyActivityStats(
  userId: string,
  range: ActivityRange,
): Promise<ActivityStats> {
  const now = new Date()
  const todayKey = moscowDayKey(now)
  const rangeStartKey = addDaysKey(todayKey, -(range - 1))
  const rangeStart = moscowDayStartUtc(rangeStartKey)

  const rows = await prisma.checkIn.findMany({
    where: {
      userId,
      checkedInAt: { gte: rangeStart },
    },
    select: {
      gymId: true,
      checkedInAt: true,
      checkedOutAt: true,
      expiresAt: true,
    },
    orderBy: { checkedInAt: 'asc' },
  })

  const days = buildEmptyDays(rangeStartKey, todayKey)
  const index = new Map(days.map((d, i) => [d.date, i]))

  for (const row of rows) {
    const dayKey = moscowDayKey(row.checkedInAt)
    const idx = index.get(dayKey)
    if (idx === undefined) continue
    const end = sessionEndMs(row.checkedInAt, row.checkedOutAt, row.expiresAt, now)
    const minutes = Math.max(0, Math.round((end - row.checkedInAt.getTime()) / 60_000))
    const bucket = days[idx]
    bucket.minutes += minutes
    bucket.sessions += 1
    if (!bucket.gymIds.includes(row.gymId)) bucket.gymIds.push(row.gymId)
    bucket.intervals.push({
      start: row.checkedInAt.toISOString(),
      end: new Date(end).toISOString(),
    })
  }

  const withSessions = days.filter((d) => d.sessions > 0)
  let busiestDay: ActivityDayHighlight | null = null
  let quietestDay: ActivityDayHighlight | null = null
  for (const d of withSessions) {
    const highlight = { date: d.date, minutes: d.minutes, sessions: d.sessions }
    if (!busiestDay || d.minutes > busiestDay.minutes) busiestDay = highlight
    if (!quietestDay || d.minutes < quietestDay.minutes) quietestDay = highlight
  }
  if (busiestDay && quietestDay && busiestDay.date === quietestDay.date) {
    quietestDay = null
  }

  return {
    range,
    timezone: 'Europe/Moscow',
    generatedAt: now.toISOString(),
    totalMinutes: days.reduce((sum, d) => sum + d.minutes, 0),
    totalSessions: days.reduce((sum, d) => sum + d.sessions, 0),
    streakDays: computeStreak(days, todayKey),
    busiestDay,
    quietestDay,
    days,
  }
}
