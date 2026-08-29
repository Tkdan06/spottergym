import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../db.js'
import { env, isGigachatConfigured, normalizeEmail } from '../env.js'
import { gigachatChat } from './gigachat.js'
import {
  buildCoachFacts,
  coachPeriodBounds,
  factsForModel,
  formatPeriodLabel,
  type CoachFacts,
} from './workoutCoachFacts.js'
import { userCanUseWorkoutRecap } from './workoutRecapAccess.js'

const DEMO_EMAIL = 'demo@demo.ru'

export const COACH_SYSTEM_PROMPT = `Ты опытный тренер зала. Пишешь еженедельный разбор в приложении Spotter.
Тебе дают JSON со слоями week (7 дней), d30, d90. Цифры и флаги уже посчитаны — не пересчитывай и не выдумывай кг, повторы, даты, упражнения.
Горизонты:
- week: только вердикт и план на ближайшую тренировку. Не объявляй прогресс, плато, «отстающий низ» по одной неделе.
- d30: прогресс/плато/можно поднять вес/дисбаланс — только если у слоя ready=true и есть соответствующий флаг.
- d90: максимум одно предложение, и только если ready=true.
Задача письма: человек закрыл экран и знает, что делать в следующий заход в зал. Не пересказывать графики.
Тон: на «ты», коротко, спокойно, без эмодзи, без «ты молодец» без цифры, без медицинских советов, БАДов, стероидов, жёсткой сушки.
Подсобка: 0–1 упражнение, только к flagged lift на d30; если инвентарь неизвестен — базовое (румынская тяга, разгибания голени, тяга горизонтального блока).
Следующая тренировка: 3–5 шагов, в каждом конкретное упражнение из фактов или одна подсобка; ориентир веса/повторов бери из lastSets. Не ставь плюс к весу, если в week объём сильно вырос или нет флага canAddWeight.
Пустой блок не пиши. Ответ — один JSON-объект без markdown:

{
  "headline": "до 80 символов, вердикт недели",
  "weekVerdict": { "tone": "hit|almost|missed", "text": "1–2 предложения с цифрами из week" },
  "wins": [{"title": "", "text": ""}],
  "nextSession": {
    "title": "Следующая тренировка",
    "focus": "коротко",
    "steps": ["упражнение — ориентир"]
  },
  "distance30": { "text": "", "change": "" },
  "distance90": { "text": "" }
}

wins: максимум 2, каждый с числом из фактов; иначе [].
distance30/distance90: null, если слой не ready.
nextSession.steps: 3–5 строк.`

const winSchema = z.object({
  title: z.string(),
  text: z.string(),
})

const letterSchema = z.object({
  headline: z.string(),
  weekVerdict: z.object({
    tone: z.enum(['hit', 'almost', 'missed']),
    text: z.string(),
  }),
  wins: z.array(winSchema).optional().nullable(),
  nextSession: z.object({
    title: z.string().optional(),
    focus: z.string(),
    steps: z.array(z.string()),
  }),
  distance30: z
    .object({
      text: z.string().optional().nullable(),
      change: z.string().optional().nullable(),
    })
    .nullable()
    .optional(),
  distance90: z
    .object({
      text: z.string().optional().nullable(),
    })
    .nullable()
    .optional(),
})

export type CoachLetter = {
  headline: string
  weekVerdict: { tone: 'hit' | 'almost' | 'missed'; text: string }
  wins: { title: string; text: string }[]
  nextSession: { title: string; focus: string; steps: string[] }
  distance30: { text: string; change: string } | null
  distance90: { text: string } | null
}

export type CoachStatus = 'locked' | 'ready' | 'cached' | 'offline'

export type CoachPublicFacts = {
  weekSessions: number
  weekPrevSessions: number
  weekSplit: CoachFacts['week']['split']
  verdictHint: CoachFacts['week']['verdictHint']
  d30Ready: boolean
  d90Ready: boolean
}

export type CoachState = {
  status: CoachStatus
  configured: boolean
  eligible: boolean
  canGenerate: boolean
  demo: boolean
  sessionsIn21d: number
  sessionsNeeded: number
  periodStart: string
  periodEnd: string
  periodLabel: string
  nextAt: string
  facts: CoachPublicFacts
  letter: CoachLetter | null
}

function clip(s: string, max: number) {
  return s.replace(/\s+/g, ' ').trim().slice(0, max)
}

function extractJson(raw: string) {
  const trimmed = raw.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = fence ? fence[1].trim() : trimmed
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('no json object')
  return JSON.parse(body.slice(start, end + 1)) as unknown
}

function sanitizeLetter(raw: unknown, facts: CoachFacts): CoachLetter {
  const parsed = letterSchema.parse(raw)
  const hint = facts.week.verdictHint || 'almost'
  const wins = (parsed.wins || [])
    .map((w) => ({ title: clip(w.title, 60), text: clip(w.text, 280) }))
    .filter((w) => w.title || w.text)
    .slice(0, 2)
  const steps = parsed.nextSession.steps
    .map((s) => clip(s, 160))
    .filter(Boolean)
    .slice(0, 5)
  if (steps.length < 1) throw new Error('nextSession.steps empty')

  const tone = parsed.weekVerdict.tone
  const weekTone = tone === 'hit' || tone === 'almost' || tone === 'missed' ? tone : hint

  let distance30: CoachLetter['distance30'] = null
  if (facts.d30.ready && parsed.distance30) {
    const text = clip(String(parsed.distance30.text || ''), 400)
    const change = clip(String(parsed.distance30.change || ''), 240)
    if (text || change) distance30 = { text, change }
  }
  let distance90: CoachLetter['distance90'] = null
  if (facts.d90.ready && parsed.distance90) {
    const text = clip(String(parsed.distance90.text || ''), 280)
    if (text) distance90 = { text }
  }

  return {
    headline: clip(parsed.headline, 80) || 'Разбор за неделю',
    weekVerdict: {
      tone: weekTone,
      text: clip(parsed.weekVerdict.text, 400) || '',
    },
    wins,
    nextSession: {
      title: clip(parsed.nextSession.title || 'Следующая тренировка', 60) || 'Следующая тренировка',
      focus: clip(parsed.nextSession.focus, 80),
      steps,
    },
    distance30,
    distance90,
  }
}

async function askGigachat(facts: CoachFacts): Promise<{
  letter: CoachLetter
  model: string
  promptTokens: number
  completionTokens: number
}> {
  const payload = JSON.stringify(factsForModel(facts))
  const userContent = `Разбор. Слои фактов:\n${payload}`
  const messages: { role: 'system' | 'user'; content: string }[] = [
    { role: 'system', content: COACH_SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ]

  const run = async () => {
    const res = await gigachatChat({
      messages,
      temperature: 0.3,
      maxTokens: 1000,
    })
    const letter = sanitizeLetter(extractJson(res.content), facts)
    return { letter, model: res.model, promptTokens: res.promptTokens, completionTokens: res.completionTokens }
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

function publicFacts(facts: CoachFacts): CoachPublicFacts {
  return {
    weekSessions: facts.week.sessionCount,
    weekPrevSessions: facts.week.prevSessionCount,
    weekSplit: facts.week.split,
    verdictHint: facts.week.verdictHint,
    d30Ready: facts.d30.ready,
    d90Ready: facts.d90.ready,
  }
}

function letterFromJson(raw: unknown): CoachLetter | null {
  try {
    const o = raw as CoachLetter
    if (!o || typeof o !== 'object' || !o.headline || !o.nextSession) return null
    return o
  } catch {
    return null
  }
}

function publicFactsFromStored(raw: unknown): { facts: CoachPublicFacts; sessions21d: number; need: number } | null {
  if (!raw || typeof raw !== 'object') return null
  const f = raw as CoachFacts
  if (!f.week || !f.d30 || !f.d90 || !f.dataGate) return null
  return {
    facts: publicFacts(f),
    sessions21d: f.dataGate.sessions21d,
    need: f.dataGate.need,
  }
}

export async function getCoachState(userId: string, userEmail: string): Promise<CoachState> {
  const { start, end } = coachPeriodBounds(new Date(), env.gigachatCoachPeriodDays)
  const report = await prisma.workoutCoachReport.findUnique({
    where: { userId_periodStart: { userId, periodStart: start } },
  })
  const letter = report ? letterFromJson(report.letterJson) : null
  const stored = report ? publicFactsFromStored(report.factsJson) : null
  const demo = normalizeEmail(userEmail) === DEMO_EMAIL
  const configured = isGigachatConfigured()

  if (letter && stored) {
    return {
      status: 'cached',
      configured,
      eligible: true,
      canGenerate: false,
      demo,
      sessionsIn21d: stored.sessions21d,
      sessionsNeeded: stored.need,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      periodLabel: formatPeriodLabel(start, end),
      nextAt: end.toISOString(),
      facts: stored.facts,
      letter,
    }
  }

  const facts = await buildCoachFacts(userId)
  if (!facts) {
    throw Object.assign(new Error('not_found'), { status: 404 })
  }

  const eligible = facts.dataGate.eligible

  let status: CoachStatus = 'locked'
  if (letter) status = 'cached'
  else if (!eligible) status = 'locked'
  else if (!configured || demo) status = 'offline'
  else status = 'ready'

  return {
    status,
    configured,
    eligible,
    canGenerate: status === 'ready',
    demo,
    sessionsIn21d: facts.dataGate.sessions21d,
    sessionsNeeded: facts.dataGate.need,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    periodLabel: formatPeriodLabel(start, end),
    nextAt: end.toISOString(),
    facts: publicFacts(facts),
    letter,
  }
}

export class CoachGenerateError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function generateCoachLetter(userId: string, userEmail: string) {
  if (!(await userCanUseWorkoutRecap(userId))) {
    throw new CoachGenerateError('Недостаточно прав', 403)
  }
  const { start, end } = coachPeriodBounds(new Date(), env.gigachatCoachPeriodDays)
  const existing = await prisma.workoutCoachReport.findUnique({
    where: { userId_periodStart: { userId, periodStart: start } },
  })
  if (existing) {
    const letter = letterFromJson(existing.letterJson)
    if (letter) return { letter, createdAt: existing.createdAt.toISOString() }
    throw new CoachGenerateError('Следующий разбор — с понедельника', 429)
  }

  if (normalizeEmail(userEmail) === DEMO_EMAIL) {
    throw new CoachGenerateError('В демо-аккаунте разбор недоступен', 422)
  }
  if (!isGigachatConfigured()) {
    throw new CoachGenerateError('Разбор появится позже', 503)
  }

  const facts = await buildCoachFacts(userId)
  if (!facts) throw new CoachGenerateError('Не удалось собрать данные', 404)
  if (!facts.dataGate.eligible) {
    throw new CoachGenerateError(
      `Нужно минимум 4 тренировки за 21 день, чтобы появился разбор.`,
      422,
    )
  }

  let result: Awaited<ReturnType<typeof askGigachat>>
  try {
    result = await askGigachat(facts)
  } catch (err) {
    console.warn('[gigachat] coach generate failed', err instanceof Error ? err.message : err)
    throw new CoachGenerateError('Не удалось собрать разбор. Попробуй позже.', 503)
  }

  console.log('[gigachat] coach tokens', {
    model: result.model,
    prompt: result.promptTokens,
    completion: result.completionTokens,
  })

  try {
    const row = await prisma.workoutCoachReport.create({
      data: {
        userId,
        periodStart: start,
        periodEnd: end,
        factsJson: facts as unknown as Prisma.InputJsonValue,
        letterJson: result.letter as unknown as Prisma.InputJsonValue,
        model: result.model.slice(0, 80),
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
      },
    })
    return { letter: result.letter, createdAt: row.createdAt.toISOString() }
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new CoachGenerateError('Следующий разбор — с понедельника', 429)
    }
    throw err
  }
}
