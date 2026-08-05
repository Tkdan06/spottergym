import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../db.js'
import {
  getOrCreatePrefs,
  serializeNotification,
  serializePrefs,
} from '../lib/notify.js'
import { requireAuth, type AuthedEnv } from '../middleware/auth.js'

export const notificationRoutes = new Hono<AuthedEnv>()

notificationRoutes.use('*', requireAuth)

notificationRoutes.get('/prefs', async (c) => {
  const prefs = await getOrCreatePrefs(c.get('userId'))
  return c.json({ prefs: serializePrefs(prefs) })
})

const prefsSchema = z
  .object({
    enabled: z.boolean().optional(),
    gymNewMembers: z.boolean().optional(),
    likes: z.boolean().optional(),
    chatRequests: z.boolean().optional(),
    checkins: z.boolean().optional(),
    coaches: z.boolean().optional(),
    system: z.boolean().optional(),
    workoutReminders: z.boolean().optional(),
  })
  .strict()

notificationRoutes.patch('/prefs', async (c) => {
  const body = prefsSchema.safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'Некорректные настройки' }, 400)
  const userId = c.get('userId')
  await getOrCreatePrefs(userId)
  const prefs = await prisma.notificationPrefs.update({
    where: { userId },
    data: body.data,
  })
  return c.json({ prefs: serializePrefs(prefs) })
})

notificationRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const list = await prisma.notification.findMany({
    where: {
      userId,
      // Legacy: message pings used chat_request + this title; chat badge covers those now
      NOT: { title: 'Новое сообщение' },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return c.json({ notifications: list.map(serializeNotification) })
})

notificationRoutes.post('/read-all', async (c) => {
  const userId = c.get('userId')
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  })
  return c.json({ ok: true })
})

notificationRoutes.patch('/:id/read', async (c) => {
  const id = z.string().min(1).max(64).safeParse(c.req.param('id'))
  if (!id.success) return c.json({ error: 'Некорректный id' }, 400)
  const userId = c.get('userId')
  const n = await prisma.notification.findFirst({
    where: { id: id.data, userId },
  })
  if (!n) return c.json({ error: 'Не найдено' }, 404)
  const updated = await prisma.notification.update({
    where: { id: n.id },
    data: { read: true },
  })
  return c.json({ notification: serializeNotification(updated) })
})
