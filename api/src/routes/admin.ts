import { Hono } from 'hono'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../db.js'
import {
  EMPTY_PERMISSIONS,
  resolveAdminFlags,
  type AdminPermissions,
} from '../lib/admin.js'
import {
  buildAdminAnalytics,
  moscowDayKey,
  moscowDayStartUtc,
} from '../lib/adminAnalytics.js'
import { buildLandingAnalytics } from '../lib/landingAnalytics.js'
import { buildOpsHealth } from '../lib/opsFaults.js'
import { buildPasswordResetAnalytics } from '../lib/passwordResetAnalytics.js'
import { buildReferralAnalytics } from '../lib/referralAnalytics.js'
import { isMasterAdminEmail, normalizeEmail } from '../env.js'
import { serializeUser } from '../lib/serialize.js'
import { normalizeIp } from '../lib/blocks.js'
import {
  enableEmergencyShutdown,
  scheduleProcessShutdown,
} from '../lib/emergency.js'
import {
  createAndSendBroadcast,
  getBroadcast,
  listBroadcasts,
} from '../lib/adminBroadcast.js'
import { PASSWORD_MAX } from '../lib/fieldLimits.js'
import { verifyPassword } from '../lib/password.js'
import { SoftDeleteError, softDeleteUser } from '../lib/softDeleteUser.js'
import { requireAuth, type AuthedEnv } from '../middleware/auth.js'
import { rateLimit } from '../middleware/rateLimit.js'

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

adminRoutes.get('/password-resets', async (c) => {
  const gate = await requirePerm(c.get('userId'), 'viewUsers')
  if (!gate.ok) return c.json({ error: gate.error }, gate.status)
  const data = await buildPasswordResetAnalytics()
  return c.json(data)
})

adminRoutes.get('/landing', async (c) => {
  const gate = await requirePerm(c.get('userId'), 'viewUsers')
  if (!gate.ok) return c.json({ error: gate.error }, gate.status)
  const data = await buildLandingAnalytics()
  return c.json(data)
})

adminRoutes.get('/ops', async (c) => {
  const gate = await requirePerm(c.get('userId'), 'viewUsers')
  if (!gate.ok) return c.json({ error: gate.error }, gate.status)
  const data = await buildOpsHealth()
  return c.json(data)
})

adminRoutes.get('/referrals', async (c) => {
  const gate = await requirePerm(c.get('userId'), 'viewUsers')
  if (!gate.ok) return c.json({ error: gate.error }, gate.status)
  const data = await buildReferralAnalytics()
  return c.json(data)
})

adminRoutes.get('/users', async (c) => {
  const gate = await requirePerm(c.get('userId'), 'viewUsers')
  if (!gate.ok) return c.json({ error: gate.error }, gate.status)

  const q = (c.req.query('q') || '').trim().toLowerCase().slice(0, 80)
  const activity = (c.req.query('activity') || '').trim()
  const todayStart = moscowDayStartUtc(moscowDayKey(new Date()))

  let checkedInTodayByUser = new Map<
    string,
    { checkedInAt: Date; gymId: string }
  >()

  if (activity === 'checkedInToday') {
    const rows = await prisma.checkIn.findMany({
      where: { checkedInAt: { gte: todayStart } },
      select: { userId: true, checkedInAt: true, gymId: true },
      orderBy: { checkedInAt: 'desc' },
    })
    for (const row of rows) {
      if (!checkedInTodayByUser.has(row.userId)) {
        checkedInTodayByUser.set(row.userId, {
          checkedInAt: row.checkedInAt,
          gymId: row.gymId,
        })
      }
    }
  }

  const activityUserIds =
    activity === 'checkedInToday' ? [...checkedInTodayByUser.keys()] : null

  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      ...(activity === 'seenToday' ? { lastSeenAt: { gte: todayStart } } : {}),
      ...(activityUserIds
        ? { id: { in: activityUserIds.length ? activityUserIds : ['__none__'] } }
        : {}),
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { username: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
              { city: { contains: q, mode: 'insensitive' } },
              { signupIp: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      email: true,
      username: true,
      instagram: true,
      name: true,
      age: true,
      gender: true,
      bio: true,
      city: true,
      homeGymId: true,
      intent: true,
      experienceLevel: true,
      interests: true,
      sports: true,
      isCoach: true,
      coachSports: true,
      visitSlots: true,
      breakUntil: true,
      privacy: true,
      lookingToMeet: true,
      referralStatusVisible: true,
      referralCreditedCount: true,
      onboardingDone: true,
      isAdmin: true,
      isMasterAdmin: true,
      adminPermissions: true,
      registeredAt: true,
      lastSeenAt: true,
      signupIp: true,
      deletedAt: true,
      tokenVersion: true,
      createdAt: true,
      updatedAt: true,
      gyms: true,
      checkIns: { where: { checkedOutAt: null }, take: 1 },
    },
    orderBy:
      activity === 'seenToday'
        ? { lastSeenAt: 'desc' }
        : activity === 'checkedInToday'
          ? { lastSeenAt: 'desc' }
          : { registeredAt: 'desc' },
    take: 300,
  })

  if (activity !== 'checkedInToday' && users.length) {
    const todayRows = await prisma.checkIn.findMany({
      where: { userId: { in: users.map((u) => u.id) }, checkedInAt: { gte: todayStart } },
      select: { userId: true, checkedInAt: true, gymId: true },
      orderBy: { checkedInAt: 'desc' },
    })
    checkedInTodayByUser = new Map()
    for (const row of todayRows) {
      if (!checkedInTodayByUser.has(row.userId)) {
        checkedInTodayByUser.set(row.userId, {
          checkedInAt: row.checkedInAt,
          gymId: row.gymId,
        })
      }
    }
  }

  if (activity === 'checkedInToday') {
    users.sort((a, b) => {
      const at = checkedInTodayByUser.get(a.id)?.checkedInAt.getTime() || 0
      const bt = checkedInTodayByUser.get(b.id)?.checkedInAt.getTime() || 0
      return bt - at
    })
  }

  const viewerIsMaster = gate.flags.isMasterAdmin

  const signupIps = [
    ...new Set(
      users
        .map((u) => u.signupIp?.trim() || '')
        .filter((ip) => ip && ip !== 'unknown'),
    ),
  ]
  const signupIpCounts = new Map<string, number>()
  if (signupIps.length) {
    const grouped = await prisma.user.groupBy({
      by: ['signupIp'],
      where: { deletedAt: null, signupIp: { in: signupIps } },
      _count: { _all: true },
    })
    for (const row of grouped) {
      signupIpCounts.set(row.signupIp, row._count._all)
    }
  }

  const photoStats = new Map<string, { n: number; bytes: number }>()
  if (users.length) {
    const rows = await prisma.$queryRaw<Array<{ id: string; n: number; bytes: number }>>`
      SELECT id,
        COALESCE(cardinality(photos), 0)::int AS n,
        COALESCE(octet_length(array_to_string(photos, '')), 0)::int AS bytes
      FROM "User"
      WHERE id IN (${Prisma.join(users.map((u) => u.id))})
    `
    for (const row of rows) photoStats.set(row.id, { n: row.n, bytes: row.bytes })
  }

  return c.json({
    users: users.map((u) => {
      const full = serializeUser({ ...u, photos: [], avatar: '', passwordHash: '' })
      const { photos: _photos, avatar: _avatar, ...rest } = full
      const hideMasterEmail = !viewerIsMaster && isMasterAdminEmail(u.email)
      const todayCheckIn = checkedInTodayByUser.get(u.id)
      const signupIp = u.signupIp?.trim() || ''
      const signupIpCount =
        signupIp && signupIp !== 'unknown' ? signupIpCounts.get(signupIp) || 1 : 0
      const photos = photoStats.get(u.id)
      return {
        ...rest,
        // Master email stays server-side for non-master admins
        email: hideMasterEmail ? 'скрыто' : rest.email,
        photos: [] as string[],
        avatar: '',
        photosCount: photos?.n || 0,
        photosBytes: photos?.bytes || 0,
        checkedInTodayAt: todayCheckIn?.checkedInAt.toISOString() || '',
        checkedInTodayGymId: todayCheckIn?.gymId || '',
        signupIp,
        signupIpCount,
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

adminRoutes.get('/blocked-ips', async (c) => {
  const gate = await requirePerm(c.get('userId'), 'blockUsers')
  if (!gate.ok) return c.json({ error: gate.error }, gate.status)

  const rows = await prisma.blockedIp.findMany({ orderBy: { createdAt: 'desc' } })
  return c.json({ ips: rows.map((r) => r.ip) })
})

adminRoutes.post('/blocked-ips', async (c) => {
  const gate = await requirePerm(c.get('userId'), 'blockUsers')
  if (!gate.ok) return c.json({ error: gate.error }, gate.status)

  const body = z
    .object({
      ip: z.string().min(2).max(64),
      reason: z.string().max(500).optional(),
    })
    .safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'Некорректный IP' }, 400)

  const ip = normalizeIp(body.data.ip)
  if (!ip || ip === 'unknown') {
    return c.json({ error: 'Некорректный IP' }, 400)
  }

  await prisma.blockedIp.upsert({
    where: { ip },
    create: {
      ip,
      reason: body.data.reason || '',
      blockedById: c.get('userId'),
    },
    update: {
      reason: body.data.reason || '',
      blockedById: c.get('userId'),
    },
  })

  const rows = await prisma.blockedIp.findMany({ orderBy: { createdAt: 'desc' } })
  return c.json({ ips: rows.map((r) => r.ip) })
})

adminRoutes.delete('/blocked-ips/:ip', async (c) => {
  const gate = await requirePerm(c.get('userId'), 'blockUsers')
  if (!gate.ok) return c.json({ error: gate.error }, gate.status)

  const ip = normalizeIp(decodeURIComponent(c.req.param('ip') || ''))
  if (!ip) return c.json({ error: 'Некорректный IP' }, 400)

  await prisma.blockedIp.deleteMany({ where: { ip } })
  const rows = await prisma.blockedIp.findMany({ orderBy: { createdAt: 'desc' } })
  return c.json({ ips: rows.map((r) => r.ip) })
})

adminRoutes.delete('/users/:id', async (c) => {
  const gate = await requirePerm(c.get('userId'), 'removeUsers')
  if (!gate.ok) return c.json({ error: gate.error }, gate.status)

  const id = c.req.param('id')
  const alsoBlock =
    c.req.query('alsoBlock') === '1' ||
    c.req.query('alsoBlock') === 'true'
  try {
    const result = await softDeleteUser(id, {
      actorId: c.get('userId'),
      alsoBlockEmail: alsoBlock,
    })
    return c.json({ ok: true, email: result.email })
  } catch (err) {
    if (err instanceof SoftDeleteError) {
      return c.json({ error: err.message }, err.status)
    }
    throw err
  }
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

adminRoutes.get('/broadcasts', async (c) => {
  const gate = await requirePerm(c.get('userId'), 'messageUsers')
  if (!gate.ok) return c.json({ error: gate.error }, gate.status)
  const broadcasts = await listBroadcasts()
  return c.json({ broadcasts })
})

adminRoutes.get('/broadcasts/:id', async (c) => {
  const gate = await requirePerm(c.get('userId'), 'messageUsers')
  if (!gate.ok) return c.json({ error: gate.error }, gate.status)
  const broadcast = await getBroadcast(c.req.param('id'))
  if (!broadcast) return c.json({ error: 'Рассылка не найдена' }, 404)
  return c.json({ broadcast })
})

adminRoutes.post(
  '/broadcasts',
  rateLimit({ windowMs: 60 * 60_000, max: 10, route: 'admin-broadcast' }),
  async (c) => {
    const gate = await requirePerm(c.get('userId'), 'messageUsers')
    if (!gate.ok) return c.json({ error: gate.error }, gate.status)

    const parsed = z
      .object({
        title: z.string().trim().min(1).max(120),
        body: z.string().trim().min(1).max(500),
      })
      .safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json({ error: 'Укажи заголовок и текст сообщения' }, 400)
    }

    try {
      const broadcast = await createAndSendBroadcast({
        adminId: c.get('userId'),
        title: parsed.data.title,
        body: parsed.data.body,
      })
      return c.json({ broadcast }, 201)
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : 'Не удалось отправить' },
        400,
      )
    }
  },
)

/** Master-only kill switch: re-check password, persist flag, then exit process. */
adminRoutes.post(
  '/emergency-shutdown',
  rateLimit({ windowMs: 60 * 60_000, max: 5, route: 'admin-emergency-shutdown' }),
  async (c) => {
    const userId = c.get('userId')
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user || user.deletedAt) {
      return c.json({ error: 'Требуется вход' }, 401)
    }
    const flags = resolveAdminFlags(user)
    if (!flags.isMasterAdmin) {
      return c.json({ error: 'Только главный админ может выключить сервис' }, 403)
    }

    const body = z
      .object({
        password: z.string().min(1).max(PASSWORD_MAX),
        confirm: z.literal('SHUTDOWN'),
      })
      .safeParse(await c.req.json().catch(() => null))
    if (!body.success) {
      return c.json(
        { error: 'Нужен пароль и подтверждение SHUTDOWN' },
        400,
      )
    }

    const ok = await verifyPassword(user.passwordHash, body.data.password)
    if (!ok) {
      return c.json({ error: 'Неверный пароль' }, 401)
    }

    await enableEmergencyShutdown(user.id)
    scheduleProcessShutdown(500)

    return c.json({
      ok: true,
      emergency: true,
      message: 'Сервис отключается',
    })
  },
)
