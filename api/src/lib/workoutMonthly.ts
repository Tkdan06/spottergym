import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../db.js'
import { isGigachatConfigured, normalizeEmail } from '../env.js'
import { moscowDayKey } from './adminAnalytics.js'
import { buildMyActivityStats } from './activityStats.js'
import { gigachatChat } from './gigachat.js'
import {
  buildWorkoutInsights,
  periodBounds,
  type WorkoutInsights,
} from './workoutAnalytics.js'
import { formatPeriodLabel } from './workoutCoachFacts.js'
import {
  collectAllowedValues,
  extractJson,
  InsightGenerateError,
  slimLift,
  type InsightLiftSlim,
} from './workoutInsight.js'
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
const MONTHLY_KIND = 'monthly'
export const MONTHLY_PROMPT_VERSION = 'monthly-v1'
const VOLUME_SIGNAL_PCT = 5
const MIN_WORKOUTS = 4

export const MONTHLY_SYSTEM_PROMPT = `Ты тренер зала в приложении Spotter. Пишешь короткий разбор месяца.
Тебе дают JSON с уже посчитанными метриками за скользящие 30 дней (period/previous) и отдельно окно квоты (quota, календарный месяц по Москве). Не пересчитывай и не выдумывай числа, даты, упражнения.
Цифры месяца бери только из period / workoutCount / volume / frequency / consistency / prs / improving / plateauCandidates.
history90 — только для «устойчивый тренд» или «долгое плато». Не подменяй им 30-дневные цифры.
activity — факт посещений зала, не восстановление и не доказательство отдыха.
Не перечисляй все упражнения. Не повторяй каждую цифру. Каждый win/attention отвечает «почему это важно». Рекомендация — «что конкретно попробовать».
Не медицина, не перетрен, не травмы, не лечение, не утверждения о здоровье. Не пиши «как ИИ», «я проанализировал». Без мотивационного буллшита.
Тон: на «ты», коротко, спокойно, без эмодзи. Если мало сигнала — честно в headline, wins/attention/recommendations пустые.
Максимум 3 достижения, 2 зоны внимания, 3 рекомендации.
Цифры в text/value бери только из JSON.
SUBJECTIVE WORKOUT FEEDBACK (поле felt): easy | normal | hard | null. Субъективный сигнал, не диагноз. null — нет данных, не «normal». Один hard/easy — слабый сигнал; повтор вместе с изменением performance — сильнее. Не пиши «перетрен», «травма», «лечение». Не делай сильный вывод по одной точке.
Ответ — один JSON-объект без markdown:

{
  "headline": { "title": "до 80", "text": "1–3 предложения, до 400" },
  "wins": [
    { "title": "до 80", "text": "до 280", "why": "до 200", "exercise": "имя из JSON или null", "metric": "ключ или null", "value": "из JSON или null" }
  ],
  "attention": [
    { "title": "до 80", "text": "до 280", "why": "до 200", "exercise": "имя из JSON или null", "value": "из JSON или null" }
  ],
  "recommendations": [
    { "title": "до 80", "text": "до 200", "reason": "до 200" }
  ],
  "wrap": "короткий итог, до 200"
}

wins: 0–3. attention: 0–2. recommendations: 0–3.`

const itemSchema = z.object({
  title: z.string(),
  text: z.string(),
  why: z.string().optional(),
  exercise: z.string().nullable().optional(),
  metric: z.string().nullable().optional(),
  value: z.union([z.string(), z.number()]).nullable().optional(),
})

const letterSchema = z.object({
  headline: z.object({
    title: z.string(),
    text: z.string(),
  }),
  wins: z.array(itemSchema).optional().nullable(),
  attention: z.array(itemSchema).optional().nullable(),
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
  wrap: z.string().optional().nullable(),
})

export type MonthlyModelInput = {
  period: { range: 30; start: string; end: string }
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
  history90: {
    range: 90
    improving: InsightLiftSlim[]
    plateauCandidates: InsightLiftSlim[]
  }
}

export type MonthlyLetterItem = {
  title: string
  text: string
  why: string
  exercise: string | null
  metric: string | null
  value: string | null
}

export type MonthlyLetter = {
  headline: { title: string; text: string }
  wins: MonthlyLetterItem[]
  attention: MonthlyLetterItem[]
  recommendations: { title: string; text: string; reason: string }[]
  wrap: string
}

export type MonthlyStatus = 'locked' | 'skipped' | 'ready' | 'cached' | 'offline' | 'failed'

export type MonthlyState = {
  status: MonthlyStatus
  configured: boolean
  eligible: boolean
  canGenerate: boolean
  demo: boolean
  skipReason: 'need_workouts' | 'no_signal' | null
  periodStart: string
  periodEnd: string
  periodLabel: string
  nextAt: string
  facts: MonthlyModelInput
  letter: MonthlyLetter | null
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function clip(s: string, max: number) {
  return s.replace(/\s+/g, ' ').trim().slice(0, max)
}

export function moscowMonthBounds(now = new Date()): { start: Date; end: Date } {
  const key = moscowDayKey(now)
  const y = Number(key.slice(0, 4))
  const m = Number(key.slice(5, 7))
  const start = new Date(`${y}-${pad(m)}-01T00:00:00+03:00`)
  const nextM = m === 12 ? 1 : m + 1
  const nextY = m === 12 ? y + 1 : y
  const end = new Date(`${nextY}-${pad(nextM)}-01T00:00:00+03:00`)
  return { start, end }
}

function slimPrs(insights: WorkoutInsights): MonthlyModelInput['prs'] {
  return {
    count: insights.prs.count,
    items: insights.prs.items.map((p) => ({
      name: p.name,
      at: p.at,
      weightKg: p.weightKg,
      reps: p.reps,
      kind: p.kind,
    })),
  }
}

export function monthlyInsightsForModel(
  insights: WorkoutInsights,
  history90: WorkoutInsights,
  metric: { currentStart: Date; previousStart: Date; now: Date },
  quota: { start: Date; end: Date },
  felt: { at: string; feedback: WorkoutFelt | null }[] = [],
): MonthlyModelInput {
  return {
    period: {
      range: 30,
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
    prs: slimPrs(insights),
    improving: insights.improving.map(slimLift),
    plateauCandidates: insights.plateauCandidates.map(slimLift),
    activity: insights.activity
      ? { visits: insights.activity.visits, totalMinutes: insights.activity.totalMinutes }
      : null,
    felt,
    history90: {
      range: 90,
      improving: history90.improving.map(slimLift),
      plateauCandidates: history90.plateauCandidates.map(slimLift),
    },
  }
}

export function hashMonthlyInput(input: MonthlyModelInput): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex')
}

export function evaluateMonthlyEligibility(insights: WorkoutInsights): {
  ok: boolean
  reason: 'need_workouts' | 'no_signal' | null
} {
  if (insights.workoutCount.current < MIN_WORKOUTS) return { ok: false, reason: 'need_workouts' }
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

export function collectMonthlyExercises(input: MonthlyModelInput): Set<string> {
  const names = new Set<string>()
  for (const p of input.prs.items) names.add(p.name)
  for (const l of input.improving) names.add(l.name)
  for (const l of input.plateauCandidates) names.add(l.name)
  for (const l of input.history90.improving) names.add(l.name)
  for (const l of input.history90.plateauCandidates) names.add(l.name)
  return names
}

function valueAllowed(raw: string, allowed: Set<string>): boolean {
  const t = raw.trim().replace(',', '.')
  if (!t) return false
  if (allowed.has(t)) return true
  const noPct = t.replace(/%/g, '').trim()
  return allowed.has(noPct) || allowed.has(`${noPct}%`)
}

function sanitizeItem(
  item: z.infer<typeof itemSchema>,
  names: Set<string>,
  allowed: Set<string>,
): MonthlyLetterItem {
  const exerciseRaw = item.exercise == null ? null : clip(String(item.exercise), 60)
  const exercise = exerciseRaw && names.has(exerciseRaw) ? exerciseRaw : null
  const valueRaw = item.value == null || item.value === '' ? null : clip(String(item.value), 40)
  const value = valueRaw && valueAllowed(valueRaw, allowed) ? valueRaw : null
  return {
    title: clip(item.title, 80),
    text: clip(item.text, 280),
    why: clip(item.why || '', 200),
    exercise,
    metric: item.metric == null || item.metric === '' ? null : clip(String(item.metric), 40),
    value,
  }
}

export function sanitizeMonthlyLetter(raw: unknown, input: MonthlyModelInput): MonthlyLetter {
  const parsed = letterSchema.parse(raw)
  const names = collectMonthlyExercises(input)
  const allowed = collectAllowedValues(input)
  const activityPresent = input.activity != null

  const wins = (parsed.wins || [])
    .map((item) => sanitizeItem(item, names, allowed))
    .filter((item) => item.title || item.text)
    .filter((item) =>
      insightProseOk(`${item.title} ${item.text} ${item.why}`, allowed, activityPresent),
    )
    .slice(0, 3)

  const attention = (parsed.attention || [])
    .map((item) => sanitizeItem(item, names, allowed))
    .filter((item) => item.title || item.text)
    .filter((item) =>
      insightProseOk(`${item.title} ${item.text} ${item.why}`, allowed, activityPresent),
    )
    .slice(0, 2)

  const recommendations = (parsed.recommendations || [])
    .map((r) => ({
      title: clip(r.title, 80),
      text: clip(r.text, 200),
      reason: clip(r.reason || '', 200),
    }))
    .filter((r) => r.title || r.text)
    .filter((r) => insightProseOk(`${r.title} ${r.text} ${r.reason}`, allowed, activityPresent))
    .slice(0, 3)

  const title = clip(parsed.headline.title, 80) || 'Твой месяц'
  const text = clip(parsed.headline.text, 400)
  if (!text) throw new Error('headline.text empty')
  if (!insightProseOk(`${title} ${text}`, allowed, activityPresent)) {
    throw new Error('headline failed prose guard')
  }

  const wrap = clip(parsed.wrap || '', 200)
  return {
    headline: { title, text },
    wins,
    attention,
    recommendations,
    wrap: insightProseOk(wrap, allowed, activityPresent) ? wrap : '',
  }
}

export function monthlyLetterFromJson(raw: unknown): MonthlyLetter | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as MonthlyLetter
  if (!o.headline || typeof o.headline.title !== 'string' || typeof o.headline.text !== 'string') {
    return null
  }
  if (!Array.isArray(o.wins) || !Array.isArray(o.attention) || !Array.isArray(o.recommendations)) {
    return null
  }
  if (typeof o.wrap !== 'string') return null
  return o
}

function factsFromStored(raw: unknown): MonthlyModelInput | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as MonthlyModelInput
  if (!o.period || o.period.range !== 30 || !o.workoutCount || !o.volume || !o.prs || !o.history90) {
    return null
  }
  return o
}

async function loadMonthlyBundle(userId: string) {
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
    buildMyActivityStats(userId, 30),
  ])
  const chronological = [...allRows].reverse()
  const stats = { totalSessions: activity.totalSessions, totalMinutes: activity.totalMinutes }
  const insights = buildWorkoutInsights(30, chronological, stats, now)
  const history90 = buildWorkoutInsights(90, chronological, null, now)
  const metric = periodBounds(30, now)
  const quota = moscowMonthBounds(now)
  const felt = feltTimeline(
    chronological.map((row) => ({ performedAt: row.performedAt, feedback: row.feedback })),
    metric.currentStart,
    20,
    now,
  )
  const input = monthlyInsightsForModel(insights, history90, metric, quota, felt)
  return { now, insights, history90, input, quota }
}

async function askGigachat(input: MonthlyModelInput): Promise<{
  letter: MonthlyLetter
  model: string
  promptTokens: number
  completionTokens: number
}> {
  const userContent = `Разбор месяца. Метрики:\n${JSON.stringify(input)}`
  const messages: { role: 'system' | 'user'; content: string }[] = [
    { role: 'system', content: MONTHLY_SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ]

  const run = async () => {
    const res = await gigachatChat({
      messages,
      temperature: 0.3,
      maxTokens: 1200,
    })
    const letter = sanitizeMonthlyLetter(extractJson(res.content), input)
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
  status: MonthlyStatus
  configured: boolean
  demo: boolean
  skipReason: MonthlyState['skipReason']
  quota: { start: Date; end: Date }
  facts: MonthlyModelInput
  letter: MonthlyLetter | null
  eligible: boolean
  canGenerate?: boolean
}): MonthlyState {
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

export async function getMonthlyInsightState(userId: string, userEmail: string): Promise<MonthlyState> {
  const demo = normalizeEmail(userEmail) === DEMO_EMAIL
  const configured = isGigachatConfigured()
  const quota = moscowMonthBounds(new Date())
  let row = await prisma.workoutAiInsight.findUnique({
    where: {
      userId_kind_periodStart: { userId, kind: MONTHLY_KIND, periodStart: quota.start },
    },
  })
  if (row && (await dropStalePendingInsight(userId, MONTHLY_KIND, quota.start, row.createdAt, row.outputJson))) {
    row = null
  }
  if (row && isPendingInsightOutput(row.outputJson)) {
    const stored = factsFromStored(row.inputJson)
    const facts = stored ?? (await loadMonthlyBundle(userId)).input
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
    const letter = monthlyLetterFromJson(row.outputJson)
    const stored = factsFromStored(row.inputJson)
    const facts = stored ?? (await loadMonthlyBundle(userId)).input
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

  const bundle = await loadMonthlyBundle(userId)
  const gate = evaluateMonthlyEligibility(bundle.insights)

  let status: MonthlyStatus = 'locked'
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

export async function generateMonthlyInsight(
  userId: string,
  userEmail: string,
): Promise<MonthlyState> {
  if (!(await userCanUseWorkoutRecap(userId))) {
    throw new InsightGenerateError('Недостаточно прав', 403)
  }
  const demo = normalizeEmail(userEmail) === DEMO_EMAIL
  const configured = isGigachatConfigured()
  const bundle = await loadMonthlyBundle(userId)
  if (demo) {
    throw new InsightGenerateError('В демо-аккаунте разбор недоступен', 422)
  }

  const gate = evaluateMonthlyEligibility(bundle.insights)
  if (!gate.ok) {
    const msg =
      gate.reason === 'need_workouts'
        ? 'Пока недостаточно данных за месяц.'
        : 'В этом месяце нет заметных изменений для разбора.'
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
    kind: MONTHLY_KIND,
    periodStart: bundle.quota.start,
    periodEnd: bundle.quota.end,
    inputJson: bundle.input as unknown as Prisma.InputJsonValue,
    inputHash: hashMonthlyInput(bundle.input),
    promptVersion: MONTHLY_PROMPT_VERSION,
  })
  if (claim === 'exists') {
    throw new InsightGenerateError('Следующий разбор — с 1-го', 429)
  }
  if (claim === 'busy') {
    throw new InsightGenerateError('Разбор уже собирается', 429)
  }

  try {
    const result = await askGigachat(bundle.input)
    console.log('[gigachat] monthly tokens', {
      model: result.model,
      prompt: result.promptTokens,
      completion: result.completionTokens,
    })
    await finishInsightPeriod(userId, MONTHLY_KIND, bundle.quota.start, {
      outputJson: result.letter as unknown as Prisma.InputJsonValue,
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      promptVersion: MONTHLY_PROMPT_VERSION,
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
    await releaseInsightPeriod(userId, MONTHLY_KIND, bundle.quota.start)
    if (err instanceof InsightGenerateError) throw err
    console.warn('[gigachat] monthly generate failed', err instanceof Error ? err.message : err)
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

export async function markMonthlyInsightViewed(userId: string): Promise<{ ok: true }> {
  const quota = moscowMonthBounds(new Date())
  await prisma.workoutAiInsight.updateMany({
    where: {
      userId,
      kind: MONTHLY_KIND,
      periodStart: quota.start,
      viewedAt: null,
    },
    data: { viewedAt: new Date() },
  })
  return { ok: true }
}

export async function markMonthlyRecommendationClicked(userId: string): Promise<{ ok: true }> {
  const quota = moscowMonthBounds(new Date())
  await prisma.workoutAiInsight.updateMany({
    where: {
      userId,
      kind: MONTHLY_KIND,
      periodStart: quota.start,
      recommendationClickedAt: null,
    },
    data: { recommendationClickedAt: new Date() },
  })
  return { ok: true }
}
