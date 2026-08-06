import { Hono } from 'hono'
import { z } from 'zod'
import { expireStaleCheckIns } from '../lib/checkInExpiry.js'
import { prisma } from '../db.js'
import { areUsersBlocked, listHiddenUserIds } from '../lib/blocks.js'
import { serializePublicUser } from '../lib/serialize.js'
import { loadAuthedUser, requireAuth, type AuthedEnv } from '../middleware/auth.js'
import { normalizeUsername } from '../lib/username.js'

export const userRoutes = new Hono<AuthedEnv>()

userRoutes.use('*', requireAuth)

const userInclude = {
  gyms: true,
  checkIns: { where: { checkedOutAt: null }, take: 1 },
} as const

/** Partial @username / name search */
userRoutes.get('/search', async (c) => {
  const raw = (c.req.query('q') || '').trim()
  const q = normalizeUsername(raw) || raw.toLowerCase()
  if (q.length < 2) {
    return c.json({ error: 'Введи минимум 2 символа' }, 400)
  }
  const me = c.get('userId')
  await expireStaleCheckIns()
  const hidden = await listHiddenUserIds(me)
  const nick = q.replace(/[^a-z0-9_]/g, '')
  const nameQ = raw.replace(/^@+/, '').trim()

  const found = await prisma.user.findMany({
    where: {
      deletedAt: null,
      id: { notIn: [me, ...hidden] },
      OR: [
        ...(nick.length >= 2
          ? [{ username: { contains: nick, mode: 'insensitive' as const } }]
          : []),
        { name: { contains: nameQ, mode: 'insensitive' } },
        { username: { contains: q, mode: 'insensitive' } },
      ],
    },
    include: userInclude,
    take: 20,
    orderBy: { username: 'asc' },
  })

  return c.json({ users: found.map(serializePublicUser) })
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

  return c.json({ user: serializePublicUser(found) })
})

userRoutes.get('/:id', async (c) => {
  const id = z.string().min(1).max(64).safeParse(c.req.param('id'))
  if (!id.success) {
    return c.json({ error: 'Некорректный id' }, 400)
  }

  const me = c.get('userId')
  if (id.data === me) {
    const self = await loadAuthedUser(me)
    if (!self) return c.json({ error: 'Аккаунт не найден' }, 404)
    return c.json({ user: serializePublicUser(self) })
  }

  if (await areUsersBlocked(me, id.data)) {
    return c.json({ error: 'Пользователь недоступен' }, 403)
  }

  const found = await prisma.user.findUnique({
    where: { id: id.data },
    include: userInclude,
  })
  if (!found) {
    return c.json({ error: 'Пользователь не найден' }, 404)
  }

  return c.json({ user: serializePublicUser(found) })
})
