import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { env } from './env.js'
import { HTTP_BODY_MAX_BYTES } from './lib/fieldLimits.js'
import { isPushConfigured } from './lib/push.js'
import { startWorkoutReminderLoop } from './lib/workoutReminders.js'
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

app.get('/health', (c) => c.json({ ok: true, service: 'spotter-api' }))

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
  startWorkoutReminderLoop()
})
