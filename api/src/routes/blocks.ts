import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../db.js'
import { listBlockedUserIds } from '../lib/blocks.js'
import { requireAuth, type AuthedEnv } from '../middleware/auth.js'
import { rateLimit } from '../middleware/rateLimit.js'

export const blockRoutes = new Hono<AuthedEnv>()

blockRoutes.use('*', requireAuth)

blockRoutes.get('/', async (c) => {
  const ids = await listBlockedUserIds(c.get('userId'))
  return c.json({ blockedUserIds: ids })
})

blockRoutes.post(
  '/:userId',
  rateLimit({ windowMs: 60_000, max: 40, route: 'blocks-create' }),
  async (c) => {
    const targetId = z.string().min(1).max(64).safeParse(c.req.param('userId'))
    if (!targetId.success) return c.json({ error: 'Некорректный id' }, 400)
    const me = c.get('userId')
    if (targetId.data === me) return c.json({ error: 'Нельзя заблокировать себя' }, 400)

    const target = await prisma.user.findUnique({ where: { id: targetId.data } })
    if (!target) return c.json({ error: 'Пользователь не найден' }, 404)

    await prisma.userBlock.upsert({
      where: {
        blockerId_blockedId: { blockerId: me, blockedId: targetId.data },
      },
      create: { blockerId: me, blockedId: targetId.data },
      update: {},
    })

    const ids = await listBlockedUserIds(me)
    return c.json({ blockedUserIds: ids })
  },
)

blockRoutes.delete(
  '/:userId',
  rateLimit({ windowMs: 60_000, max: 40, route: 'blocks-delete' }),
  async (c) => {
    const targetId = z.string().min(1).max(64).safeParse(c.req.param('userId'))
    if (!targetId.success) return c.json({ error: 'Некорректный id' }, 400)
    const me = c.get('userId')

    await prisma.userBlock.deleteMany({
      where: { blockerId: me, blockedId: targetId.data },
    })

    const ids = await listBlockedUserIds(me)
    return c.json({ blockedUserIds: ids })
  },
)
