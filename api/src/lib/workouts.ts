import type { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import { WORKOUT_NOTE_MAX } from './fieldLimits.js'

export type WorkoutSetDto = {
  id?: string
  setIndex: number
  weightKg: number
  reps: number
}

export type WorkoutExerciseDto = {
  id?: string
  name: string
  /** Stable across renames; empty on legacy rows → name matching. */
  trackKey?: string
  sortOrder: number
  sets: WorkoutSetDto[]
  /** Filled on detail vs previous session with same title */
  weightDelta?: number | null
  repsDelta?: number | null
}

export type WorkoutSessionSummary = {
  id: string
  title: string
  performedAt: string
  bodyWeightKg: number | null
  notes: string
  exerciseCount: number
  setCount: number
  createdAt: string
  updatedAt: string
}

export type WorkoutSessionDetail = {
  id: string
  title: string
  performedAt: string
  bodyWeightKg: number | null
  notes: string
  exercises: WorkoutExerciseDto[]
  createdAt: string
  updatedAt: string
}

export type WorkoutProgressRange = 7 | 30 | 90

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
}

const sessionInclude = {
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
    select: {
      id: true,
      sets: { select: { id: true } },
    },
  },
} satisfies Prisma.WorkoutSessionInclude

type SessionListRow = Prisma.WorkoutSessionGetPayload<{ include: typeof listInclude }>

function num(d: unknown) {
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

function round1(n: number) {
  return Math.round(n * 10) / 10
}

function bodyKg(row: { bodyWeightKg: unknown }) {
  if (row.bodyWeightKg == null) return null
  const n = num(row.bodyWeightKg)
  return Number.isFinite(n) ? round1(n) : null
}

function bestSet(sets: { weightKg: unknown; reps: number }[]) {
  if (!sets.length) return null
  let best = sets[0]
  let bestW = num(best.weightKg)
  for (const s of sets.slice(1)) {
    const w = num(s.weightKg)
    if (w > bestW || (w === bestW && s.reps > best.reps)) {
      best = s
      bestW = w
    }
  }
  return { weightKg: bestW, reps: best.reps }
}

function normalizeTitle(title: string) {
  return title.trim().toLowerCase().replace(/\s+/g, ' ')
}

function normalizeExerciseName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function displayExerciseName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

function normalizeTrackKey(raw: string | undefined | null) {
  const t = String(raw || '')
    .trim()
    .slice(0, 64)
  if (!t) return ''
  if (!/^[a-zA-Z0-9_-]+$/.test(t)) return ''
  return t
}

/** Match key for deltas/progress: prefer trackKey, else normalized name. */
function exerciseIdentity(ex: { name: string; trackKey?: string | null }) {
  const tk = normalizeTrackKey(ex.trackKey)
  if (tk) return `k:${tk}`
  const n = normalizeExerciseName(ex.name)
  return n ? `n:${n}` : ''
}

function newTrackKey() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 24)
}

export function serializeSessionSummary(row: SessionFull | SessionListRow): WorkoutSessionSummary {
  const setCount = row.exercises.reduce((n, e) => n + e.sets.length, 0)
  return {
    id: row.id,
    title: row.title,
    performedAt: row.performedAt.toISOString(),
    bodyWeightKg: bodyKg(row),
    notes: row.notes || '',
    exerciseCount: row.exercises.length,
    setCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function serializeSessionDetail(
  row: SessionFull,
  previous: SessionFull | null,
): WorkoutSessionDetail {
  const prevById = new Map<string, ReturnType<typeof bestSet>>()
  if (previous) {
    for (const ex of previous.exercises) {
      const key = exerciseIdentity(ex)
      if (!key) continue
      prevById.set(key, bestSet(ex.sets))
    }
  }

  const exercises: WorkoutExerciseDto[] = row.exercises.map((ex) => {
    const cur = bestSet(ex.sets)
    const prev = prevById.get(exerciseIdentity(ex)) || null
    let weightDelta: number | null = null
    let repsDelta: number | null = null
    if (cur && prev) {
      weightDelta = Math.round((cur.weightKg - prev.weightKg) * 100) / 100
      repsDelta = cur.reps - prev.reps
    }
    return {
      id: ex.id,
      name: ex.name,
      trackKey: normalizeTrackKey(ex.trackKey) || undefined,
      sortOrder: ex.sortOrder,
      sets: ex.sets.map((s) => ({
        id: s.id,
        setIndex: s.setIndex,
        weightKg: num(s.weightKg),
        reps: s.reps,
      })),
      weightDelta,
      repsDelta,
    }
  })

  return {
    id: row.id,
    title: row.title,
    performedAt: row.performedAt.toISOString(),
    bodyWeightKg: bodyKg(row),
    notes: row.notes || '',
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
  return {
    workouts: page.map(serializeSessionSummary),
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
  return exercises.map((ex, i) => ({
    name: ex.name.trim(),
    trackKey: normalizeTrackKey(ex.trackKey) || newTrackKey(),
    sortOrder: i,
    sets: {
      create: ex.sets.map((s, j) => ({
        setIndex: j,
        weightKg: s.weightKg,
        reps: s.reps,
      })),
    },
  }))
}

export async function createWorkoutSession(userId: string, input: WorkoutInput) {
  const title = input.title.trim()
  const row = await prisma.workoutSession.create({
    data: {
      userId,
      title,
      performedAt: input.performedAt,
      bodyWeightKg: normalizeBodyWeight(input.bodyWeightKg),
      notes: normalizeNotes(input.notes),
      exercises: {
        create: exerciseCreates(input.exercises),
      },
    },
    include: sessionInclude,
  })
  await pruneWorkoutSessionsIfNeeded(userId)
  return getWorkoutSession(userId, row.id)
}

export async function replaceWorkoutSession(userId: string, id: string, input: WorkoutInput) {
  const existing = await prisma.workoutSession.findFirst({ where: { id, userId } })
  if (!existing) return null

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
          create: exerciseCreates(input.exercises),
        },
      },
    })
  })

  return getWorkoutSession(userId, id)
}

export async function deleteWorkoutSession(userId: string, id: string) {
  const result = await prisma.workoutSession.deleteMany({ where: { id, userId } })
  return result.count > 0
}

export async function getWorkoutProgress(
  userId: string,
  range: WorkoutProgressRange,
  exerciseQuery?: string,
): Promise<WorkoutProgress> {
  const since = new Date(Date.now() - range * 24 * 60 * 60 * 1000)
  const rows = await prisma.workoutSession.findMany({
    where: { userId, performedAt: { gte: since } },
    orderBy: { performedAt: 'asc' },
    // Cap matches retention: user never has more than MAX_WORKOUT_SESSIONS total.
    take: MAX_WORKOUT_SESSIONS,
    include: sessionInclude,
  })

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
  }
}
