import { env } from '../env.js'
import { prisma } from '../db.js'
import {
  bestSet,
  displayExerciseName,
  exerciseIdentity,
  num,
  round1,
  sessionInclude,
} from './workouts.js'

export const COACH_DATA_GATE_SESSIONS = 4
export const COACH_DATA_GATE_DAYS = 21
export const COACH_SESSION_CAP = 80

const MSK = 'Europe/Moscow'
const DAY_EN_TO_RU: Record<string, string> = {
  Mon: 'Пн',
  Tue: 'Вт',
  Wed: 'Ср',
  Thu: 'Чт',
  Fri: 'Пт',
  Sat: 'Сб',
  Sun: 'Вс',
}
const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
}

const LOWER_RE =
  /присед|squat|выпад|lunge|жим\s*ног|leg\s*press|разгибан|сгибан\w*\s*ног|румынск|станов|deadlift|ягодиц|hip\s*thrust|икр|calf|гакк|hack\s*squat|goblet|гиперэкстенз|good\s*morning|ягодичн|румынская|тяга\s*сумо/i
const DEADLIFT_RE = /станов|румынск|deadlift|тяга\s*сумо/i
const PULL_RE =
  /подтягив|pull[-\s]?up|тяга|row|широчай|бицепс|bicep|face\s*pull|пуловер|горизонтальн/i
const PUSH_RE =
  /жим|bench|грудь|chest|плеч|military|overhead|трицепс|tricep|дельт|отжим|push[-\s]?up|разведен|махи\s*в\s*сторон/i
const UPPER_RE =
  /жим|bench|грудь|chest|плеч|military|overhead|трицепс|tricep|дельт|отжим|push[-\s]?up|разведен|подтягив|тяга|row|бицепс|bicep|широчай|пуловер|махи/i

export type SplitCounts = {
  upper: number
  lower: number
  push: number
  pull: number
  unknown: number
}

export type CoachLiftFacts = {
  name: string
  identity: string
  sessionCount: number
  points: { at: string; weightKg: number; reps: number }[]
  plateau: boolean
  canAddWeight: boolean
  deltaWeightKg: number | null
  deltaReps: number | null
}

export type CoachLayer = {
  days: 7 | 30 | 90
  ready: boolean
  from: string
  to: string
  sessionCount: number
  prevSessionCount: number
  volume: number
  prevVolume: number
  volumeDeltaPct: number | null
  volumeSpiked: boolean
  slots: { planned: number; hit: number } | null
  split: SplitCounts
  titles: { title: string; count: number }[]
  body: { latestKg: number | null; deltaKg: number | null; points: number }
  lifts: CoachLiftFacts[]
  lastSets: { name: string; weightKg: number; reps: number }[]
  verdictHint: 'hit' | 'almost' | 'missed' | null
}

export type CoachFacts = {
  generatedAt: string
  profile: {
    experienceLevel: string
    sports: string[]
    gender: string
    ageBand: string
  }
  week: CoachLayer
  d30: CoachLayer
  d90: CoachLayer
  dataGate: {
    sessions21d: number
    eligible: boolean
    need: number
  }
}

type Slot = { day?: string; from?: string; to?: string }

type SessionRow = {
  id: string
  title: string
  performedAt: Date
  bodyWeightKg: unknown
  exercises: {
    name: string
    trackKey: string | null
    sets: { weightKg: unknown; reps: number }[]
  }[]
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function moscowParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: MSK,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value || ''
  return {
    weekdayEn: get('weekday'),
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
  }
}

function moscowYmd(date: Date) {
  const p = moscowParts(date)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

function moscowWeekdayRu(date: Date) {
  return DAY_EN_TO_RU[moscowParts(date).weekdayEn] || ''
}

export function startOfMoscowWeek(now = new Date()): Date {
  const p = moscowParts(now)
  const wd = WEEKDAY_INDEX[p.weekdayEn] ?? 0
  const civil = new Date(Date.UTC(p.year, p.month - 1, p.day))
  civil.setUTCDate(civil.getUTCDate() - wd)
  const y = civil.getUTCFullYear()
  const m = civil.getUTCMonth() + 1
  const d = civil.getUTCDate()
  return new Date(`${y}-${pad(m)}-${pad(d)}T00:00:00+03:00`)
}

export function coachPeriodBounds(now = new Date(), periodDays = 7): { start: Date; end: Date } {
  const weekStart = startOfMoscowWeek(now)
  const days = Number.isFinite(periodDays) ? Math.min(14, Math.max(1, Math.round(periodDays))) : 7
  if (days === 7) {
    return { start: weekStart, end: new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000) }
  }
  const origin = new Date('2024-01-01T00:00:00+03:00')
  const ms = days * 24 * 60 * 60 * 1000
  const n = Math.floor((now.getTime() - origin.getTime()) / ms)
  const start = new Date(origin.getTime() + n * ms)
  return { start, end: new Date(start.getTime() + ms) }
}

export function formatPeriodLabel(start: Date, end: Date) {
  const last = new Date(end.getTime() - 60 * 1000)
  const a = start.toLocaleDateString('ru-RU', { timeZone: MSK, day: 'numeric', month: 'short' })
  const b = last.toLocaleDateString('ru-RU', { timeZone: MSK, day: 'numeric', month: 'short' })
  return `${a} – ${b}`.replace(/\./g, '')
}

function ageBand(age: number) {
  if (age < 18) return 'до 18'
  if (age <= 24) return '18-24'
  if (age <= 34) return '25-34'
  if (age <= 44) return '35-44'
  if (age <= 54) return '45-54'
  return '55+'
}

function bodyKg(row: { bodyWeightKg: unknown }) {
  if (row.bodyWeightKg == null) return null
  const n = num(row.bodyWeightKg)
  return Number.isFinite(n) ? round1(n) : null
}

export function classifyExercise(name: string): SplitCounts {
  const split: SplitCounts = { upper: 0, lower: 0, push: 0, pull: 0, unknown: 0 }
  const n = name.trim()
  if (!n) {
    split.unknown = 1
    return split
  }
  const lower = LOWER_RE.test(n)
  if (lower) split.lower = 1
  if (PULL_RE.test(n) && !DEADLIFT_RE.test(n)) {
    split.pull = 1
    split.upper = 1
  }
  if (PUSH_RE.test(n) && !lower) {
    split.push = 1
    split.upper = 1
  } else if (UPPER_RE.test(n) && !lower) {
    split.upper = 1
  }
  if (!split.upper && !split.lower && !split.push && !split.pull) split.unknown = 1
  return split
}

function addSplit(a: SplitCounts, b: SplitCounts) {
  a.upper += b.upper
  a.lower += b.lower
  a.push += b.push
  a.pull += b.pull
  a.unknown += b.unknown
}

function emptySplit(): SplitCounts {
  return { upper: 0, lower: 0, push: 0, pull: 0, unknown: 0 }
}

function sessionVolume(row: SessionRow) {
  let v = 0
  for (const ex of row.exercises) {
    for (const s of ex.sets) {
      const w = num(s.weightKg)
      if (Number.isFinite(w) && s.reps > 0) v += w * s.reps
    }
  }
  return v
}

function inRange(at: Date, from: Date, to: Date) {
  return at >= from && at < to
}

function liftFactsForRows(rows: SessionRow[], plateauMin = 3): CoachLiftFacts[] {
  const byId = new Map<
    string,
    { name: string; identity: string; points: { at: string; weightKg: number; reps: number }[] }
  >()
  for (const row of rows) {
    const seen = new Set<string>()
    for (const ex of row.exercises) {
      const identity = exerciseIdentity(ex)
      if (!identity || seen.has(identity)) continue
      seen.add(identity)
      const best = bestSet(ex.sets)
      if (!best) continue
      const display = displayExerciseName(ex.name)
      const prev = byId.get(identity)
      const point = {
        at: row.performedAt.toISOString(),
        weightKg: round1(best.weightKg),
        reps: best.reps,
      }
      if (!prev) {
        byId.set(identity, { name: display, identity, points: [point] })
      } else {
        prev.points.push(point)
        if (display.length >= prev.name.length) prev.name = display
      }
    }
  }

  const lifts: CoachLiftFacts[] = []
  for (const lift of byId.values()) {
    const pts = lift.points
    const sessionCount = pts.length
    const first = pts[0]
    const last = pts[pts.length - 1]
    const deltaWeightKg =
      sessionCount >= 2 ? round1(last.weightKg - first.weightKg) : null
    const deltaReps = sessionCount >= 2 ? last.reps - first.reps : null

    const tail = pts.slice(-plateauMin)
    let plateau = false
    if (tail.length >= plateauMin) {
      const w0 = tail[0].weightKg
      const r0 = tail[0].reps
      const weightFlat = tail.every((p) => p.weightKg <= w0 + 0.05)
      const repsNotUp = tail.every((p) => p.reps <= r0)
      plateau = weightFlat && repsNotUp
    }

    let canAddWeight = false
    if (pts.length >= 2) {
      const a = pts[pts.length - 2]
      const b = pts[pts.length - 1]
      const sameWeight = Math.abs(a.weightKg - b.weightKg) <= 0.6
      canAddWeight = sameWeight && b.reps >= 6 && b.reps >= a.reps && b.reps >= 8
    }

    lifts.push({
      name: lift.name,
      identity: lift.identity,
      sessionCount,
      points: pts,
      plateau,
      canAddWeight,
      deltaWeightKg,
      deltaReps,
    })
  }

  lifts.sort((a, b) => b.sessionCount - a.sessionCount)
  return lifts
}

function lastSetsFromRows(rows: SessionRow[], lifts: CoachLiftFacts[]) {
  const latest = new Map<string, { name: string; weightKg: number; reps: number; at: number }>()
  for (const row of rows) {
    for (const ex of row.exercises) {
      const identity = exerciseIdentity(ex)
      if (!identity) continue
      const best = bestSet(ex.sets)
      if (!best) continue
      const prev = latest.get(identity)
      const at = row.performedAt.getTime()
      if (!prev || at >= prev.at) {
        latest.set(identity, {
          name: displayExerciseName(ex.name),
          weightKg: round1(best.weightKg),
          reps: best.reps,
          at,
        })
      }
    }
  }
  const preferred = lifts.slice(0, 8).map((l) => l.identity)
  const out: { name: string; weightKg: number; reps: number }[] = []
  const seen = new Set<string>()
  for (const id of preferred) {
    const row = latest.get(id)
    if (!row || seen.has(id)) continue
    seen.add(id)
    out.push({ name: row.name, weightKg: row.weightKg, reps: row.reps })
  }
  if (!out.length && rows.length) {
    const last = rows[rows.length - 1]
    for (const ex of last.exercises) {
      const best = bestSet(ex.sets)
      if (!best) continue
      out.push({
        name: displayExerciseName(ex.name),
        weightKg: round1(best.weightKg),
        reps: best.reps,
      })
    }
  }
  return out.slice(0, 8)
}

function titleMix(rows: SessionRow[]) {
  const map = new Map<string, number>()
  for (const row of rows) {
    const t = row.title.trim() || 'Тренировка'
    map.set(t, (map.get(t) || 0) + 1)
  }
  return [...map.entries()]
    .map(([title, count]) => ({ title, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
}

function bodyTrend(rows: SessionRow[]) {
  const points = rows
    .map((r) => {
      const kg = bodyKg(r)
      if (kg == null) return null
      return kg
    })
    .filter((n): n is number => n != null)
  const latestKg = points.length ? points[points.length - 1] : null
  const deltaKg = points.length >= 2 ? round1(points[points.length - 1] - points[0]) : null
  return { latestKg, deltaKg, points: points.length }
}

function splitForRows(rows: SessionRow[]): SplitCounts {
  const split = emptySplit()
  for (const row of rows) {
    for (const ex of row.exercises) {
      addSplit(split, classifyExercise(ex.name))
    }
  }
  return split
}

function plannedSlots(visitSlots: unknown, from: Date, to: Date) {
  const slots = Array.isArray(visitSlots) ? (visitSlots as Slot[]) : []
  const days = new Set<string>()
  for (let t = from.getTime(); t < to.getTime(); t += 24 * 60 * 60 * 1000) {
    const d = new Date(t + 12 * 60 * 60 * 1000)
    days.add(moscowWeekdayRu(d))
  }
  let planned = 0
  for (const slot of slots) {
    if (slot?.day && days.has(slot.day)) planned += 1
  }
  return planned
}

function hitSlots(rows: SessionRow[], visitSlots: unknown) {
  const slots = Array.isArray(visitSlots) ? (visitSlots as Slot[]) : []
  const days = new Set(slots.map((s) => s?.day).filter(Boolean) as string[])
  if (!days.size) return rows.length
  const seen = new Set<string>()
  for (const row of rows) {
    const ru = moscowWeekdayRu(row.performedAt)
    if (days.has(ru)) seen.add(moscowYmd(row.performedAt))
  }
  return seen.size
}

function verdictHint(
  sessionCount: number,
  prevSessionCount: number,
  slots: { planned: number; hit: number } | null,
): 'hit' | 'almost' | 'missed' {
  if (slots && slots.planned > 0) {
    if (sessionCount <= 0) return 'missed'
    if (slots.hit >= slots.planned || sessionCount >= slots.planned) return 'hit'
    return 'almost'
  }
  if (sessionCount <= 0) return 'missed'
  if (sessionCount >= 3 || (prevSessionCount > 0 && sessionCount >= prevSessionCount)) return 'hit'
  return 'almost'
}

function buildLayer(
  days: 7 | 30 | 90,
  all: SessionRow[],
  from: Date,
  to: Date,
  visitSlots: unknown,
  opts: { readyMinSessions: number; readyMinLiftPoints: number; plateauMin: number },
): CoachLayer {
  const span = Math.max(1, to.getTime() - from.getTime())
  const prevTo = from
  const prevFrom = new Date(from.getTime() - span)
  const rows = all.filter((r) => inRange(r.performedAt, from, to))
  const prev = all.filter((r) => inRange(r.performedAt, prevFrom, prevTo))
  const volume = round1(rows.reduce((s, r) => s + sessionVolume(r), 0))
  const prevVolume = round1(prev.reduce((s, r) => s + sessionVolume(r), 0))
  const volumeDeltaPct =
    prevVolume > 0 ? Math.round(((volume - prevVolume) / prevVolume) * 100) : null
  const lifts = liftFactsForRows(rows, opts.plateauMin)
  const slotsPlanned = days === 7 ? plannedSlots(visitSlots, from, to) : 0
  const slots =
    days === 7 && slotsPlanned > 0
      ? { planned: slotsPlanned, hit: hitSlots(rows, visitSlots) }
      : null
  const ready =
    rows.length >= opts.readyMinSessions &&
    lifts.some((l) => l.sessionCount >= opts.readyMinLiftPoints)
  return {
    days,
    ready: days === 7 ? rows.length >= 1 : ready,
    from: from.toISOString(),
    to: to.toISOString(),
    sessionCount: rows.length,
    prevSessionCount: prev.length,
    volume,
    prevVolume,
    volumeDeltaPct,
    volumeSpiked: volumeDeltaPct != null && volumeDeltaPct >= 40,
    slots,
    split: splitForRows(rows),
    titles: titleMix(rows),
    body: bodyTrend(rows),
    lifts: lifts.slice(0, days === 7 ? 8 : 12).map((l) => ({
      ...l,
      points: l.points.slice(-8),
    })),
    lastSets: lastSetsFromRows(rows, lifts),
    verdictHint: days === 7 ? verdictHint(rows.length, prev.length, slots) : null,
  }
}

export async function buildCoachFacts(userId: string): Promise<CoachFacts | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      experienceLevel: true,
      sports: true,
      gender: true,
      age: true,
      visitSlots: true,
      deletedAt: true,
    },
  })
  if (!user || user.deletedAt) return null

  const now = new Date()
  const { start: weekStart, end: weekEnd } = coachPeriodBounds(now, env.gigachatCoachPeriodDays)
  const weekTo = now < weekEnd ? now : weekEnd
  const since = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
  const raw = await prisma.workoutSession.findMany({
    where: { userId, performedAt: { gte: since } },
    orderBy: [{ performedAt: 'desc' }, { id: 'desc' }],
    take: COACH_SESSION_CAP,
    include: sessionInclude,
  })
  const rows: SessionRow[] = [...raw].reverse().map((r) => ({
    id: r.id,
    title: r.title,
    performedAt: r.performedAt,
    bodyWeightKg: r.bodyWeightKg,
    exercises: r.exercises.map((ex) => ({
      name: ex.name,
      trackKey: ex.trackKey,
      sets: ex.sets,
    })),
  }))

  const gateSince = new Date(now.getTime() - COACH_DATA_GATE_DAYS * 24 * 60 * 60 * 1000)
  const sessions21d = rows.filter((r) => r.performedAt >= gateSince).length
  const eligible = sessions21d >= COACH_DATA_GATE_SESSIONS

  return {
    generatedAt: now.toISOString(),
    profile: {
      experienceLevel: user.experienceLevel,
      sports: Array.isArray(user.sports) ? user.sports.slice(0, 8) : [],
      gender: user.gender,
      ageBand: ageBand(user.age),
    },
    week: buildLayer(7, rows, weekStart, weekTo, user.visitSlots, {
      readyMinSessions: 1,
      readyMinLiftPoints: 1,
      plateauMin: 3,
    }),
    d30: buildLayer(
      30,
      rows,
      new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      now,
      user.visitSlots,
      {
        readyMinSessions: 4,
        readyMinLiftPoints: 3,
        plateauMin: 3,
      },
    ),
    d90: buildLayer(
      90,
      rows,
      new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
      now,
      user.visitSlots,
      {
        readyMinSessions: 8,
        readyMinLiftPoints: 4,
        plateauMin: 4,
      },
    ),
    dataGate: {
      sessions21d,
      eligible,
      need: Math.max(0, COACH_DATA_GATE_SESSIONS - sessions21d),
    },
  }
}

export function factsForModel(facts: CoachFacts) {
  const slimLift = (l: CoachLiftFacts) => ({
    name: l.name,
    sessionCount: l.sessionCount,
    last: l.points[l.points.length - 1] || null,
    prev: l.points.length >= 2 ? l.points[l.points.length - 2] : null,
    deltaWeightKg: l.deltaWeightKg,
    deltaReps: l.deltaReps,
    plateau: l.plateau,
    canAddWeight: l.canAddWeight,
  })
  const slimLayer = (layer: CoachLayer) => ({
    days: layer.days,
    ready: layer.ready,
    sessionCount: layer.sessionCount,
    prevSessionCount: layer.prevSessionCount,
    volume: layer.volume,
    prevVolume: layer.prevVolume,
    volumeDeltaPct: layer.volumeDeltaPct,
    volumeSpiked: layer.volumeSpiked,
    slots: layer.slots,
    split: layer.split,
    titles: layer.titles,
    body: layer.body,
    lastSets: layer.lastSets,
    verdictHint: layer.verdictHint,
    lifts: layer.lifts.map(slimLift),
  })
  return {
    profile: facts.profile,
    week: slimLayer(facts.week),
    d30: slimLayer(facts.d30),
    d90: slimLayer(facts.d90),
  }
}
