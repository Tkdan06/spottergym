import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../db.js'
import {
  EMPTY_PERMISSIONS,
  resolveAdminFlags,
  type AdminPermissions,
} from '../lib/admin.js'
import { buildAdminAnalytics, estimatePhotosBytes } from '../lib/adminAnalytics.js'
import { isMasterAdminEmail, normalizeEmail } from '../env.js'
import { serializeUser } from '../lib/serialize.js'
import { requireAuth, type AuthedEnv } from '../middleware/auth.js'

export const adminRoutes = new Hono<AuthedEnv>()

adminRoutes.use('*', requireAuth)

type GateOk = {
  ok: true
  user: NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>
  flags: ReturnType<typeof resolveAdminFlags>
}
type GateErr = { ok: false; error: string; status: 401 | 403 }

async function requirePerm(
  userId: string,
  key: keyof AdminPermissions,
): Promise<GateOk | GateErr> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return { ok: false, error: 'Требуется вход', status: 401 }
  const flags = resolveAdminFlags(user)
  if (!flags.isAdmin || !flags.adminPermissions[key]) {
    return { ok: false, error: 'Недостаточно прав', status: 403 }
  }
  return { ok: true, user, flags }
}

adminRoutes.get('/analytics', async (c) => {
  const gate = await requirePerm(c.get('userId'), 'viewUsers')
  if (!gate.ok) return c.json({ error: gate.error }, gate.status)
  const analytics = await buildAdminAnalytics()
  return c.json({ analytics })
})

adminRoutes.get('/users', async (c) => {
  const gate = await requirePerm(c.get('userId'), 'viewUsers')
  if (!gate.ok) return c.json({ error: gate.error }, gate.status)

  const q = (c.req.query('q') || '').trim().toLowerCase().slice(0, 80)
  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' } },
            { username: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
            { city: { contains: q, mode: 'insensitive' } },
          ],
        }
      : undefined,
    include: {
      gyms: true,
      checkIns: { where: { checkedOutAt: null }, take: 1 },
    },
    orderBy: { registeredAt: 'desc' },
    take: 300,
  })

  return c.json({
    users: users.map((u) => {
      const full = serializeUser(u)
      const photos = u.photos || []
      // Slim payload: no photo blobs in admin directory
      const { photos: _photos, avatar: _avatar, ...rest } = full
      return {
        ...rest,
        photos: [] as string[],
        avatar: '',
        photosCount: photos.length,
        photosBytes: estimatePhotosBytes(photos),
      }
    }),
  })
})

adminRoutes.get('/blocked-emails', async (c) => {
  const gate = await requirePerm(c.get('userId'), 'blockUsers')
  if (!gate.ok) return c.json({ error: gate.error }, gate.status)

  const rows = await prisma.blockedEmail.findMany({ orderBy: { createdAt: 'desc' } })
  return c.json({ emails: rows.map((r) => r.email) })
})

adminRoutes.post('/blocked-emails', async (c) => {
  const gate = await requirePerm(c.get('userId'), 'blockUsers')
  if (!gate.ok) return c.json({ error: gate.error }, gate.status)

  const body = z
    .object({
      email: z.string().email().max(254),
      reason: z.string().max(500).optional(),
    })
    .safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'Некорректный email' }, 400)

  const email = normalizeEmail(body.data.email)
  if (isMasterAdminEmail(email)) {
    return c.json({ error: 'Нельзя блокировать главного админа' }, 400)
  }

  await prisma.blockedEmail.upsert({
    where: { email },
    create: {
      email,
      reason: body.data.reason || '',
      blockedById: c.get('userId'),
    },
    update: {
      reason: body.data.reason || '',
      blockedById: c.get('userId'),
    },
  })

  const rows = await prisma.blockedEmail.findMany({ orderBy: { createdAt: 'desc' } })
  return c.json({ emails: rows.map((r) => r.email) })
})

adminRoutes.delete('/blocked-emails/:email', async (c) => {
  const gate = await requirePerm(c.get('userId'), 'blockUsers')
  if (!gate.ok) return c.json({ error: gate.error }, gate.status)

  const email = normalizeEmail(decodeURIComponent(c.req.param('email') || ''))
  await prisma.blockedEmail.deleteMany({ where: { email } })
  const rows = await prisma.blockedEmail.findMany({ orderBy: { createdAt: 'desc' } })
  return c.json({ emails: rows.map((r) => r.email) })
})

adminRoutes.delete('/users/:id', async (c) => {
  const gate = await requirePerm(c.get('userId'), 'removeUsers')
  if (!gate.ok) return c.json({ error: gate.error }, gate.status)

  const id = c.req.param('id')
  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) return c.json({ error: 'Пользователь не найден' }, 404)
  if (isMasterAdminEmail(target.email)) {
    return c.json({ error: 'Нельзя удалить главного админа' }, 400)
  }
  if (target.id === c.get('userId')) {
    return c.json({ error: 'Нельзя удалить себя' }, 400)
  }

  await prisma.user.delete({ where: { id } })
  return c.json({ ok: true })
})

const permsSchema = z.object({
  tickets: z.boolean(),
  messageUsers: z.boolean(),
  viewUsers: z.boolean(),
  blockUsers: z.boolean(),
  removeUsers: z.boolean(),
  manageAdmins: z.boolean(),
})

adminRoutes.patch('/users/:id/admin', async (c) => {
  const gate = await requirePerm(c.get('userId'), 'manageAdmins')
  if (!gate.ok) return c.json({ error: gate.error }, gate.status)
  if (!gate.flags.isMasterAdmin) {
    return c.json({ error: 'Только главный админ может менять права' }, 403)
  }

  const body = z
    .object({
      isAdmin: z.boolean(),
      permissions: permsSchema.optional(),
    })
    .safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'Некорректные данные' }, 400)

  const target = await prisma.user.findUnique({ where: { id: c.req.param('id') } })
  if (!target) return c.json({ error: 'Пользователь не найден' }, 404)
  if (isMasterAdminEmail(target.email)) {
    return c.json({ error: 'Права главного админа нельзя менять' }, 400)
  }

  const perms = body.data.isAdmin
    ? body.data.permissions || {
        ...EMPTY_PERMISSIONS,
        tickets: true,
        messageUsers: true,
        viewUsers: true,
      }
    : EMPTY_PERMISSIONS

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: {
      isAdmin: body.data.isAdmin,
      isMasterAdmin: false,
      adminPermissions: body.data.isAdmin ? perms : EMPTY_PERMISSIONS,
    },
    include: {
      gyms: true,
      checkIns: { where: { checkedOutAt: null }, take: 1 },
    },
  })

  return c.json({ user: serializeUser(updated) })
})
