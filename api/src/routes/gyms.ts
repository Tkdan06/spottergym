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
  const elsewhere = c.req.query('elsewhere') === '1'
  const excludeCity = c.req.query('excludeCity')?.trim().slice(0, 80)

  // Подсказки «клуб в другом городе» — короткий список без тяжёлых счётчиков
  if (elsewhere) {
    if (!q || q.length < 3) return c.json({ gyms: [] })
    const gyms = await prisma.gym.findMany({
      where: {
        ...(excludeCity ? { city: { not: excludeCity } } : {}),
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { network: { contains: q, mode: 'insensitive' } },
          { district: { contains: q, mode: 'insensitive' } },
          { address: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: { name: 'asc' },
      take: 40,
    })
    // Разнообразим города: до 8 клубов, не больше 2 на город
    const picked: typeof gyms = []
    const perCity = new Map<string, number>()
    for (const g of gyms) {
      const n = perCity.get(g.city) || 0
      if (n >= 2) continue
      perCity.set(g.city, n + 1)
      picked.push(g)
      if (picked.length >= 8) break
    }
    return c.json({
      gyms: picked.map((g) => serializeGym(g, { membersCount: 0, activeNow: 0 })),
    })
  }

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
    people: members.map((m) => {
      const person = serializePublicUser(m.user)
      // «В зале» только если открытый чек-ин именно в этом клубе (не во всех клубах профиля)
      return {
        ...person,
        isActive: Boolean(person.isActive && person.checkedInGymId === gymId),
      }
    }),
  })
})
