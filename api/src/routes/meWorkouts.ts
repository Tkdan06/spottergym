import { Hono } from 'hono'
import { z } from 'zod'
import { WORKOUT_NOTE_MAX } from '../lib/fieldLimits.js'
import {
  createWorkoutSession,
  deleteWorkoutSession,
  getWorkoutProgress,
  getWorkoutSession,
  isPerformedAtInFuture,
  listWorkoutSessions,
  parseWorkoutFelt,
  replaceWorkoutSession,
  setWorkoutFeedback,
  type WorkoutProgressRange,
} from '../lib/workouts.js'
import {
  lookupIdempotentWorkout,
  parseIdempotencyKey,
  payloadHash,
  rememberIdempotentWorkout,
} from '../lib/workoutIdempotency.js'
import { parsePeriodRange } from '../lib/periodRange.js'
import { CoachGenerateError, generateCoachLetter, getCoachState } from '../lib/workoutCoach.js'
import {
  generateMonthlyInsight,
  getMonthlyInsightState,
  markMonthlyInsightViewed,
  markMonthlyRecommendationClicked,
} from '../lib/workoutMonthly.js'
import {
  generateWeeklyInsight,
  getWeeklyInsightState,
  InsightGenerateError,
  markWeeklyInsightViewed,
} from '../lib/workoutInsight.js'
import { userCanUseWorkoutRecap } from '../lib/workoutRecapAccess.js'
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
  notes: z.string().max(WORKOUT_NOTE_MAX).optional(),
  exercises: z.array(exerciseSchema).min(1).max(10),
})

function parsePerformedAt(raw: string) {
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function parseRange(raw: string | undefined): WorkoutProgressRange {
  return parsePeriodRange(raw)
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
  '/workouts/coach',
  rateLimit({ windowMs: 60_000, max: 60, route: 'me-workouts-coach' }),
  async (c) => {
    if (!(await userCanUseWorkoutRecap(c.get('userId')))) {
      return c.json({ error: 'Недостаточно прав' }, 403)
    }
    try {
      const coach = await getCoachState(c.get('userId'), c.get('userEmail'))
      return c.json({ coach })
    } catch (err) {
      if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 404) {
        return c.json({ error: 'Не найдено' }, 404)
      }
      throw err
    }
  },
)

workoutRoutes.post(
  '/workouts/coach/generate',
  rateLimit({ windowMs: 60_000, max: 1, route: 'me-workouts-coach-gen' }),
  async (c) => {
    if (!(await userCanUseWorkoutRecap(c.get('userId')))) {
      return c.json({ error: 'Недостаточно прав' }, 403)
    }
    try {
      const result = await generateCoachLetter(c.get('userId'), c.get('userEmail'))
      const coach = await getCoachState(c.get('userId'), c.get('userEmail'))
      return c.json({ coach, letter: result.letter })
    } catch (err) {
      if (err instanceof CoachGenerateError) {
        return c.json({ error: err.message }, err.status as 403 | 422 | 429 | 503 | 404)
      }
      throw err
    }
  },
)

workoutRoutes.get(
  '/workouts/insight',
  rateLimit({ windowMs: 60_000, max: 60, route: 'me-workouts-insight' }),
  async (c) => {
    if (!(await userCanUseWorkoutRecap(c.get('userId')))) {
      return c.json({ error: 'Недостаточно прав' }, 403)
    }
    const insight = await getWeeklyInsightState(c.get('userId'), c.get('userEmail'))
    return c.json({ insight })
  },
)

workoutRoutes.post(
  '/workouts/insight/generate',
  rateLimit({ windowMs: 60_000, max: 1, route: 'me-workouts-insight-gen' }),
  async (c) => {
    if (!(await userCanUseWorkoutRecap(c.get('userId')))) {
      return c.json({ error: 'Недостаточно прав' }, 403)
    }
    try {
      const insight = await generateWeeklyInsight(c.get('userId'), c.get('userEmail'))
      return c.json({ insight })
    } catch (err) {
      if (err instanceof InsightGenerateError) {
        return c.json({ error: err.message }, err.status as 403 | 422 | 429 | 404)
      }
      throw err
    }
  },
)

workoutRoutes.patch(
  '/workouts/insight/viewed',
  rateLimit({ windowMs: 60_000, max: 20, route: 'me-workouts-insight-viewed' }),
  async (c) => {
    if (!(await userCanUseWorkoutRecap(c.get('userId')))) {
      return c.json({ error: 'Недостаточно прав' }, 403)
    }
    await markWeeklyInsightViewed(c.get('userId'))
    return c.json({ ok: true })
  },
)

workoutRoutes.get(
  '/workouts/monthly',
  rateLimit({ windowMs: 60_000, max: 60, route: 'me-workouts-monthly' }),
  async (c) => {
    if (!(await userCanUseWorkoutRecap(c.get('userId')))) {
      return c.json({ error: 'Недостаточно прав' }, 403)
    }
    const monthly = await getMonthlyInsightState(c.get('userId'), c.get('userEmail'))
    return c.json({ monthly })
  },
)

workoutRoutes.post(
  '/workouts/monthly/generate',
  rateLimit({ windowMs: 60_000, max: 1, route: 'me-workouts-monthly-gen' }),
  async (c) => {
    if (!(await userCanUseWorkoutRecap(c.get('userId')))) {
      return c.json({ error: 'Недостаточно прав' }, 403)
    }
    try {
      const monthly = await generateMonthlyInsight(c.get('userId'), c.get('userEmail'))
      return c.json({ monthly })
    } catch (err) {
      if (err instanceof InsightGenerateError) {
        return c.json({ error: err.message }, err.status as 403 | 422 | 429 | 404)
      }
      throw err
    }
  },
)

workoutRoutes.patch(
  '/workouts/monthly/viewed',
  rateLimit({ windowMs: 60_000, max: 20, route: 'me-workouts-monthly-viewed' }),
  async (c) => {
    if (!(await userCanUseWorkoutRecap(c.get('userId')))) {
      return c.json({ error: 'Недостаточно прав' }, 403)
    }
    await markMonthlyInsightViewed(c.get('userId'))
    return c.json({ ok: true })
  },
)

workoutRoutes.patch(
  '/workouts/monthly/recommendation-clicked',
  rateLimit({ windowMs: 60_000, max: 20, route: 'me-workouts-monthly-rec-click' }),
  async (c) => {
    if (!(await userCanUseWorkoutRecap(c.get('userId')))) {
      return c.json({ error: 'Недостаточно прав' }, 403)
    }
    await markMonthlyRecommendationClicked(c.get('userId'))
    return c.json({ ok: true })
  },
)

workoutRoutes.patch(
  '/workouts/:id/feedback',
  rateLimit({ windowMs: 60_000, max: 30, route: 'me-workouts-felt' }),
  async (c) => {
    const raw = await c.req.json().catch(() => null)
    const parsed = z
      .object({
        feedback: z.enum(['easy', 'normal', 'hard']).nullable().optional(),
        prompted: z.boolean().optional(),
      })
      .safeParse(raw)
    if (!parsed.success) return c.json({ error: 'Некорректная оценка тренировки' }, 400)
    if (parsed.data.feedback === undefined && !parsed.data.prompted) {
      return c.json({ error: 'Некорректная оценка тренировки' }, 400)
    }
    let felt: 'easy' | 'normal' | 'hard' | null | undefined
    try {
      felt =
        parsed.data.feedback === undefined ? undefined : parseWorkoutFelt(parsed.data.feedback)
    } catch {
      return c.json({ error: 'Некорректная оценка тренировки' }, 400)
    }
    const workout = await setWorkoutFeedback(c.get('userId'), c.req.param('id'), {
      ...(felt !== undefined ? { feedback: felt } : {}),
      prompted: parsed.data.prompted,
    })
    if (!workout) return c.json({ error: 'Тренировка не найдена' }, 404)
    return c.json({ workout })
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
    if (isPerformedAtInFuture(performedAt)) {
      return c.json({ error: 'Дата не может быть в будущем' }, 400)
    }
    const userId = c.get('userId')
    const idemKey = parseIdempotencyKey(c.req.header('idempotency-key'))
    const hash = payloadHash(parsed.data)
    if (idemKey) {
      const hit = lookupIdempotentWorkout(userId, idemKey, hash)
      if (hit.status === 'conflict') {
        return c.json({ error: 'Повтор с другим телом запроса' }, 409)
      }
      if (hit.status === 'hit') {
        const workout = await getWorkoutSession(userId, hit.workoutId)
        if (workout) return c.json({ workout }, 201)
      }
    }
    const workout = await createWorkoutSession(userId, {
      title: parsed.data.title,
      performedAt,
      bodyWeightKg: parsed.data.bodyWeightKg,
      notes: parsed.data.notes,
      exercises: parsed.data.exercises,
    })
    if (idemKey && workout) rememberIdempotentWorkout(userId, idemKey, hash, workout.id)
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
    if (isPerformedAtInFuture(performedAt)) {
      return c.json({ error: 'Дата не может быть в будущем' }, 400)
    }
    const workout = await replaceWorkoutSession(c.get('userId'), c.req.param('id'), {
      title: parsed.data.title,
      performedAt,
      bodyWeightKg: parsed.data.bodyWeightKg,
      notes: parsed.data.notes,
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
