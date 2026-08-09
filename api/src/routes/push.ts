import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../db.js'
import { getVapidPublicKey, isPushConfigured } from '../lib/push.js'
import { isAllowedPushEndpoint } from '../lib/pushEndpoint.js'
import { requireAuth, type AuthedEnv } from '../middleware/auth.js'

export const pushRoutes = new Hono<AuthedEnv>()

pushRoutes.get('/vapid-public-key', (c) => {
  if (!isPushConfigured()) {
    return c.json({ configured: false, publicKey: '' })
  }
  return c.json({ configured: true, publicKey: getVapidPublicKey() })
})

pushRoutes.use('/subscribe', requireAuth)
pushRoutes.use('/unsubscribe', requireAuth)

const subSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(10).max(512),
    auth: z.string().min(8).max(256),
  }),
})

pushRoutes.post('/subscribe', async (c) => {
  if (!isPushConfigured()) {
    return c.json({ error: 'Push не настроен на сервере' }, 503)
  }
  const body = subSchema.safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'Некорректная подписка' }, 400)
  if (!isAllowedPushEndpoint(body.data.endpoint)) {
    return c.json({ error: 'Недопустимый push-endpoint' }, 400)
  }

  const userId = c.get('userId')
  const ua = (c.req.header('user-agent') || '').slice(0, 240)
  const endpoint = body.data.endpoint

  const existing = await prisma.pushSubscription.findUnique({ where: { endpoint } })
  if (existing && existing.userId !== userId) {
    return c.json({ error: 'Эта подписка уже привязана к другому аккаунту' }, 409)
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      userId,
      endpoint,
      p256dh: body.data.keys.p256dh,
      auth: body.data.keys.auth,
      userAgent: ua,
    },
    update: {
      p256dh: body.data.keys.p256dh,
      auth: body.data.keys.auth,
      userAgent: ua,
    },
  })

  return c.json({ ok: true })
})

pushRoutes.post('/unsubscribe', async (c) => {
  const body = z
    .object({ endpoint: z.string().url().max(2000) })
    .safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'Некорректный endpoint' }, 400)

  const userId = c.get('userId')
  await prisma.pushSubscription.deleteMany({
    where: { userId, endpoint: body.data.endpoint },
  })
  return c.json({ ok: true })
})
