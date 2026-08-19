import { Hono } from 'hono'
import { z } from 'zod'
import {
  createWorkoutSession,
  deleteWorkoutSession,
  getWorkoutProgress,
  getWorkoutSession,
  listWorkoutSessions,
  replaceWorkoutSession,
  type WorkoutProgressRange,
} from '../lib/workouts.js'
import type { AuthedEnv } from '../middleware/auth.js'
import { rateLimit } from '../middleware/rateLimit.js'

const setSchema = z.object({
  weightKg: z.number().min(1).max(300),
  reps: z.number().int().min(0).max(1000),
})

const exerciseSchema = z.object({
  name: z.string().trim().min(1).max(60),
  trackKey: z.string().trim().max(64).optional(),
  sets: z.array(setSchema).min(1).max(6),
})

const bodySchema = z.object({
  title: z.string().trim().min(1).max(40),
  performedAt: z.string().datetime({ offset: true }).or(z.string().datetime()),
  /** Whole kg only — fractions coerced server-side. */
  bodyWeightKg: z.number().min(30).max(250).nullable().optional(),
  exercises: z.array(exerciseSchema).min(1).max(10),
})

function parsePerformedAt(raw: string) {
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function parseRange(raw: string | undefined): WorkoutProgressRange {
  const n = Number(raw)
  if (n === 7 || n === 30 || n === 90) return n
  return 30
}

/** Mounted under /me — auth already applied by meRoutes.use */
export const workoutRoutes = new Hono<AuthedEnv>()

workoutRoutes.get(
  '/workouts',
  rateLimit({ windowMs: 60_000, max: 60, route: 'me-workouts-list' }),
  async (c) => {
    const limitRaw = Number(c.req.query('limit'))
    const limit = Number.isFinite(limitRaw) ? limitRaw : undefined
    const beforePerformedAt = c.req.query('before') || undefined
    const beforeId = c.req.query('beforeId') || undefined
    const { workouts, hasMore, totalCount, atRetentionCap } = await listWorkoutSessions(
      c.get('userId'),
      {
        limit,
        beforePerformedAt,
        beforeId,
      },
    )
    return c.json({ workouts, hasMore, totalCount, atRetentionCap })
  },
)

workoutRoutes.get(
  '/workouts/progress',
  rateLimit({ windowMs: 60_000, max: 60, route: 'me-workouts-progress' }),
  async (c) => {
    const range = parseRange(c.req.query('range'))
    const exercise = c.req.query('exercise')?.trim() || undefined
    const progress = await getWorkoutProgress(c.get('userId'), range, exercise)
    return c.json({ progress })
  },
)

workoutRoutes.get(
  '/workouts/:id',
  rateLimit({ windowMs: 60_000, max: 60, route: 'me-workouts-get' }),
  async (c) => {
    const workout = await getWorkoutSession(c.get('userId'), c.req.param('id'))
    if (!workout) return c.json({ error: 'Тренировка не найдена' }, 404)
    return c.json({ workout })
  },
)

workoutRoutes.post(
  '/workouts',
  rateLimit({ windowMs: 60_000, max: 30, route: 'me-workouts-create' }),
  async (c) => {
    const parsed = bodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'Некорректные данные тренировки' }, 400)
    const performedAt = parsePerformedAt(parsed.data.performedAt)
    if (!performedAt) return c.json({ error: 'Некорректная дата' }, 400)
    const workout = await createWorkoutSession(c.get('userId'), {
      title: parsed.data.title,
      performedAt,
      bodyWeightKg: parsed.data.bodyWeightKg,
      exercises: parsed.data.exercises,
    })
    return c.json({ workout }, 201)
  },
)

workoutRoutes.patch(
  '/workouts/:id',
  rateLimit({ windowMs: 60_000, max: 30, route: 'me-workouts-patch' }),
  async (c) => {
    const parsed = bodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'Некорректные данные тренировки' }, 400)
    const performedAt = parsePerformedAt(parsed.data.performedAt)
    if (!performedAt) return c.json({ error: 'Некорректная дата' }, 400)
    const workout = await replaceWorkoutSession(c.get('userId'), c.req.param('id'), {
      title: parsed.data.title,
      performedAt,
      bodyWeightKg: parsed.data.bodyWeightKg,
      exercises: parsed.data.exercises,
    })
    if (!workout) return c.json({ error: 'Тренировка не найдена' }, 404)
    return c.json({ workout })
  },
)

workoutRoutes.delete(
  '/workouts/:id',
  rateLimit({ windowMs: 60_000, max: 20, route: 'me-workouts-delete' }),
  async (c) => {
    const ok = await deleteWorkoutSession(c.get('userId'), c.req.param('id'))
    if (!ok) return c.json({ error: 'Тренировка не найдена' }, 404)
    return c.json({ ok: true })
  },
)
