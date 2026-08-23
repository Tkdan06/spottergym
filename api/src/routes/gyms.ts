import { Hono } from 'hono'
import { scheduleExpireStaleCheckIns } from '../lib/checkInExpiry.js'
import { prisma } from '../db.js'
import { expandGymQueryVariants, gymMatchesQuery } from '../lib/gymSearch.js'
import { listHiddenUserIds } from '../lib/blocks.js'
import { getReferralStatsMap } from '../lib/referralStats.js'
import { serializeGym, serializePublicCard } from '../lib/serialize.js'
import { requireAuth, type AuthedEnv } from '../middleware/auth.js'
import { rateLimit } from '../middleware/rateLimit.js'

export const gymRoutes = new Hono<AuthedEnv>()

gymRoutes.use(
  '*',
  rateLimit({ windowMs: 60_000, max: 120, route: 'gyms' }),
)

gymRoutes.get('/', async (c) => {
  const city = c.req.query('city')?.trim().slice(0, 80)
  const network = c.req.query('network')?.trim().slice(0, 80)
  const q = c.req.query('q')?.trim().toLowerCase().slice(0, 80)
  const elsewhere = c.req.query('elsewhere') === '1'
  const excludeCity = c.req.query('excludeCity')?.trim().slice(0, 80)

  // Подсказки «клуб в другом городе» — короткий список без тяжёлых счётчиков
  if (elsewhere) {
    if (!q || q.length < 3) return c.json({ gyms: [] })
    const variants = expandGymQueryVariants(q).slice(0, 12)
    const fieldOr = variants.flatMap((v) => [
      { name: { contains: v, mode: 'insensitive' as const } },
      { network: { contains: v, mode: 'insensitive' as const } },
      { district: { contains: v, mode: 'insensitive' as const } },
      { address: { contains: v, mode: 'insensitive' as const } },
    ])
    const gyms = await prisma.gym.findMany({
      where: {
        ...(excludeCity ? { city: { not: excludeCity } } : {}),
        OR: fieldOr,
      },
      orderBy: { name: 'asc' },
      take: 80,
    })
    const matched = gyms.filter((g) => gymMatchesQuery(g, q))
    // Разнообразим города: до 8 клубов, не больше 2 на город
    const picked: typeof matched = []
    const perCity = new Map<string, number>()
    for (const g of matched) {
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

  const filtered = q ? gyms.filter((g) => gymMatchesQuery(g, q)) : gyms

  scheduleExpireStaleCheckIns()
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

  scheduleExpireStaleCheckIns()
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
  scheduleExpireStaleCheckIns()
  const [hidden, members] = await Promise.all([
    listHiddenUserIds(viewerId),
    prisma.userGym.findMany({
      where: { gymId, user: { deletedAt: null } },
      select: {
        userId: true,
        user: {
          select: {
            id: true,
            username: true,
            instagram: true,
            name: true,
            age: true,
            gender: true,
            bio: true,
            photos: true,
            avatar: true,
            homeGymId: true,
            city: true,
            intent: true,
            experienceLevel: true,
            sports: true,
            isCoach: true,
            coachSports: true,
            breakUntil: true,
            privacy: true,
            lookingToMeet: true,
            lastSeenAt: true,
            referralStatusVisible: true,
            referralCreditedCount: true,
            checkIns: {
              where: { checkedOutAt: null },
              take: 1,
              select: {
                gymId: true,
                checkedInAt: true,
                expiresAt: true,
                extendCount: true,
              },
            },
          },
        },
      },
    }),
  ])
  const hiddenSet = new Set(hidden)
  const visible = hiddenSet.size ? members.filter((m) => !hiddenSet.has(m.userId)) : members
  const memberIds = visible.map((m) => m.userId)

  const [likeRows, tierMap] = await Promise.all([
    memberIds.length
      ? prisma.like.groupBy({
          by: ['toUserId'],
          where: { toUserId: { in: memberIds } },
          _count: { _all: true },
        })
      : Promise.resolve(
          [] as Array<{ toUserId: string; _count: { _all: number } }>,
        ),
    getReferralStatsMap(memberIds),
  ])
  const likeMap = new Map(likeRows.map((r) => [r.toUserId, r._count._all]))

  return c.json({
    people: visible.map((m) => ({
      ...serializePublicCard(m.user, gymId, tierMap.get(m.userId)),
      likeCount: likeMap.get(m.userId) || 0,
    })),
  })
})
