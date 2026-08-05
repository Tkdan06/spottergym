import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../db.js'
import { areUsersBlocked } from '../lib/blocks.js'
import { createNotification } from '../lib/notify.js'
import { requireAuth, type AuthedEnv } from '../middleware/auth.js'

export const likesRoutes = new Hono<AuthedEnv>()

likesRoutes.use('*', requireAuth)

/** LikesMap: targetUserId → likerIds[] */
async function buildLikesMap() {
  const rows = await prisma.like.findMany({
    select: { fromUserId: true, toUserId: true },
  })
  const map: Record<string, string[]> = {}
  for (const row of rows) {
    if (!map[row.toUserId]) map[row.toUserId] = []
    map[row.toUserId].push(row.fromUserId)
  }
  return map
}

likesRoutes.get('/', async (c) => {
  const likes = await buildLikesMap()
  return c.json({ likes })
})

likesRoutes.post('/:userId/toggle', async (c) => {
  const toUserId = z.string().min(1).max(64).safeParse(c.req.param('userId'))
  if (!toUserId.success) return c.json({ error: 'Некорректный id' }, 400)

  const fromUserId = c.get('userId')
  if (fromUserId === toUserId.data) {
    return c.json({ error: 'Нельзя лайкнуть себя' }, 400)
  }

  const target = await prisma.user.findUnique({
    where: { id: toUserId.data },
    select: { id: true, name: true },
  })
  if (!target) return c.json({ error: 'Пользователь не найден' }, 404)
  if (await areUsersBlocked(fromUserId, toUserId.data)) {
    return c.json({ error: 'Пользователь недоступен' }, 403)
  }

  const existing = await prisma.like.findUnique({
    where: {
      fromUserId_toUserId: { fromUserId, toUserId: toUserId.data },
    },
  })

  let liked: boolean
  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } })
    liked = false
  } else {
    await prisma.like.create({
      data: { fromUserId, toUserId: toUserId.data },
    })
    liked = true
    const me = await prisma.user.findUnique({
      where: { id: fromUserId },
      select: { name: true },
    })
    await createNotification({
      userId: toUserId.data,
      type: 'like',
      title: 'Новый лайк',
      body: `${me?.name || 'Кто-то'} отметил твою карточку`,
      href: '/app/likes',
      actorId: fromUserId,
    })
  }

  const likes = await buildLikesMap()
  return c.json({ liked, likes })
})
