import { prisma } from '../db.js'

export const APP_EVENT_NAMES = [
  'registration_completed',
  'gym_selected',
  'gym_skipped',
  'profile_completed',
  'first_checkin',
  'people_list_viewed',
  'profile_viewed',
  'like_sent',
  'chat_request_sent',
  'chat_request_accepted',
  'first_message_sent',
  'workout_started',
  'exercise_added',
  'workout_saved',
  'progress_opened',
  'activity_opened',
  'ai_analysis_opened',
  'ai_analysis_requested',
  'ai_analysis_completed',
  'ai_analysis_failed',
  'ai_recommendation_viewed',
] as const

export type AppEventName = (typeof APP_EVENT_NAMES)[number]

const ONCE_PER_USER: ReadonlySet<string> = new Set([
  'registration_completed',
  'profile_completed',
  'first_checkin',
  'first_message_sent',
])

const META_KEYS = ['source', 'range', 'reason', 'surface'] as const

export function isAppEventName(value: string): value is AppEventName {
  return (APP_EVENT_NAMES as readonly string[]).includes(value)
}

function clip(value: string | undefined | null, max: number) {
  return (value || '').trim().slice(0, max)
}

/** Keep only allowlisted metadata — never workout numbers, names, or messages. */
export function sanitizeAppMeta(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return ''
  const out: Record<string, string> = {}
  const rec = raw as Record<string, unknown>
  for (const key of META_KEYS) {
    const v = rec[key]
    if (typeof v === 'string' && v.trim()) out[key] = v.trim().slice(0, 32)
  }
  const keys = Object.keys(out)
  if (!keys.length) return ''
  return JSON.stringify(out).slice(0, 160)
}

export async function logAppEvent(input: {
  name: AppEventName
  visitorId: string
  sessionId?: string
  path?: string
  meta?: unknown
  userId?: string | null
  userAgent?: string
  ip?: string
}) {
  const visitorId = clip(input.visitorId, 64) || (input.userId ? `u:${input.userId}` : '')
  if (!visitorId) return { ok: false as const, reason: 'visitor' }

  const userId = input.userId || null
  if (userId && ONCE_PER_USER.has(input.name)) {
    const existing = await prisma.landingEvent.findFirst({
      where: { userId, name: input.name },
      select: { id: true },
    })
    if (existing) return { ok: true as const, deduped: true }
  }

  const placement = sanitizeAppMeta(input.meta)

  try {
    await prisma.landingEvent.create({
      data: {
        name: input.name,
        visitorId,
        sessionId: clip(input.sessionId, 64),
        placement,
        path: clip(input.path, 80) || '/app',
        userAgent: clip(input.userAgent, 240),
        ip: clip(input.ip, 64),
        userId,
      },
    })
    return { ok: true as const, deduped: false }
  } catch (err) {
    console.warn('[app-analytics] log event failed', err)
    return { ok: false as const, reason: 'db' }
  }
}
