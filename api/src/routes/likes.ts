import { Hono } from 'hono'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../db.js'
import { areUsersBlocked } from '../lib/blocks.js'
import { createNotification } from '../lib/notify.js'
import { serializePublicUser } from '../lib/serialize.js'
import { requireAuth, type AuthedEnv } from '../middleware/auth.js'
import { rateLimit } from '../middleware/rateLimit.js'

export const likesRoutes = new Hono<AuthedEnv>()

likesRoutes.use('*', requireAuth)

const userInclude = {
  gyms: true,
  checkIns: { where: { checkedOutAt: null }, take: 1 },
} as const

/**
 * Privacy-scoped likes for the viewer:
 * - full liker ids only for likes *received* by the viewer
 * - for outgoing targets: only the viewer's id (so likedByMe works)
 * - counts for everyone (hall ranking) without exposing other people's liker graphs
 */
async function buildViewerLikesPayload(viewerId: string) {
  const [incoming, outgoing, countRows] = await Promise.all([
    prisma.like.findMany({
      where: { toUserId: viewerId },
      select: { fromUserId: true },
    }),
    prisma.like.findMany({
      where: { fromUserId: viewerId },
      select: { toUserId: true },
    }),
    prisma.like.groupBy({
      by: ['toUserId'],
      _count: { _all: true },
    }),
  ])

  const likes: Record<string, string[]> = {}
  likes[viewerId] = incoming.map((r) => r.fromUserId)

  const outgoingIds = outgoing.map((r) => r.toUserId)
  for (const targetId of outgoingIds) {
    const arr = likes[targetId] ? [...likes[targetId]] : []
    if (!arr.includes(viewerId)) arr.push(viewerId)
    likes[targetId] = arr
  }

  const counts: Record<string, number> = {}
  for (const row of countRows) {
    counts[row.toUserId] = row._count._all
  }
  if (counts[viewerId] == null) counts[viewerId] = incoming.length

  const actorIds = [...new Set([...likes[viewerId], ...outgoingIds])]
  const actors = actorIds.length
    ? (
        await prisma.user.findMany({
          where: { id: { in: actorIds }, deletedAt: null },
          include: userInclude,
        })
      ).map((u) => serializePublicUser(u))
    : []

  return { likes, counts, actors }
}

likesRoutes.get('/', async (c) => {
  const payload = await buildViewerLikesPayload(c.get('userId'))
  return c.json(payload)
})

likesRoutes.post(
  '/:userId/toggle',
  rateLimit({ windowMs: 60_000, max: 60, route: 'likes-toggle' }),
  async (c) => {
    const toUserId = z.string().min(1).max(64).safeParse(c.req.param('userId'))
    if (!toUserId.success) return c.json({ error: 'Некорректный id' }, 400)

    const fromUserId = c.get('userId')
    if (fromUserId === toUserId.data) {
      return c.json({ error: 'Нельзя лайкнуть себя' }, 400)
    }

    const target = await prisma.user.findUnique({
      where: { id: toUserId.data },
      select: { id: true, name: true, deletedAt: true },
    })
    if (!target || target.deletedAt) return c.json({ error: 'Пользователь не найден' }, 404)
    if (await areUsersBlocked(fromUserId, toUserId.data)) {
      return c.json({ error: 'Пользователь недоступен' }, 403)
    }

    // Idempotent toggle via transaction: delete if exists, else create (catch unique race)
    let liked: boolean
    const existing = await prisma.like.findUnique({
      where: {
        fromUserId_toUserId: { fromUserId, toUserId: toUserId.data },
      },
    })

    if (existing) {
      await prisma.like.delete({ where: { id: existing.id } }).catch(() => undefined)
      liked = false
    } else {
      try {
        await prisma.like.create({
          data: { fromUserId, toUserId: toUserId.data },
        })
        liked = true
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          // Parallel double-create — treat as liked
          liked = true
        } else {
          throw err
        }
      }
      if (liked) {
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
        }).catch(() => undefined)
      }
    }

    const payload = await buildViewerLikesPayload(fromUserId)
    return c.json({ liked, ...payload })
  },
)
