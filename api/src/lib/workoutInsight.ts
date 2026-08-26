import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../db.js'
import { isGigachatConfigured, normalizeEmail } from '../env.js'
import { buildMyActivityStats } from './activityStats.js'
import { gigachatChat } from './gigachat.js'
import {
  buildWorkoutInsights,
  periodBounds,
  type WorkoutExerciseInsight,
  type WorkoutInsights,
} from './workoutAnalytics.js'
import { coachPeriodBounds, formatPeriodLabel } from './workoutCoachFacts.js'
import { userCanUseWorkoutRecap } from './workoutRecapAccess.js'
import { MAX_WORKOUT_SESSIONS, feltTimeline, type WorkoutFelt } from './workouts.js'
import { insightProseOk, isPendingInsightOutput } from './insightSanitize.js'
import {
  claimInsightPeriod,
  dropStalePendingInsight,
  finishInsightPeriod,
  releaseInsightPeriod,
} from './insightClaim.js'

const DEMO_EMAIL = 'demo@demo.ru'
const INSIGHT_KIND = 'weekly'
const VOLUME_SIGNAL_PCT = 5

export const INSIGHT_SYSTEM_PROMPT = `Ты тренер зала в приложении Spotter. Пишешь короткий еженедельный разбор.
Тебе дают JSON с уже посчитанными метриками за скользящие 7 дней (period/previous) и отдельно окно квоты (quota, календарная неделя по Москве). Не пересчитывай и не выдумывай числа, даты, упражнения.
Выбери максимум 3 самых важных события. Приоритет:
P0: новый PR, заметный рост силы, заметное изменение частоты, выраженное плато.
P1: изменение объёма, отдельных упражнений, поведения.
P2: второстепенное — только если слотов меньше трёх.
Не перечисляй всё. Одно выполнение упражнения — не прогресс. Одно снижение — не проблема.
Не медицина, не травмы, не «нужен отдых» без данных. Не пиши «как ИИ», «я проанализировал», «ваши данные свидетельствуют». Без мотивационного буллшита и «ты молодец» без конкретной цифры из JSON.
Тон: на «ты», коротко, спокойно, без эмодзи. Если значимых изменений нет — честно скажи в summary, insights и recommendations пустые.
Максимум 2 рекомендации. Цифры в text/value бери только из JSON.
SUBJECTIVE WORKOUT FEEDBACK (поле felt): easy | normal | hard | null. Это субъективный сигнал пользователя, не диагноз. null — нет данных, не считай это «normal». Один hard/easy — слабый сигнал; повторяющийся felt вместе с изменением веса/повторов/объёма — сильнее. Сопоставляй с performance. Не пиши «перетрен», «травма», «лечение». Не делай сильный вывод по одной точке.
Ответ — один JSON-объект без markdown:

{
  "summary": { "title": "до 80 символов", "text": "1–3 предложения, до 400" },
  "insights": [
    {
      "type": "progress|behavior|attention|try_next",
      "priority": "high|medium|low",
      "title": "до 80",
      "text": "до 280",
      "exercise": "имя из JSON или null",
      "metric": "короткий ключ или null",
      "value": "число/строка из JSON или null",
      "confidence": 0.0
    }
  ],
  "recommendations": [
    { "title": "до 80", "text": "до 200", "reason": "до 200" }
  ]
}

insights: 0–3. recommendations: 0–2.`

const insightItemSchema = z.object({
  type: z.enum(['progress', 'behavior', 'attention', 'try_next']),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  title: z.string(),
  text: z.string(),
  exercise: z.string().nullable().optional(),
  metric: z.string().nullable().optional(),
  value: z.union([z.string(), z.number()]).nullable().optional(),
  confidence: z.number().optional(),
})

const letterSchema = z.object({
  summary: z.object({
    title: z.string(),
    text: z.string(),
  }),
  insights: z.array(insightItemSchema).optional().nullable(),
  recommendations: z
    .array(
      z.object({
        title: z.string(),
        text: z.string(),
        reason: z.string().optional(),
      }),
    )
    .optional()
    .nullable(),
})

export type InsightLiftSlim = {
  name: string
  sessionCount: number
  lastBest: { weightKg: number; reps: number; at?: string } | null
  weightDeltaKg: number | null
  weightDeltaPercent: number | null
  repsDelta: number | null
  trend: string
  plateauCandidate: boolean
  plateau: { spanDays: number }
}

export type InsightModelInput = {
  period: { range: 7; start: string; end: string }
  previous: { start: string; end: string }
  quota: { start: string; end: string }
  workoutCount: WorkoutInsights['workoutCount']
  frequency: WorkoutInsights['frequency']
  volume: WorkoutInsights['volume']
  consistency: WorkoutInsights['consistency']
  prs: {
    count: number
    items: { name: string; at: string; weightKg: number; reps: number; kind: string }[]
  }
  improving: InsightLiftSlim[]
  plateauCandidates: InsightLiftSlim[]
  activity: { visits: number; totalMinutes: number } | null
  felt: { at: string; feedback: WorkoutFelt | null }[]
}

export type InsightLetterItem = {
  type: 'progress' | 'behavior' | 'attention' | 'try_next'
  priority: 'high' | 'medium' | 'low'
  title: string
  text: string
  exercise: string | null
  metric: string | null
  value: string | null
  confidence: number
}

export type InsightLetter = {
  summary: { title: string; text: string }
  insights: InsightLetterItem[]
  recommendations: { title: string; text: string; reason: string }[]
}

export type InsightStatus = 'locked' | 'skipped' | 'ready' | 'cached' | 'offline' | 'failed'

export type InsightState = {
  status: InsightStatus
  configured: boolean
  eligible: boolean
  canGenerate: boolean
  demo: boolean
  skipReason: 'need_workouts' | 'no_signal' | null
  periodStart: string
  periodEnd: string
  periodLabel: string
  nextAt: string
  facts: InsightModelInput
  letter: InsightLetter | null
}

function clip(s: string, max: number) {
  return s.replace(/\s+/g, ' ').trim().slice(0, max)
}

export function extractJson(raw: string) {
  const trimmed = raw.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = fence ? fence[1].trim() : trimmed
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('no json object')
  return JSON.parse(body.slice(start, end + 1)) as unknown
}

export function slimLift(ex: WorkoutExerciseInsight): InsightLiftSlim {
  return {
    name: ex.name,
    sessionCount: ex.sessionCount,
    lastBest: ex.lastBest,
    weightDeltaKg: ex.weightDeltaKg,
    weightDeltaPercent: ex.weightDeltaPercent,
    repsDelta: ex.repsDelta,
    trend: ex.trend,
    plateauCandidate: ex.plateauCandidate,
    plateau: { spanDays: ex.plateau.spanDays },
  }
}

export function insightsForModel(
  insights: WorkoutInsights,
  metric: { currentStart: Date; previousStart: Date; now: Date },
  quota: { start: Date; end: Date },
  felt: { at: string; feedback: WorkoutFelt | null }[] = [],
): InsightModelInput {
  return {
    period: {
      range: 7,
      start: metric.currentStart.toISOString(),
      end: metric.now.toISOString(),
    },
    previous: {
      start: metric.previousStart.toISOString(),
      end: metric.currentStart.toISOString(),
    },
    quota: {
      start: quota.start.toISOString(),
      end: quota.end.toISOString(),
    },
    workoutCount: insights.workoutCount,
    frequency: insights.frequency,
    volume: insights.volume,
    consistency: insights.consistency,
    prs: {
      count: insights.prs.count,
      items: insights.prs.items.map((p) => ({
        name: p.name,
        at: p.at,
        weightKg: p.weightKg,
        reps: p.reps,
        kind: p.kind,
      })),
    },
    improving: insights.improving.map(slimLift),
    plateauCandidates: insights.plateauCandidates.map(slimLift),
    activity: insights.activity
      ? { visits: insights.activity.visits, totalMinutes: insights.activity.totalMinutes }
      : null,
    felt,
  }
}

export function hashInsightInput(input: InsightModelInput): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex')
}

export function evaluateInsightEligibility(insights: WorkoutInsights): {
  ok: boolean
  reason: 'need_workouts' | 'no_signal' | null
} {
  if (insights.workoutCount.current < 2) return { ok: false, reason: 'need_workouts' }
  const volumeSignal =
    insights.volume.deltaPercent != null && Math.abs(insights.volume.deltaPercent) >= VOLUME_SIGNAL_PCT
  const countSignal =
    insights.workoutCount.previous > 0 && Math.abs(insights.workoutCount.delta) >= 1
  const signal =
    insights.prs.count > 0 ||
    volumeSignal ||
    countSignal ||
    insights.improving.length > 0 ||
    insights.plateauCandidates.length > 0
  if (!signal) return { ok: false, reason: 'no_signal' }
  return { ok: true, reason: null }
}

function addAllowedNumber(out: Set<string>, n: unknown) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return
  out.add(String(n))
  const r = Math.round(n * 10) / 10
  out.add(String(r))
  out.add(String(Math.round(n)))
  out.add(`${r}%`)
  out.add(`${n}%`)
}

export function collectAllowedValues(input: unknown): Set<string> {
  const out = new Set<string>()
  const walk = (v: unknown) => {
    if (typeof v === 'number') addAllowedNumber(out, v)
    else if (typeof v === 'string' && v.trim()) out.add(v.trim())
    else if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object') Object.values(v).forEach(walk)
  }
  walk(input)
  return out
}

export function collectAllowedExercises(input: InsightModelInput): Set<string> {
  const names = new Set<string>()
  for (const p of input.prs.items) names.add(p.name)
  for (const l of input.improving) names.add(l.name)
  for (const l of input.plateauCandidates) names.add(l.name)
  return names
}

function valueAllowed(raw: string, allowed: Set<string>): boolean {
  const t = raw.trim().replace(',', '.')
  if (!t) return false
  if (allowed.has(t)) return true
  const noPct = t.replace(/%/g, '').trim()
  return allowed.has(noPct) || allowed.has(`${noPct}%`)
}

export function sanitizeInsightLetter(raw: unknown, input: InsightModelInput): InsightLetter {
  const parsed = letterSchema.parse(raw)
  const names = collectAllowedExercises(input)
  const allowed = collectAllowedValues(input)
  const activityPresent = input.activity != null

  const insights: InsightLetterItem[] = (parsed.insights || [])
    .map((item) => {
      const exerciseRaw = item.exercise == null ? null : clip(String(item.exercise), 60)
      const exercise = exerciseRaw && names.has(exerciseRaw) ? exerciseRaw : null
      const valueRaw =
        item.value == null || item.value === ''
          ? null
          : clip(String(item.value), 40)
      const value = valueRaw && valueAllowed(valueRaw, allowed) ? valueRaw : null
      const confidence = item.confidence
      const conf =
        typeof confidence === 'number' && Number.isFinite(confidence)
          ? Math.min(1, Math.max(0, confidence))
          : 0.7
      const type = item.type
      const priority: InsightLetterItem['priority'] =
        item.priority === 'high' || item.priority === 'low' ? item.priority : 'medium'
      return {
        type,
        priority,
        title: clip(item.title, 80),
        text: clip(item.text, 280),
        exercise,
        metric: item.metric == null || item.metric === '' ? null : clip(String(item.metric), 40),
        value,
        confidence: conf,
      }
    })
    .filter((item) => item.title || item.text)
    .filter((item) => insightProseOk(`${item.title} ${item.text}`, allowed, activityPresent))
    .slice(0, 3)

  const recommendations = (parsed.recommendations || [])
    .map((r) => ({
      title: clip(r.title, 80),
      text: clip(r.text, 200),
      reason: clip(r.reason || '', 200),
    }))
    .filter((r) => r.title || r.text)
    .filter((r) => insightProseOk(`${r.title} ${r.text} ${r.reason}`, allowed, activityPresent))
    .slice(0, 2)

  const title = clip(parsed.summary.title, 80) || 'Твой прогресс'
  const text = clip(parsed.summary.text, 400)
  if (!text) throw new Error('summary.text empty')
  if (!insightProseOk(`${title} ${text}`, allowed, activityPresent)) {
    throw new Error('summary failed prose guard')
  }

  return {
    summary: { title, text },
    insights,
    recommendations,
  }
}

export function letterFromJson(raw: unknown): InsightLetter | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as InsightLetter
  if (!o.summary || typeof o.summary.title !== 'string' || typeof o.summary.text !== 'string') {
    return null
  }
  if (!Array.isArray(o.insights) || !Array.isArray(o.recommendations)) return null
  return o
}

function factsFromStored(raw: unknown): InsightModelInput | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as InsightModelInput
  if (!o.period || !o.workoutCount || !o.volume || !o.prs) return null
  return o
}

async function loadWeeklyBundle(userId: string) {
  const now = new Date()
  const [allRows, activity] = await Promise.all([
    prisma.workoutSession.findMany({
      where: { userId },
      orderBy: { performedAt: 'desc' },
      take: MAX_WORKOUT_SESSIONS,
      select: {
        performedAt: true,
        feedback: true,
        exercises: {
          select: {
            name: true,
            trackKey: true,
            sets: { select: { weightKg: true, reps: true } },
          },
        },
      },
    }),
    buildMyActivityStats(userId, 7),
  ])
  const chronological = [...allRows].reverse()
  const insights = buildWorkoutInsights(
    7,
    chronological,
    { totalSessions: activity.totalSessions, totalMinutes: activity.totalMinutes },
    now,
  )
  const metric = periodBounds(7, now)
  const quota = coachPeriodBounds(now, 7)
  const felt = feltTimeline(
    chronological.map((row) => ({ performedAt: row.performedAt, feedback: row.feedback })),
    metric.currentStart,
    20,
    now,
  )
  const input = insightsForModel(insights, metric, quota, felt)
  return { now, insights, input, quota }
}

async function askGigachat(input: InsightModelInput): Promise<{
  letter: InsightLetter
  model: string
  promptTokens: number
  completionTokens: number
}> {
  const userContent = `Разбор недели. Метрики:\n${JSON.stringify(input)}`
  const messages: { role: 'system' | 'user'; content: string }[] = [
    { role: 'system', content: INSIGHT_SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ]

  const run = async () => {
    const res = await gigachatChat({
      messages,
      temperature: 0.3,
      maxTokens: 900,
    })
    const letter = sanitizeInsightLetter(extractJson(res.content), input)
    return {
      letter,
      model: res.model,
      promptTokens: res.promptTokens,
      completionTokens: res.completionTokens,
    }
  }

  try {
    return await run()
  } catch (first) {
    messages.push({
      role: 'user',
      content: 'Верни только JSON по схеме, без markdown и без комментариев.',
    })
    try {
      return await run()
    } catch {
      throw first instanceof Error ? first : new Error('GigaChat parse failed')
    }
  }
}

function baseState(opts: {
  status: InsightStatus
  configured: boolean
  demo: boolean
  skipReason: InsightState['skipReason']
  quota: { start: Date; end: Date }
  facts: InsightModelInput
  letter: InsightLetter | null
  eligible: boolean
  canGenerate?: boolean
}): InsightState {
  const canGenerate = opts.canGenerate ?? (opts.status === 'ready' || opts.status === 'failed')
  return {
    status: opts.status,
    configured: opts.configured,
    eligible: opts.eligible,
    canGenerate,
    demo: opts.demo,
    skipReason: opts.skipReason,
    periodStart: opts.quota.start.toISOString(),
    periodEnd: opts.quota.end.toISOString(),
    periodLabel: formatPeriodLabel(opts.quota.start, opts.quota.end),
    nextAt: opts.quota.end.toISOString(),
    facts: opts.facts,
    letter: opts.letter,
  }
}

export async function getWeeklyInsightState(userId: string, userEmail: string): Promise<InsightState> {
  const demo = normalizeEmail(userEmail) === DEMO_EMAIL
  const configured = isGigachatConfigured()
  const quota = coachPeriodBounds(new Date(), 7)
  let row = await prisma.workoutAiInsight.findUnique({
    where: {
      userId_kind_periodStart: { userId, kind: INSIGHT_KIND, periodStart: quota.start },
    },
  })
  if (row && (await dropStalePendingInsight(userId, INSIGHT_KIND, quota.start, row.createdAt, row.outputJson))) {
    row = null
  }
  if (row && isPendingInsightOutput(row.outputJson)) {
    const stored = factsFromStored(row.inputJson)
    const facts = stored ?? (await loadWeeklyBundle(userId)).input
    return baseState({
      status: 'ready',
      configured,
      demo,
      skipReason: null,
      quota,
      facts,
      letter: null,
      eligible: true,
      canGenerate: false,
    })
  }
  if (row) {
    const letter = letterFromJson(row.outputJson)
    const stored = factsFromStored(row.inputJson)
    const facts = stored ?? (await loadWeeklyBundle(userId)).input
    return baseState({
      status: letter ? 'cached' : 'failed',
      configured,
      demo,
      skipReason: null,
      quota,
      facts,
      letter,
      eligible: true,
      canGenerate: false,
    })
  }

  const bundle = await loadWeeklyBundle(userId)
  const gate = evaluateInsightEligibility(bundle.insights)

  let status: InsightStatus = 'locked'
  if (!gate.ok && gate.reason === 'need_workouts') status = 'locked'
  else if (!gate.ok) status = 'skipped'
  else if (!configured || demo) status = 'offline'
  else status = 'ready'

  return baseState({
    status,
    configured,
    demo,
    skipReason: gate.ok ? null : gate.reason,
    quota: bundle.quota,
    facts: bundle.input,
    letter: null,
    eligible: gate.ok,
  })
}

export class InsightGenerateError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function generateWeeklyInsight(
  userId: string,
  userEmail: string,
): Promise<InsightState> {
  if (!(await userCanUseWorkoutRecap(userId))) {
    throw new InsightGenerateError('Недостаточно прав', 403)
  }
  const demo = normalizeEmail(userEmail) === DEMO_EMAIL
  const configured = isGigachatConfigured()
  const bundle = await loadWeeklyBundle(userId)
  if (demo) {
    throw new InsightGenerateError('В демо-аккаунте разбор недоступен', 422)
  }

  const gate = evaluateInsightEligibility(bundle.insights)
  if (!gate.ok) {
    const msg =
      gate.reason === 'need_workouts'
        ? 'Пока недостаточно данных для нового анализа.'
        : 'На этой неделе нет заметных изменений для разбора.'
    throw new InsightGenerateError(msg, 422)
  }

  if (!configured) {
    return baseState({
      status: 'offline',
      configured,
      demo,
      skipReason: null,
      quota: bundle.quota,
      facts: bundle.input,
      letter: null,
      eligible: true,
    })
  }

  const claim = await claimInsightPeriod({
    userId,
    kind: INSIGHT_KIND,
    periodStart: bundle.quota.start,
    periodEnd: bundle.quota.end,
    inputJson: bundle.input as unknown as Prisma.InputJsonValue,
    inputHash: hashInsightInput(bundle.input),
  })
  if (claim === 'exists') {
    throw new InsightGenerateError('Следующий разбор — с понедельника', 429)
  }
  if (claim === 'busy') {
    throw new InsightGenerateError('Разбор уже собирается', 429)
  }

  try {
    const result = await askGigachat(bundle.input)
    console.log('[gigachat] insight tokens', {
      model: result.model,
      prompt: result.promptTokens,
      completion: result.completionTokens,
    })
    await finishInsightPeriod(userId, INSIGHT_KIND, bundle.quota.start, {
      outputJson: result.letter as unknown as Prisma.InputJsonValue,
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    })
    return baseState({
      status: 'cached',
      configured,
      demo,
      skipReason: null,
      quota: bundle.quota,
      facts: bundle.input,
      letter: result.letter,
      eligible: true,
    })
  } catch (err) {
    await releaseInsightPeriod(userId, INSIGHT_KIND, bundle.quota.start)
    if (err instanceof InsightGenerateError) throw err
    console.warn('[gigachat] insight generate failed', err instanceof Error ? err.message : err)
    return baseState({
      status: 'failed',
      configured,
      demo,
      skipReason: null,
      quota: bundle.quota,
      facts: bundle.input,
      letter: null,
      eligible: true,
    })
  }
}

export async function markWeeklyInsightViewed(userId: string): Promise<{ ok: true }> {
  const quota = coachPeriodBounds(new Date(), 7)
  await prisma.workoutAiInsight.updateMany({
    where: {
      userId,
      kind: INSIGHT_KIND,
      periodStart: quota.start,
      viewedAt: null,
    },
    data: { viewedAt: new Date() },
  })
  return { ok: true }
}