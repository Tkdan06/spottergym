import { Hono } from 'hono'
import { z } from 'zod'
import {
  isLandingEventName,
  logLandingEvent,
} from '../lib/landingAnalytics.js'
import { clientIp, rateLimit } from '../middleware/rateLimit.js'

export const analyticsRoutes = new Hono()

const eventSchema = z.object({
  name: z.string().min(1).max(40),
  visitorId: z.string().min(8).max(64),
  sessionId: z.string().max(64).optional(),
  placement: z.string().max(32).optional(),
  path: z.string().max(80).optional(),
  utmSource: z.string().max(80).optional(),
  utmMedium: z.string().max(80).optional(),
  utmCampaign: z.string().max(120).optional(),
  utmContent: z.string().max(120).optional(),
  utmTerm: z.string().max(120).optional(),
  fromParam: z.string().max(40).optional(),
  userId: z.string().max(64).optional().nullable(),
})

analyticsRoutes.post(
  '/lp',
  rateLimit({ windowMs: 60_000, max: 60, route: 'analytics-lp' }),
  async (c) => {
    const body = await c.req.json().catch(() => null)
    const parsed = eventSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: 'Некорректные данные' }, 400)
    if (!isLandingEventName(parsed.data.name)) {
      return c.json({ error: 'Неизвестное событие' }, 400)
    }

    const result = await logLandingEvent({
      ...parsed.data,
      name: parsed.data.name,
      userAgent: c.req.header('user-agent') || '',
      ip: clientIp(c),
    })

    if (!result.ok && result.reason === 'visitor') {
      return c.json({ error: 'Некорректные данные' }, 400)
    }
    return c.json({ ok: true, deduped: Boolean(result.ok && 'deduped' in result && result.deduped) })
  },
)
