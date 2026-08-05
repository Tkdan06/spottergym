import { Hono } from 'hono'
import { expireStaleCheckIns } from '../lib/checkInExpiry.js'
import { prisma } from '../db.js'
import { listHiddenUserIds } from '../lib/blocks.js'
import { serializeGym, serializePublicUser } from '../lib/serialize.js'
import { requireAuth, type AuthedEnv } from '../middleware/auth.js'

export const gymRoutes = new Hono<AuthedEnv>()

gymRoutes.get('/', async (c) => {
  const city = c.req.query('city')?.trim().slice(0, 80)
  const network = c.req.query('network')?.trim().slice(0, 80)
  const q = c.req.query('q')?.trim().toLowerCase().slice(0, 80)

  const gyms = await prisma.gym.findMany({
    where: {
      ...(city ? { city } : {}),
      ...(network && network !== 'Все сети' ? { network } : {}),
    },
    orderBy: { name: 'asc' },
  })

  const filtered = q
    ? gyms.filter((g) =>
        `${g.name} ${g.network} ${g.district} ${g.address}`.toLowerCase().includes(q),
      )
    : gyms

  await expireStaleCheckIns()
  const ids = filtered.map((g) => g.id)
  const [memberCounts, activeCounts] = await Promise.all([
    prisma.userGym.groupBy({
      by: ['gymId'],
      where: { gymId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.checkIn.groupBy({
      by: ['gymId'],
      where: { gymId: { in: ids }, checkedOutAt: null },
      _count: { _all: true },
    }),
  ])

  const membersMap = new Map(memberCounts.map((m) => [m.gymId, m._count._all]))
  const activeMap = new Map(activeCounts.map((m) => [m.gymId, m._count._all]))

  return c.json({
    gyms: filtered.map((g) =>
      serializeGym(g, {
        membersCount: membersMap.get(g.id) || 0,
        activeNow: activeMap.get(g.id) || 0,
      }),
    ),
  })
})

gymRoutes.get('/:gymId', async (c) => {
  const gymId = c.req.param('gymId')
  const gym = await prisma.gym.findUnique({ where: { id: gymId } })
  if (!gym) return c.json({ error: 'Зал не найден' }, 404)

  await expireStaleCheckIns()
  const [membersCount, activeNow] = await Promise.all([
    prisma.userGym.count({ where: { gymId } }),
    prisma.checkIn.count({ where: { gymId, checkedOutAt: null } }),
  ])

  return c.json({
    gym: serializeGym(gym, { membersCount, activeNow }),
  })
})

gymRoutes.get('/:gymId/people', requireAuth, async (c) => {
  const gymId = c.req.param('gymId')
  const gym = await prisma.gym.findUnique({ where: { id: gymId } })
  if (!gym) return c.json({ error: 'Зал не найден' }, 404)

  const viewerId = c.get('userId')
  await expireStaleCheckIns()
  const hidden = await listHiddenUserIds(viewerId)

  const members = await prisma.userGym.findMany({
    where: {
      gymId,
      userId: hidden.length ? { notIn: hidden } : undefined,
    },
    include: {
      user: {
        include: {
          gyms: true,
          checkIns: { where: { checkedOutAt: null }, take: 1 },
        },
      },
    },
  })

  return c.json({
    people: members.map((m) => serializePublicUser(m.user)),
  })
})
