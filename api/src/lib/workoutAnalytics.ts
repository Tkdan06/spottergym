import { moscowDayKey, moscowDayStartUtc } from './adminAnalytics.js'
import {
  bestSet,
  displayExerciseName,
  exerciseIdentity,
  num,
  round1,
  type WorkoutProgressRange,
} from './workouts.js'

const DAY_MS = 24 * 60 * 60 * 1000
const WEIGHT_FLAT_KG = 1.25
const WEIGHT_FLAT_PCT = 2.5
const PLATEAU_MIN_SESSIONS = 3
const PLATEAU_MIN_SPAN_DAYS = 14

export type WorkoutExerciseTrend = 'improving' | 'stable' | 'declining' | 'insufficient_data'

export type WorkoutBestSet = { weightKg: number; reps: number; at?: string }

export type WorkoutPeriodDelta = {
  current: number
  previous: number
  delta: number
  deltaPercent: number | null
}

export type WorkoutPrKind = 'weight' | 'setVolume'

export type WorkoutPrItem = {
  name: string
  at: string
  weightKg: number
  reps: number
  kind: WorkoutPrKind
  /** Best before this set; null = first logged working set of the lift. */
  prevWeightKg?: number | null
  prevReps?: number | null
}

export type WorkoutPlateauExplain = {
  sessionCount: number
  spanDays: number
  minWeightKg: number | null
  maxWeightKg: number | null
  weightDeltaKg: number | null
  repsDelta: number | null
}

export type WorkoutExerciseInsight = {
  identity: string
  name: string
  sessionCount: number
  setCount: number
  volume: number
  maxWeightKg: number | null
  bestSet: WorkoutBestSet | null
  firstBest: WorkoutBestSet | null
  lastBest: WorkoutBestSet | null
  weightDeltaKg: number | null
  repsDelta: number | null
  weightDeltaPercent: number | null
  volumeDelta: number | null
  volumeDeltaPercent: number | null
  trend: WorkoutExerciseTrend
  plateauCandidate: boolean
  plateau: WorkoutPlateauExplain
}

export type WorkoutActivitySummary = {
  visits: number
  totalMinutes: number
  avgMinutes: number
}

export type WorkoutInsights = {
  workoutCount: WorkoutPeriodDelta
  frequency: { currentPerWeek: number; previousPerWeek: number }
  volume: WorkoutPeriodDelta
  consistency: {
    trainingDays: number
    sessionCount: number
    perWeek: number
    consecutiveWeeks: number
  }
  prs: { count: number; items: WorkoutPrItem[] }
  exercises: WorkoutExerciseInsight[]
  improving: WorkoutExerciseInsight[]
  plateauCandidates: WorkoutExerciseInsight[]
  activity: WorkoutActivitySummary | null
}

export type AnalyticsSet = { weightKg: unknown; reps: number }
export type AnalyticsExercise = {
  name: string
  trackKey?: string | null
  sets: AnalyticsSet[]
}
export type AnalyticsSession = {
  performedAt: Date
  exercises: AnalyticsExercise[]
}

export type ActivityStatsInput = {
  totalSessions: number
  totalMinutes: number
}

export function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return null
  return round1(((current - previous) / previous) * 100)
}

export function periodDelta(current: number, previous: number): WorkoutPeriodDelta {
  return {
    current,
    previous,
    delta: round1(current - previous),
    deltaPercent: pctDelta(current, previous),
  }
}

/** Working-set volume: weight × reps, only weight > 0 and reps > 0. */
export function setsVolume(sets: AnalyticsSet[]): number {
  let v = 0
  for (const s of sets) {
    if (!Number.isFinite(s.reps) || s.reps <= 0) continue
    const w = num(s.weightKg)
    if (Number.isFinite(w) && w > 0) v += w * s.reps
  }
  return v
}

export function sessionVolume(row: AnalyticsSession): number {
  let v = 0
  for (const ex of row.exercises) v += setsVolume(ex.sets)
  return v
}

export function periodBounds(range: WorkoutProgressRange, now: Date) {
  const currentStart = new Date(now.getTime() - range * DAY_MS)
  const previousStart = new Date(now.getTime() - 2 * range * DAY_MS)
  return { currentStart, previousStart, now }
}

export function splitSessions(
  sessions: AnalyticsSession[],
  range: WorkoutProgressRange,
  now: Date,
) {
  const { currentStart, previousStart } = periodBounds(range, now)
  const current: AnalyticsSession[] = []
  const previous: AnalyticsSession[] = []
  const nowMs = now.getTime()
  for (const row of sessions) {
    const t = row.performedAt.getTime()
    if (t > nowMs) continue
    if (t >= currentStart.getTime()) current.push(row)
    else if (t >= previousStart.getTime()) previous.push(row)
  }
  return { current, previous, currentStart, previousStart }
}

function weightPctChange(first: number, last: number): number | null {
  if (first <= 0) return null
  return round1(((last - first) / first) * 100)
}

function weightGrew(first: number, last: number): boolean {
  const pct = weightPctChange(first, last)
  return pct != null && pct > WEIGHT_FLAT_PCT
}

function weightDropped(first: number, last: number): boolean {
  const pct = weightPctChange(first, last)
  return pct != null && pct < -WEIGHT_FLAT_PCT
}

function weightNearlyFlat(first: number, last: number): boolean {
  const d = Math.abs(last - first)
  const pct = first <= 0 ? (d === 0 ? 0 : Infinity) : (d / first) * 100
  return d <= WEIGHT_FLAT_KG && pct <= WEIGHT_FLAT_PCT
}

export function classifyTrend(
  sessionCount: number,
  first: WorkoutBestSet | null,
  last: WorkoutBestSet | null,
): WorkoutExerciseTrend {
  if (sessionCount < 2 || !first || !last) return 'insufficient_data'
  if (weightGrew(first.weightKg, last.weightKg)) return 'improving'
  if (weightNearlyFlat(first.weightKg, last.weightKg) && last.reps - first.reps >= 1) {
    return 'improving'
  }
  if (weightDropped(first.weightKg, last.weightKg)) return 'declining'
  if (last.weightKg <= first.weightKg && last.reps - first.reps <= -1) return 'declining'
  return 'stable'
}

function rangeSpanDays(minWeight: number, maxWeight: number): boolean {
  const span = maxWeight - minWeight
  const pct = minWeight <= 0 ? (span === 0 ? 0 : Infinity) : (span / minWeight) * 100
  return span <= WEIGHT_FLAT_KG || pct <= WEIGHT_FLAT_PCT
}

export function isPlateauCandidate(opts: {
  range: WorkoutProgressRange
  sessionCount: number
  spanDays: number
  minWeightKg: number | null
  maxWeightKg: number | null
  repsDelta: number | null
  trend: WorkoutExerciseTrend
}): boolean {
  if (opts.range === 7) return false
  if (opts.sessionCount < PLATEAU_MIN_SESSIONS) return false
  if (opts.spanDays < PLATEAU_MIN_SPAN_DAYS) return false
  if (opts.trend === 'improving') return false
  if (opts.minWeightKg == null || opts.maxWeightKg == null) return false
  if (!rangeSpanDays(opts.minWeightKg, opts.maxWeightKg)) return false
  if (opts.repsDelta == null || Math.abs(opts.repsDelta) > 1) return false
  return true
}

export function activitySummaryFromStats(
  stats: ActivityStatsInput | null | undefined,
): WorkoutActivitySummary | null {
  if (!stats || stats.totalSessions <= 0) return null
  return {
    visits: stats.totalSessions,
    totalMinutes: stats.totalMinutes,
    avgMinutes: Math.round(stats.totalMinutes / stats.totalSessions),
  }
}

function perWeek(count: number, range: WorkoutProgressRange): number {
  return round1(count / (range / 7))
}

function addDaysKey(dayKey: string, days: number): string {
  const start = moscowDayStartUtc(dayKey)
  return moscowDayKey(new Date(start.getTime() + days * DAY_MS))
}

function moscowWeekStartKey(date: Date): string {
  const dayKey = moscowDayKey(date)
  const start = moscowDayStartUtc(dayKey)
  const shifted = new Date(date.getTime() + 3 * 60 * 60 * 1000)
  const utcDay = shifted.getUTCDay()
  const daysFromMonday = utcDay === 0 ? 6 : utcDay - 1
  return moscowDayKey(new Date(start.getTime() - daysFromMonday * DAY_MS))
}

export function consecutiveTrainingWeeks(dates: Date[], now: Date): number {
  if (!dates.length) return 0
  const weeks = new Set(dates.map(moscowWeekStartKey))
  let cursor = moscowWeekStartKey(now)
  if (!weeks.has(cursor)) cursor = addDaysKey(cursor, -7)
  let n = 0
  while (weeks.has(cursor)) {
    n += 1
    cursor = addDaysKey(cursor, -7)
  }
  return n
}

type LiftAcc = {
  identity: string
  name: string
  points: { at: Date; best: { weightKg: number; reps: number }; volume: number; setCount: number }[]
  volume: number
  setCount: number
  maxWeightKg: number
}

function mergeSessionLifts(row: AnalyticsSession) {
  const byId = new Map<string, { name: string; sets: AnalyticsSet[] }>()
  for (const ex of row.exercises) {
    const identity = exerciseIdentity(ex)
    if (!identity) continue
    const display = displayExerciseName(ex.name)
    const prev = byId.get(identity)
    if (!prev) {
      byId.set(identity, { name: display, sets: [...ex.sets] })
    } else {
      prev.sets.push(...ex.sets)
      if (display.length >= prev.name.length) prev.name = display
    }
  }
  return byId
}

function accumulate(rows: AnalyticsSession[]) {
  const byId = new Map<string, LiftAcc>()
  for (const row of rows) {
    for (const [identity, rec] of mergeSessionLifts(row)) {
      const best = bestSet(rec.sets)
      if (!best) continue
      const vol = setsVolume(rec.sets)
      const working = rec.sets.filter((s) => {
        if (s.reps <= 0) return false
        const w = num(s.weightKg)
        return Number.isFinite(w) && w > 0
      })
      let maxW = 0
      for (const s of working) maxW = Math.max(maxW, num(s.weightKg))
      const prev = byId.get(identity)
      const point = {
        at: row.performedAt,
        best: { weightKg: round1(best.weightKg), reps: best.reps },
        volume: vol,
        setCount: working.length,
      }
      if (!prev) {
        byId.set(identity, {
          identity,
          name: rec.name,
          points: [point],
          volume: vol,
          setCount: working.length,
          maxWeightKg: maxW,
        })
      } else {
        prev.points.push(point)
        prev.volume += vol
        prev.setCount += working.length
        prev.maxWeightKg = Math.max(prev.maxWeightKg, maxW)
        if (rec.name.length >= prev.name.length) prev.name = rec.name
      }
    }
  }
  return byId
}

function detectPrs(sessions: AnalyticsSession[], currentStart: Date, now: Date): WorkoutPrItem[] {
  const running = new Map<
    string,
    { maxWeight: number; maxVolume: number; repsAtMaxWeight: number; repsAtMaxVolume: number }
  >()
  const items: WorkoutPrItem[] = []
  const nowMs = now.getTime()

  for (const row of sessions) {
    const t = row.performedAt.getTime()
    if (t > nowMs) continue
    const inCurrent = t >= currentStart.getTime()
    const lifts = mergeSessionLifts(row)
    const sessionBest = new Map<string, WorkoutPrItem>()

    for (const [identity, rec] of lifts) {
      const prior = running.get(identity)
      for (const s of rec.sets) {
        if (s.reps <= 0) continue
        const w = num(s.weightKg)
        if (!Number.isFinite(w) || w <= 0) continue
        const vol = w * s.reps
        if (!inCurrent) continue
        const beatWeight = !prior || w > prior.maxWeight
        const beatVolume = !prior || vol > prior.maxVolume
        if (!beatWeight && !beatVolume) continue
        const kind: WorkoutPrKind = beatWeight ? 'weight' : 'setVolume'
        const existing = sessionBest.get(identity)
        if (existing && existing.kind === 'weight') continue
        if (existing && kind === 'setVolume') continue
        sessionBest.set(identity, {
          name: rec.name,
          at: row.performedAt.toISOString(),
          weightKg: round1(w),
          reps: s.reps,
          kind,
          prevWeightKg: prior ? round1(prior.maxWeight) : null,
          prevReps: prior
            ? kind === 'weight'
              ? prior.repsAtMaxWeight
              : prior.repsAtMaxVolume
            : null,
        })
      }
    }

    for (const item of sessionBest.values()) items.push(item)

    for (const [identity, rec] of lifts) {
      const next = running.get(identity) || {
        maxWeight: 0,
        maxVolume: 0,
        repsAtMaxWeight: 0,
        repsAtMaxVolume: 0,
      }
      for (const s of rec.sets) {
        if (s.reps <= 0) continue
        const w = num(s.weightKg)
        if (!Number.isFinite(w) || w <= 0) continue
        const vol = w * s.reps
        if (w > next.maxWeight) {
          next.maxWeight = w
          next.repsAtMaxWeight = s.reps
        }
        if (vol > next.maxVolume) {
          next.maxVolume = vol
          next.repsAtMaxVolume = s.reps
        }
      }
      running.set(identity, next)
    }
  }

  return items
}

function pickImproving(exercises: WorkoutExerciseInsight[]): WorkoutExerciseInsight[] {
  return exercises
    .filter((e) => e.trend === 'improving')
    .sort((a, b) => {
      const aw = Math.abs(a.weightDeltaPercent ?? 0)
      const bw = Math.abs(b.weightDeltaPercent ?? 0)
      if (bw !== aw) return bw - aw
      return (b.volumeDeltaPercent ?? 0) - (a.volumeDeltaPercent ?? 0)
    })
    .slice(0, 5)
}

function pickPlateau(exercises: WorkoutExerciseInsight[]): WorkoutExerciseInsight[] {
  return exercises
    .filter((e) => e.plateauCandidate)
    .sort((a, b) => b.sessionCount - a.sessionCount || b.volume - a.volume)
    .slice(0, 3)
}

export function buildWorkoutInsights(
  range: WorkoutProgressRange,
  sessions: AnalyticsSession[],
  activity?: ActivityStatsInput | null,
  now: Date = new Date(),
): WorkoutInsights {
  const nowMs = now.getTime()
  const chronological = [...sessions]
    .filter((row) => row.performedAt.getTime() <= nowMs)
    .sort((a, b) => a.performedAt.getTime() - b.performedAt.getTime())
  const { current, previous, currentStart } = splitSessions(chronological, range, now)

  const currentVolume = current.reduce((sum, row) => sum + sessionVolume(row), 0)
  const previousVolume = previous.reduce((sum, row) => sum + sessionVolume(row), 0)

  const currentLifts = accumulate(current)
  const previousLifts = accumulate(previous)

  const exercises: WorkoutExerciseInsight[] = [...currentLifts.values()]
    .sort((a, b) => b.points.length - a.points.length || b.volume - a.volume)
    .map((lift) => {
      const first = lift.points[0]
      const last = lift.points[lift.points.length - 1]
      const firstBest: WorkoutBestSet | null = first
        ? { ...first.best, at: first.at.toISOString() }
        : null
      const lastBest: WorkoutBestSet | null = last
        ? { ...last.best, at: last.at.toISOString() }
        : null
      const sessionCount = lift.points.length
      const weightDeltaKg =
        firstBest && lastBest && sessionCount >= 2
          ? round1(lastBest.weightKg - firstBest.weightKg)
          : null
      const repsDelta =
        firstBest && lastBest && sessionCount >= 2 ? lastBest.reps - firstBest.reps : null
      const weightDeltaPercent =
        firstBest && lastBest && sessionCount >= 2
          ? weightPctChange(firstBest.weightKg, lastBest.weightKg)
          : null
      const prevVol = previousLifts.get(lift.identity)?.volume ?? 0
      const volumeDelta = round1(lift.volume - prevVol)
      const volumeDeltaPercent = pctDelta(lift.volume, prevVol)
      const trend = classifyTrend(sessionCount, firstBest, lastBest)
      const weights = lift.points.map((p) => p.best.weightKg)
      const minWeightKg = weights.length ? Math.min(...weights) : null
      const maxBest = weights.length ? Math.max(...weights) : null
      const spanDays =
        first && last ? (last.at.getTime() - first.at.getTime()) / DAY_MS : 0
      const plateau: WorkoutPlateauExplain = {
        sessionCount,
        spanDays: round1(spanDays),
        minWeightKg: minWeightKg != null ? round1(minWeightKg) : null,
        maxWeightKg: maxBest != null ? round1(maxBest) : null,
        weightDeltaKg,
        repsDelta,
      }
      const plateauCandidate = isPlateauCandidate({
        range,
        sessionCount,
        spanDays,
        minWeightKg,
        maxWeightKg: maxBest,
        repsDelta,
        trend,
      })
      const overallBest = lift.points.reduce(
        (best, p) => {
          if (!best) return p.best
          if (p.best.weightKg > best.weightKg) return p.best
          if (p.best.weightKg === best.weightKg && p.best.reps > best.reps) return p.best
          return best
        },
        null as { weightKg: number; reps: number } | null,
      )

      return {
        identity: lift.identity,
        name: lift.name,
        sessionCount,
        setCount: lift.setCount,
        volume: round1(lift.volume),
        maxWeightKg: lift.maxWeightKg > 0 ? round1(lift.maxWeightKg) : null,
        bestSet: overallBest,
        firstBest,
        lastBest,
        weightDeltaKg,
        repsDelta,
        weightDeltaPercent,
        volumeDelta,
        volumeDeltaPercent,
        trend,
        plateauCandidate,
        plateau,
      }
    })

  const prItems = detectPrs(chronological, currentStart, now)
  const trainingDates = current.map((row) => row.performedAt)
  const trainingDays = new Set(trainingDates.map((d) => moscowDayKey(d))).size
  const freqCurrent = perWeek(current.length, range)
  const freqPrevious = perWeek(previous.length, range)

  return {
    workoutCount: periodDelta(current.length, previous.length),
    frequency: { currentPerWeek: freqCurrent, previousPerWeek: freqPrevious },
    volume: {
      current: round1(currentVolume),
      previous: round1(previousVolume),
      delta: round1(currentVolume - previousVolume),
      deltaPercent: pctDelta(currentVolume, previousVolume),
    },
    consistency: {
      trainingDays,
      sessionCount: current.length,
      perWeek: freqCurrent,
      consecutiveWeeks: consecutiveTrainingWeeks(trainingDates, now),
    },
    prs: { count: prItems.length, items: prItems },
    exercises,
    improving: pickImproving(exercises),
    plateauCandidates: pickPlateau(exercises),
    activity: activitySummaryFromStats(activity),
  }
}
