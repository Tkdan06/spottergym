import type { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import { buildMyActivityStats } from './activityStats.js'
import { WORKOUT_NOTE_MAX } from './fieldLimits.js'
import { invalidateUserWorkoutInsights } from './insightClaim.js'
import type { PeriodRange } from './periodRange.js'
import { buildWorkoutInsights, type WorkoutInsights } from './workoutAnalytics.js'

export type WorkoutSetDto = {
  id?: string
  setIndex: number
  weightKg: number
  reps: number
  /** Vs the same set index in the previous matching session */
  weightDelta?: number | null
  repsDelta?: number | null
}

export type WorkoutExerciseDto = {
  id?: string
  name: string
  /** Stable across renames; empty on legacy rows → name matching. */
  trackKey?: string
  sortOrder: number
  sets: WorkoutSetDto[]
}

export type WorkoutFelt = 'easy' | 'normal' | 'hard'

export const WORKOUT_FELT_VALUES = ['easy', 'normal', 'hard'] as const

export type WorkoutSessionSummary = {
  id: string
  title: string
  performedAt: string
  bodyWeightKg: number | null
  notes: string
  feedback: WorkoutFelt | null
  exerciseCount: number
  setCount: number
  exercises: WorkoutExercisePreview[]
  createdAt: string
  updatedAt: string
}

export type WorkoutSessionDetail = {
  id: string
  title: string
  performedAt: string
  bodyWeightKg: number | null
  notes: string
  feedback: WorkoutFelt | null
  exercises: WorkoutExerciseDto[]
  createdAt: string
  updatedAt: string
}

export type WorkoutProgressRange = PeriodRange

export type { WorkoutInsights } from './workoutAnalytics.js'

export type WorkoutProgress = {
  range: WorkoutProgressRange
  body: {
    points: { at: string; kg: number }[]
    latestKg: number | null
    deltaKg: number | null
  }
  exercises: { name: string; sessionCount: number }[]
  strength: {
    exercise: string | null
    points: { at: string; weightKg: number; reps: number }[]
    latestWeightKg: number | null
    deltaWeightKg: number | null
    deltaReps: number | null
  }
  highlight: {
    bodyLatestKg: number | null
    bodyDeltaKg: number | null
    liftName: string | null
    liftDeltaWeightKg: number | null
    liftDeltaReps: number | null
  }
  insights: WorkoutInsights
}

export const sessionInclude = {
  exercises: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      sets: { orderBy: { setIndex: 'asc' as const } },
    },
  },
} satisfies Prisma.WorkoutSessionInclude

type SessionFull = Prisma.WorkoutSessionGetPayload<{ include: typeof sessionInclude }>

/** Retention cap in DB. UI pages with WORKOUT_LIST_PAGE_SIZE. */
export const MAX_WORKOUT_SESSIONS = 600
export const WORKOUT_LIST_PAGE_SIZE = 20

const listInclude = {
  exercises: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      name: true,
      trackKey: true,
      sortOrder: true,
      sets: {
        orderBy: { setIndex: 'asc' as const },
        select: { weightKg: true, reps: true, setIndex: true },
      },
    },
  },
} satisfies Prisma.WorkoutSessionInclude

type SessionListRow = Prisma.WorkoutSessionGetPayload<{ include: typeof listInclude }>

export type WorkoutSetPreview = {
  weightKg: number
  reps: number
  weightDelta?: number | null
  repsDelta?: number | null
}

export type WorkoutExercisePreview = {
  name: string
  sets: WorkoutSetPreview[]
}

export function num(d: unknown) {
  if (typeof d === 'number') return d
  if (typeof d === 'string') return Number(d)
  if (
    d &&
    typeof d === 'object' &&
    'toNumber' in d &&
    typeof (d as { toNumber: () => number }).toNumber === 'function'
  ) {
    return (d as { toNumber: () => number }).toNumber()
  }
  return Number(d)
}

export function round1(n: number) {
  return Math.round(n * 10) / 10
}

function bodyKg(row: { bodyWeightKg: unknown }) {
  if (row.bodyWeightKg == null) return null
  const n = num(row.bodyWeightKg)
  return Number.isFinite(n) ? round1(n) : null
}

export function isWorkingSet(s: { weightKg: unknown; reps: unknown }) {
  const w = num(s.weightKg)
  const r = typeof s.reps === 'number' ? s.reps : Number(s.reps)
  return Number.isFinite(w) && w > 0 && Number.isFinite(r) && r > 0
}

export function bestSet(sets: { weightKg: unknown; reps: number }[]) {
  let best: { weightKg: number; reps: number } | null = null
  for (const s of sets) {
    if (!isWorkingSet(s)) continue
    const w = num(s.weightKg)
    if (!best || w > best.weightKg || (w === best.weightKg && s.reps > best.reps)) {
      best = { weightKg: w, reps: s.reps }
    }
  }
  return best
}

function normalizeTitle(title: string) {
  return title.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function normalizeExerciseName(name: string) {
  return name.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ')
}

export function displayExerciseName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

export function parseWorkoutFelt(raw: unknown): WorkoutFelt | null {
  if (raw == null) return null
  if (raw === 'easy' || raw === 'normal' || raw === 'hard') return raw
  throw new Error('invalid_felt')
}

export type WorkoutFeltPoint = { at: string; feedback: WorkoutFelt | null }

export function feltTimeline(
  sessions: { performedAt: Date; feedback: WorkoutFelt | null }[],
  currentStart: Date,
  limit = 20,
  now: Date = new Date(),
): WorkoutFeltPoint[] {
  const nowMs = now.getTime()
  return sessions
    .filter((row) => {
      const t = row.performedAt.getTime()
      return t >= currentStart.getTime() && t <= nowMs
    })
    .sort((a, b) => a.performedAt.getTime() - b.performedAt.getTime())
    .slice(-limit)
    .map((row) => ({
      at: row.performedAt.toISOString(),
      feedback: row.feedback,
    }))
}

export function normalizeTrackKey(raw: string | undefined | null) {
  const t = String(raw || '')
    .trim()
    .slice(0, 64)
  if (!t) return ''
  if (!/^[a-zA-Z0-9_-]+$/.test(t)) return ''
  return t
}

/** Match key for deltas/progress: prefer trackKey, else normalized name. */
export function exerciseIdentity(ex: { name: string; trackKey?: string | null }) {
  const tk = normalizeTrackKey(ex.trackKey)
  if (tk) return `k:${tk}`
  const n = normalizeExerciseName(ex.name)
  return n ? `n:${n}` : ''
}

function newTrackKey() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 24)
}

export type ExerciseTrackIndex = {
  knownKeys: Set<string>
  nameToKey: Map<string, string>
  namelessNames: Set<string>
}

/** Newest-first rows: first keyed name wins. Does not rewrite history. */
export function buildExerciseTrackIndex(
  rows: { name: string; trackKey?: string | null }[],
): ExerciseTrackIndex {
  const knownKeys = new Set<string>()
  const nameToKey = new Map<string, string>()
  const namesWithKey = new Set<string>()
  const namelessNames = new Set<string>()
  for (const row of rows) {
    const key = normalizeTrackKey(row.trackKey)
    const name = normalizeExerciseName(row.name)
    if (key) {
      knownKeys.add(key)
      if (name && !nameToKey.has(name)) nameToKey.set(name, key)
      if (name) namesWithKey.add(name)
    } else if (name) {
      namelessNames.add(name)
    }
  }
  for (const n of namesWithKey) namelessNames.delete(n)
  return { knownKeys, nameToKey, namelessNames }
}

/**
 * Keep a client key only if it already exists in the user's history (copy / rename).
 * Otherwise reuse the key for the same normalized name, or stay nameless to match
 * legacy rows. Never invent a merge across different names.
 */
export function pickExerciseTrackKey(
  ex: { name: string; trackKey?: string | null },
  index: ExerciseTrackIndex,
): string {
  const clientKey = normalizeTrackKey(ex.trackKey)
  const name = normalizeExerciseName(ex.name)
  if (clientKey && index.knownKeys.has(clientKey)) return clientKey
  if (name) {
    const fromName = index.nameToKey.get(name)
    if (fromName) return fromName
    if (index.namelessNames.has(name)) return ''
  }
  return clientKey || newTrackKey()
}

async function resolveExerciseInputs(
  userId: string,
  exercises: WorkoutInput['exercises'],
): Promise<WorkoutInput['exercises']> {
  const sessions = await prisma.workoutSession.findMany({
    where: { userId },
    orderBy: { performedAt: 'desc' },
    take: 80,
    select: {
      exercises: { select: { name: true, trackKey: true } },
    },
  })
  const index = buildExerciseTrackIndex(sessions.flatMap((s) => s.exercises))
  return exercises.map((ex) => ({
    ...ex,
    trackKey: pickExerciseTrackKey(ex, index),
  }))
}

type PrevSetMap = Map<string, Map<number, { weightKg: number; reps: number }>>

function prevSetsByExercise(
  previous:
    | {
        exercises: {
          name: string
          trackKey?: string | null
          sets: { setIndex: number; weightKg: unknown; reps: number }[]
        }[]
      }
    | null
    | undefined,
): PrevSetMap {
  const map: PrevSetMap = new Map()
  if (!previous) return map
  for (const ex of previous.exercises) {
    const key = exerciseIdentity(ex)
    if (!key) continue
    const byIndex = new Map<number, { weightKg: number; reps: number }>()
    for (const s of ex.sets) {
      byIndex.set(s.setIndex, { weightKg: num(s.weightKg), reps: s.reps })
    }
    map.set(key, byIndex)
  }
  return map
}

function sessionIsOlder(
  a: { performedAt: Date; id: string },
  b: { performedAt: Date; id: string },
) {
  const da = a.performedAt.getTime()
  const db = b.performedAt.getTime()
  if (da !== db) return da < db
  return a.id < b.id
}

function findPreviousSameTitle<T extends { id: string; title: string; performedAt: Date }>(
  row: T,
  pool: T[],
): T | null {
  const title = normalizeTitle(row.title)
  let best: T | null = null
  for (const cand of pool) {
    if (cand.id === row.id) continue
    if (normalizeTitle(cand.title) !== title) continue
    if (!sessionIsOlder(cand, row)) continue
    if (!best || sessionIsOlder(best, cand)) best = cand
  }
  return best
}

export function serializeSessionSummary(
  row: SessionFull | SessionListRow,
  previous?: SessionFull | SessionListRow | null,
): WorkoutSessionSummary {
  const prevSets = prevSetsByExercise(previous)
  const exercises: WorkoutExercisePreview[] = row.exercises.map((ex) => {
    const prev = prevSets.get(exerciseIdentity(ex))
    return {
      name: ex.name,
      sets: ex.sets.map((s) => {
        const last = prev?.get(s.setIndex)
        const weightKg = round1(num(s.weightKg))
        return {
          weightKg,
          reps: s.reps,
          weightDelta: last ? Math.round((weightKg - last.weightKg) * 100) / 100 : null,
          repsDelta: last ? s.reps - last.reps : null,
        }
      }),
    }
  })
  const setCount = exercises.reduce((n, e) => n + e.sets.length, 0)
  return {
    id: row.id,
    title: row.title,
    performedAt: row.performedAt.toISOString(),
    bodyWeightKg: bodyKg(row),
    notes: row.notes || '',
    feedback: row.feedback ?? null,
    exerciseCount: exercises.length,
    setCount,
    exercises,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function serializeSessionDetail(
  row: SessionFull,
  previous: SessionFull | null,
): WorkoutSessionDetail {
  const prevSetsByEx = prevSetsByExercise(previous)

  const exercises: WorkoutExerciseDto[] = row.exercises.map((ex) => {
    const prevSets = prevSetsByEx.get(exerciseIdentity(ex))
    return {
      id: ex.id,
      name: ex.name,
      trackKey: normalizeTrackKey(ex.trackKey) || undefined,
      sortOrder: ex.sortOrder,
      sets: ex.sets.map((s) => {
        const prev = prevSets?.get(s.setIndex)
        return {
          id: s.id,
          setIndex: s.setIndex,
          weightKg: num(s.weightKg),
          reps: s.reps,
          weightDelta: prev ? Math.round((num(s.weightKg) - prev.weightKg) * 100) / 100 : null,
          repsDelta: prev ? s.reps - prev.reps : null,
        }
      }),
    }
  })

  return {
    id: row.id,
    title: row.title,
    performedAt: row.performedAt.toISOString(),
    bodyWeightKg: bodyKg(row),
    notes: row.notes || '',
    feedback: row.feedback ?? null,
    exercises,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listWorkoutSessions(
  userId: string,
  opts?: { limit?: number; beforePerformedAt?: string; beforeId?: string },
): Promise<{
  workouts: WorkoutSessionSummary[]
  hasMore: boolean
  totalCount: number
  atRetentionCap: boolean
}> {
  const limit = Math.min(
    50,
    Math.max(1, opts?.limit ?? WORKOUT_LIST_PAGE_SIZE),
  )
  const beforeAt = opts?.beforePerformedAt ? new Date(opts.beforePerformedAt) : null
  const beforeId = opts?.beforeId?.trim() || null
  const cursorOk =
    beforeAt && !Number.isNaN(beforeAt.getTime()) && beforeId
      ? { performedAt: beforeAt, id: beforeId }
      : null

  const [rows, totalCount] = await Promise.all([
    prisma.workoutSession.findMany({
      where: {
        userId,
        ...(cursorOk
          ? {
              OR: [
                { performedAt: { lt: cursorOk.performedAt } },
                {
                  AND: [
                    { performedAt: cursorOk.performedAt },
                    { id: { lt: cursorOk.id } },
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: [{ performedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: listInclude,
    }),
    prisma.workoutSession.count({ where: { userId } }),
  ])

  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows
  const titles = [...new Set(page.map((r) => r.title.trim()).filter(Boolean))]
  const extra =
    page.length && titles.length
      ? await prisma.workoutSession.findMany({
          where: {
            userId,
            id: { notIn: page.map((r) => r.id) },
            OR: titles.map((title) => ({ title: { equals: title, mode: 'insensitive' } })),
          },
          orderBy: [{ performedAt: 'desc' }, { id: 'desc' }],
          take: Math.min(80, Math.max(20, titles.length * 4)),
          include: listInclude,
        })
      : []
  const pool = [...page, ...extra]
  return {
    workouts: page.map((row) => serializeSessionSummary(row, findPreviousSameTitle(row, pool))),
    hasMore,
    totalCount,
    atRetentionCap: totalCount >= MAX_WORKOUT_SESSIONS,
  }
}

/** Drop oldest sessions when over retention cap (FIFO by performedAt). */
export async function pruneWorkoutSessionsIfNeeded(userId: string) {
  const count = await prisma.workoutSession.count({ where: { userId } })
  if (count <= MAX_WORKOUT_SESSIONS) return 0
  const excess = count - MAX_WORKOUT_SESSIONS
  const oldest = await prisma.workoutSession.findMany({
    where: { userId },
    orderBy: [{ performedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    take: excess,
    select: { id: true },
  })
  if (!oldest.length) return 0
  const result = await prisma.workoutSession.deleteMany({
    where: { id: { in: oldest.map((o) => o.id) } },
  })
  return result.count
}

export async function getWorkoutSession(
  userId: string,
  id: string,
): Promise<WorkoutSessionDetail | null> {
  const row = await prisma.workoutSession.findFirst({
    where: { id, userId },
    include: sessionInclude,
  })
  if (!row) return null

  const previous = await prisma.workoutSession.findFirst({
    where: {
      userId,
      performedAt: { lt: row.performedAt },
      id: { not: row.id },
    },
    orderBy: { performedAt: 'desc' },
    include: sessionInclude,
  })

  const previousSameTitle = await prisma.workoutSession.findFirst({
    where: {
      userId,
      performedAt: { lt: row.performedAt },
      id: { not: row.id },
      title: { equals: row.title, mode: 'insensitive' },
    },
    orderBy: { performedAt: 'desc' },
    include: sessionInclude,
  })

  let prev = previousSameTitle
  if (!prev && previous && normalizeTitle(previous.title) === normalizeTitle(row.title)) {
    prev = previous
  } else if (!prev) {
    const candidates = await prisma.workoutSession.findMany({
      where: { userId, performedAt: { lt: row.performedAt }, id: { not: row.id } },
      orderBy: { performedAt: 'desc' },
      take: 30,
      include: sessionInclude,
    })
    prev = candidates.find((c) => normalizeTitle(c.title) === normalizeTitle(row.title)) || null
  }

  return serializeSessionDetail(row, prev)
}

/**
 * Subjective feel for one session. Does not call GigaChat.
 * Analytics (no LandingEvent bus — same pattern as recap viewedAt):
 *   feedback_prompt_shown  → feedbackPromptedAt
 *   feedback_selected      → feedback + feedbackSetAt (value = easy|normal|hard)
 *   feedback_skipped       → promptedAt set and feedback still null
 */
export async function setWorkoutFeedback(
  userId: string,
  id: string,
  input: { feedback?: WorkoutFelt | null; prompted?: boolean },
): Promise<WorkoutSessionDetail | null> {
  const existing = await prisma.workoutSession.findFirst({
    where: { id, userId },
    select: { id: true, feedbackPromptedAt: true },
  })
  if (!existing) return null

  const data: {
    feedback?: WorkoutFelt | null
    feedbackSetAt?: Date | null
    feedbackPromptedAt?: Date
  } = {}
  if (input.prompted && !existing.feedbackPromptedAt) {
    data.feedbackPromptedAt = new Date()
  }
  if ('feedback' in input) {
    data.feedback = input.feedback ?? null
    data.feedbackSetAt = input.feedback ? new Date() : null
  }
  if (Object.keys(data).length) {
    await prisma.workoutSession.update({ where: { id }, data })
  }
  return getWorkoutSession(userId, id)
}

export type WorkoutInput = {
  title: string
  performedAt: Date
  bodyWeightKg?: number | null
  notes?: string
  exercises: {
    name: string
    trackKey?: string
    sets: { weightKg: number; reps: number }[]
  }[]
}

function normalizeBodyWeight(raw: number | null | undefined) {
  if (raw == null || Number.isNaN(raw)) return null
  if (raw < 30 || raw > 250) return null
  // Whole kg only (product: no 0.5 body weight)
  return Math.round(raw)
}

function normalizeNotes(raw: string | undefined | null) {
  return String(raw || '')
    .trim()
    .slice(0, WORKOUT_NOTE_MAX)
}

function exerciseCreates(exercises: WorkoutInput['exercises']) {
  return exercises
    .map((ex, i) => {
      const sets = ex.sets.filter((s) => isWorkingSet(s))
      return {
        name: ex.name.trim(),
        trackKey: normalizeTrackKey(ex.trackKey),
        sortOrder: i,
        sets: {
          create: sets.map((s, j) => ({
            setIndex: j,
            weightKg: s.weightKg,
            reps: s.reps,
          })),
        },
      }
    })
    .filter((ex) => ex.name && ex.sets.create.length)
}

export const PERFORMED_AT_FUTURE_SKEW_MS = 15 * 60 * 1000

export function isPerformedAtInFuture(d: Date, now = new Date()) {
  return d.getTime() > now.getTime() + PERFORMED_AT_FUTURE_SKEW_MS
}

export async function createWorkoutSession(userId: string, input: WorkoutInput) {
  const title = input.title.trim()
  const exercises = await resolveExerciseInputs(userId, input.exercises)
  const row = await prisma.workoutSession.create({
    data: {
      userId,
      title,
      performedAt: input.performedAt,
      bodyWeightKg: normalizeBodyWeight(input.bodyWeightKg),
      notes: normalizeNotes(input.notes),
      exercises: {
        create: exerciseCreates(exercises),
      },
    },
    include: sessionInclude,
  })
  await pruneWorkoutSessionsIfNeeded(userId)
  await invalidateUserWorkoutInsights(userId)
  return getWorkoutSession(userId, row.id)
}

export async function replaceWorkoutSession(userId: string, id: string, input: WorkoutInput) {
  const existing = await prisma.workoutSession.findFirst({ where: { id, userId } })
  if (!existing) return null

  const exercises = await resolveExerciseInputs(userId, input.exercises)

  await prisma.$transaction(async (tx) => {
    await tx.workoutExercise.deleteMany({ where: { sessionId: id } })
    await tx.workoutSession.update({
      where: { id },
      data: {
        title: input.title.trim(),
        performedAt: input.performedAt,
        bodyWeightKg: normalizeBodyWeight(input.bodyWeightKg),
        notes: normalizeNotes(input.notes),
        exercises: {
          create: exerciseCreates(exercises),
        },
      },
    })
  })

  await invalidateUserWorkoutInsights(userId)
  return getWorkoutSession(userId, id)
}

export async function deleteWorkoutSession(userId: string, id: string) {
  const result = await prisma.workoutSession.deleteMany({ where: { id, userId } })
  if (result.count > 0) await invalidateUserWorkoutInsights(userId)
  return result.count > 0
}

export async function getWorkoutProgress(
  userId: string,
  range: WorkoutProgressRange,
  exerciseQuery?: string,
): Promise<WorkoutProgress> {
  const now = new Date()
  const since = new Date(now.getTime() - range * 24 * 60 * 60 * 1000)
  const progressSelect = {
    performedAt: true,
    bodyWeightKg: true,
    exercises: {
      select: {
        name: true,
        trackKey: true,
        sets: { select: { weightKg: true, reps: true } },
      },
    },
  } as const

  const [allRows, activity] = await Promise.all([
    prisma.workoutSession.findMany({
      where: { userId },
      orderBy: { performedAt: 'desc' },
      // Cap matches retention: user never has more than MAX_WORKOUT_SESSIONS total.
      take: MAX_WORKOUT_SESSIONS,
      select: progressSelect,
    }),
    buildMyActivityStats(userId, range),
  ])

  const chronological = [...allRows].reverse()
  const nowMs = now.getTime()
  const rows = chronological.filter((r) => {
    const t = r.performedAt.getTime()
    return t >= since.getTime() && t <= nowMs
  })
  const insights = buildWorkoutInsights(
    range,
    chronological,
    { totalSessions: activity.totalSessions, totalMinutes: activity.totalMinutes },
    now,
  )

  const bodyPoints = rows
    .map((r) => {
      const kg = bodyKg(r)
      if (kg == null) return null
      return { at: r.performedAt.toISOString(), kg }
    })
    .filter((p): p is { at: string; kg: number } => Boolean(p))

  const bodyLatestKg = bodyPoints.length ? bodyPoints[bodyPoints.length - 1].kg : null
  const bodyDeltaKg =
    bodyPoints.length >= 2
      ? round1(bodyPoints[bodyPoints.length - 1].kg - bodyPoints[0].kg)
      : null

  const exerciseStats = new Map<
    string,
    { name: string; sessionCount: number; lastAt: number; identity: string }
  >()
  for (const row of rows) {
    const seen = new Set<string>()
    for (const ex of row.exercises) {
      const identity = exerciseIdentity(ex)
      if (!identity || seen.has(identity)) continue
      seen.add(identity)
      const prev = exerciseStats.get(identity)
      const display = displayExerciseName(ex.name)
      if (!prev) {
        exerciseStats.set(identity, {
          name: display,
          sessionCount: 1,
          lastAt: row.performedAt.getTime(),
          identity,
        })
      } else {
        prev.sessionCount += 1
        prev.lastAt = Math.max(prev.lastAt, row.performedAt.getTime())
        if (display.length >= prev.name.length) prev.name = display
      }
    }
  }

  const exercises = [...exerciseStats.values()].sort(
    (a, b) => b.sessionCount - a.sessionCount || b.lastAt - a.lastAt,
  )

  const preferredName = exerciseQuery ? normalizeExerciseName(exerciseQuery) : ''
  const preferredIdentity = exerciseQuery
    ? [...exerciseStats.values()].find((e) => normalizeExerciseName(e.name) === preferredName)
        ?.identity || ''
    : ''
  const picked =
    (preferredIdentity && exerciseStats.get(preferredIdentity)) ||
    exercises.find((e) => e.sessionCount >= 2) ||
    exercises[0] ||
    null

  const strengthPoints: { at: string; weightKg: number; reps: number }[] = []
  if (picked) {
    for (const row of rows) {
      const match = row.exercises.find((ex) => exerciseIdentity(ex) === picked.identity)
      if (!match) continue
      const best = bestSet(match.sets)
      if (!best) continue
      strengthPoints.push({
        at: row.performedAt.toISOString(),
        weightKg: round1(best.weightKg),
        reps: best.reps,
      })
    }
  }

  const latestStrength = strengthPoints.length ? strengthPoints[strengthPoints.length - 1] : null
  const firstStrength = strengthPoints.length >= 2 ? strengthPoints[0] : null
  const deltaWeightKg =
    latestStrength && firstStrength
      ? round1(latestStrength.weightKg - firstStrength.weightKg)
      : null
  const deltaReps =
    latestStrength && firstStrength ? latestStrength.reps - firstStrength.reps : null

  // Highlight lift: prefer exercise with non-zero weight delta over period, else first with 2+ points
  let liftName: string | null = null
  let liftDeltaWeightKg: number | null = null
  let liftDeltaReps: number | null = null
  for (const ex of exercises) {
    const pts: { w: number; r: number }[] = []
    for (const row of rows) {
      const match = row.exercises.find((e) => exerciseIdentity(e) === ex.identity)
      if (!match) continue
      const best = bestSet(match.sets)
      if (best) pts.push({ w: best.weightKg, r: best.reps })
    }
    if (pts.length < 2) continue
    const dW = round1(pts[pts.length - 1].w - pts[0].w)
    const dR = pts[pts.length - 1].r - pts[0].r
    if (liftName == null || Math.abs(dW) > Math.abs(liftDeltaWeightKg || 0)) {
      liftName = ex.name
      liftDeltaWeightKg = dW
      liftDeltaReps = dR
    }
  }

  return {
    range,
    body: {
      points: bodyPoints,
      latestKg: bodyLatestKg,
      deltaKg: bodyDeltaKg,
    },
    exercises: exercises.map(({ name, sessionCount }) => ({ name, sessionCount })),
    strength: {
      exercise: picked?.name ?? null,
      points: strengthPoints,
      latestWeightKg: latestStrength?.weightKg ?? null,
      deltaWeightKg,
      deltaReps,
    },
    highlight: {
      bodyLatestKg,
      bodyDeltaKg,
      liftName,
      liftDeltaWeightKg,
      liftDeltaReps,
    },
    insights,
  }
}
