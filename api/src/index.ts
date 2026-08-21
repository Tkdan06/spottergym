import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { z } from 'zod'
import { prisma } from './db.js'
import { env, isMasterAdminEmail, isGigachatConfigured, normalizeEmail } from './env.js'
import {
  disableEmergencyShutdown,
  isEmergencyShutdown,
} from './lib/emergency.js'
import { HTTP_BODY_MAX_BYTES, PASSWORD_MAX } from './lib/fieldLimits.js'
import { verifyPassword } from './lib/password.js'
import { isPushConfigured } from './lib/push.js'
import { startBroadcastLoop } from './lib/adminBroadcast.js'
import { startWorkoutReminderLoop } from './lib/workoutReminders.js'
import { rateLimit } from './middleware/rateLimit.js'
import { adminRoutes } from './routes/admin.js'
import { analyticsRoutes } from './routes/analytics.js'
import { authRoutes } from './routes/auth.js'
import { mediaRoutes } from './routes/media.js'
import { blockRoutes } from './routes/blocks.js'
import { conversationRoutes } from './routes/conversations.js'
import { gymRoutes } from './routes/gyms.js'
import { likesRoutes } from './routes/likes.js'
import { meRoutes } from './routes/me.js'
import { notificationRoutes } from './routes/notifications.js'
import { pushRoutes } from './routes/push.js'
import { ticketRoutes } from './routes/tickets.js'
import { userRoutes } from './routes/users.js'

const app = new Hono()

app.use('*', logger())
app.use('*', async (c, next) => {
  await next()
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.header('X-DNS-Prefetch-Control', 'off')
})
app.use(
  '*',
  bodyLimit({
    maxSize: HTTP_BODY_MAX_BYTES,
    onError: (c) => c.json({ error: 'Слишком большой запрос' }, 413),
  }),
)
app.use(
  '*',
  cors({
    origin: (origin) => {
      if (!origin) return env.corsOrigins[0] || '*'
      if (env.corsOrigins.includes(origin)) return origin
      if (env.allowLanCors) {
        if (/^http:\/\/192\.168\.\d+\.\d+:5173$/.test(origin)) return origin
        if (/^http:\/\/10\.\d+\.\d+\.\d+:5173$/.test(origin)) return origin
      }
      return env.corsOrigins[0] || ''
    },
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization', 'X-Spotter-Token'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
)

/** When emergency flag is on, block everything except health + recover. */
app.use('*', async (c, next) => {
  if (c.req.method === 'OPTIONS') return next()
  const path = c.req.path
  if (path === '/health' || path === '/admin/emergency-recover') {
    return next()
  }
  if (await isEmergencyShutdown()) {
    return c.json({ error: 'Сервис временно отключён', emergency: true }, 503)
  }
  return next()
})

app.get('/health', async (c) => {
  const emergency = await isEmergencyShutdown()
  return c.json(
    { ok: !emergency, service: 'spotter-api', emergency },
    emergency ? 503 : 200,
  )
})

/** Turn service back on without a session (master email + password). */
app.post(
  '/admin/emergency-recover',
  rateLimit({ windowMs: 60 * 60_000, max: 10, route: 'admin-emergency-recover' }),
  async (c) => {
    if (!(await isEmergencyShutdown())) {
      return c.json({ ok: true, emergency: false, message: 'Сервис уже работает' })
    }

    const body = z
      .object({
        email: z.string().email().max(254),
        password: z.string().min(1).max(PASSWORD_MAX),
      })
      .safeParse(await c.req.json().catch(() => null))
    if (!body.success) {
      return c.json({ error: 'Укажи email и пароль главного админа' }, 400)
    }

    const email = normalizeEmail(body.data.email)
    if (!isMasterAdminEmail(email)) {
      return c.json({ error: 'Неверные данные' }, 401)
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || user.deletedAt) {
      return c.json({ error: 'Неверные данные' }, 401)
    }

    const ok = await verifyPassword(user.passwordHash, body.data.password)
    if (!ok) {
      return c.json({ error: 'Неверные данные' }, 401)
    }

    await disableEmergencyShutdown(user.id)
    return c.json({ ok: true, emergency: false, message: 'Сервис снова доступен' })
  },
)

app.route('/analytics', analyticsRoutes)
app.route('/media', mediaRoutes)
app.route('/auth', authRoutes)
app.route('/me', meRoutes)
app.route('/users', userRoutes)
app.route('/gyms', gymRoutes)
app.route('/likes', likesRoutes)
app.route('/notifications', notificationRoutes)
app.route('/push', pushRoutes)
app.route('/tickets', ticketRoutes)
app.route('/conversations', conversationRoutes)
app.route('/blocks', blockRoutes)
app.route('/admin', adminRoutes)

app.notFound((c) => c.json({ error: 'Не найдено' }, 404))
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Внутренняя ошибка сервера' }, 500)
})

serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`Spotter API http://localhost:${info.port}`)
  console.log(`[push] ${isPushConfigured() ? 'VAPID ready' : 'disabled (set VAPID_* keys)'}`)
  console.log(
    `[gigachat] ${isGigachatConfigured() ? 'ready' : 'disabled (set GIGACHAT_CREDENTIALS)'}`,
  )
  void isEmergencyShutdown().then((on) => {
    if (on) console.error('[emergency] API started in SHUTDOWN mode — only /health and recover')
  })
  startWorkoutReminderLoop()
  startBroadcastLoop()
})
