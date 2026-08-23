import { Hono } from 'hono'
import { z } from 'zod'
import { scheduleExpireStaleCheckIns } from '../lib/checkInExpiry.js'
import { prisma } from '../db.js'
import { resolveAdminFlags } from '../lib/admin.js'
import { areUsersBlocked, listHiddenUserIds } from '../lib/blocks.js'
import { getReferralStatsForUser, getReferralStatsMap } from '../lib/referralStats.js'
import { serializePublicUser } from '../lib/serialize.js'
import { loadAuthedUser, requireAuth, type AuthedEnv } from '../middleware/auth.js'
import { rateLimit } from '../middleware/rateLimit.js'
import { normalizeUsername } from '../lib/username.js'

export const userRoutes = new Hono<AuthedEnv>()

userRoutes.use('*', requireAuth)

const userInclude = {
  gyms: true,
  checkIns: { where: { checkedOutAt: null }, take: 1 },
} as const

async function viewerCanRevealAnonymous(userId: string) {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      isAdmin: true,
      isMasterAdmin: true,
      adminPermissions: true,
      deletedAt: true,
    },
  })
  if (!me || me.deletedAt) return false
  const flags = resolveAdminFlags(me)
  return flags.isAdmin && flags.adminPermissions.viewUsers
}

/** Partial @username / name search */
userRoutes.get(
  '/search',
  rateLimit({ windowMs: 60_000, max: 60, route: 'users-search' }),
  async (c) => {
  const raw = (c.req.query('q') || '').trim()
  const q = normalizeUsername(raw) || raw.toLowerCase()
  if (q.length < 2) {
    return c.json({ error: 'Введи минимум 2 символа' }, 400)
  }
  const me = c.get('userId')
  scheduleExpireStaleCheckIns()
  const hidden = await listHiddenUserIds(me)
  const nick = q.replace(/[^a-z0-9_]/g, '')
  const nameQ = raw.replace(/^@+/, '').trim()

  // Name match only for open profiles — anonymous stay findable by @username (product choice)
  const found = await prisma.user.findMany({
    where: {
      deletedAt: null,
      id: { notIn: [me, ...hidden] },
      OR: [
        ...(nick.length >= 2
          ? [{ username: { contains: nick, mode: 'insensitive' as const } }]
          : []),
        {
          AND: [
            { privacy: 'open' },
            { name: { contains: nameQ, mode: 'insensitive' } },
          ],
        },
        { username: { contains: q, mode: 'insensitive' } },
      ],
    },
    include: userInclude,
    take: 20,
    orderBy: { username: 'asc' },
  })

  const tierMap = await getReferralStatsMap(found.map((u) => u.id))
  return c.json({
    users: found.map((u) => serializePublicUser(u, { referral: tierMap.get(u.id) })),
  })
})

/** Exact lookup by public @username */
userRoutes.get('/by-username/:username', async (c) => {
  const username = normalizeUsername(c.req.param('username') || '')
  if (username.length < 3 || username.length > 20) {
    return c.json({ error: 'Некорректный @ник' }, 400)
  }

  const found = await prisma.user.findUnique({
    where: { username },
    include: userInclude,
  })
  if (!found) {
    return c.json({ error: 'Пользователь не найден' }, 404)
  }

  const me = c.get('userId')
  if (await areUsersBlocked(me, found.id)) {
    return c.json({ error: 'Пользователь недоступен' }, 403)
  }

  const referral = await getReferralStatsForUser(found.id, found.referralCreditedCount)
  return c.json({ user: serializePublicUser(found, { referral }) })
})

userRoutes.get('/:id', async (c) => {
  const id = z.string().min(1).max(64).safeParse(c.req.param('id'))
  if (!id.success) {
    return c.json({ error: 'Некорректный id' }, 400)
  }

  const me = c.get('userId')
  const wantReveal =
    c.req.query('reveal') === '1' || c.req.query('reveal') === 'true'
  const revealAnonymous = wantReveal ? await viewerCanRevealAnonymous(me) : false
  if (wantReveal && !revealAnonymous) {
    return c.json({ error: 'Недостаточно прав' }, 403)
  }

  if (id.data === me) {
    const self = await loadAuthedUser(me)
    if (!self) return c.json({ error: 'Аккаунт не найден' }, 404)
    const referral = await getReferralStatsForUser(self.id, self.referralCreditedCount)
    return c.json({ user: serializePublicUser(self, { revealAnonymous, referral }) })
  }

  scheduleExpireStaleCheckIns()
  const found = await prisma.user.findFirst({
    where: { id: id.data, deletedAt: null },
    include: userInclude,
  })
  if (!found) return c.json({ error: 'Пользователь не найден' }, 404)
  if (await areUsersBlocked(me, found.id)) {
    return c.json({ error: 'Пользователь недоступен' }, 403)
  }

  const referral = await getReferralStatsForUser(found.id, found.referralCreditedCount)
  return c.json({
    user: serializePublicUser(found, { revealAnonymous, referral }),
  })
})
