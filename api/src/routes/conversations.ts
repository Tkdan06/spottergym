import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../db.js'
import { areUsersBlocked } from '../lib/blocks.js'
import {
  isParticipant,
  otherUserId,
  pairUserIds,
  sanitizeChatText,
  serializeChatMessage,
  serializeConversation,
} from '../lib/chat.js'
import {
  CHAT_MESSAGE_MAX,
  GREETING_MESSAGE_MAX,
} from '../lib/fieldLimits.js'
import { createNotification } from '../lib/notify.js'
import { requireAuth, type AuthedEnv } from '../middleware/auth.js'
import { rateLimit } from '../middleware/rateLimit.js'

export const conversationRoutes = new Hono<AuthedEnv>()

conversationRoutes.use('*', requireAuth)

const userInclude = {
  gyms: true,
  checkIns: { where: { checkedOutAt: null }, take: 1 },
} as const

async function loadConvForUser(conversationId: string, userId: string) {
  const conv = await prisma.conversation.findUnique({ where: { id: conversationId } })
  if (!conv || !isParticipant(conv, userId)) return null
  return conv
}

/** Inbox — newest activity first */
conversationRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const list = await prisma.conversation.findMany({
    where: {
      OR: [{ userLowId: userId }, { userHighId: userId }],
    },
    orderBy: { lastMessageAt: 'desc' },
    take: 100,
  })

  const otherIds = [...new Set(list.map((conv) => otherUserId(conv, userId)))]
  const others = await prisma.user.findMany({
    where: { id: { in: otherIds } },
    include: userInclude,
  })
  const byId = new Map(others.map((u) => [u.id, u]))

  return c.json({
    conversations: list.map((conv) =>
      serializeConversation(conv, userId, byId.get(otherUserId(conv, userId))),
    ),
  })
})

/** Start chat / send greeting (creates pending request) */
conversationRoutes.post(
  '/',
  rateLimit({ windowMs: 60_000, max: 30, route: 'chat-start' }),
  async (c) => {
    const body = z
      .object({
        userId: z.string().min(1).max(64),
        message: z.string().max(GREETING_MESSAGE_MAX).optional(),
      })
      .safeParse(await c.req.json().catch(() => null))
    if (!body.success) return c.json({ error: 'Некорректные данные' }, 400)

    const me = c.get('userId')
    const otherId = body.data.userId
    if (otherId === me) return c.json({ error: 'Нельзя написать себе' }, 400)

    const other = await prisma.user.findUnique({
      where: { id: otherId },
      include: userInclude,
    })
    if (!other) return c.json({ error: 'Пользователь не найден' }, 404)
    if (await areUsersBlocked(me, otherId)) {
      return c.json({ error: 'Пользователь недоступен' }, 403)
    }

    const [low, high] = pairUserIds(me, otherId)
    let conv = await prisma.conversation.findUnique({
      where: { userLowId_userHighId: { userLowId: low, userHighId: high } },
    })

    const text = body.data.message
      ? sanitizeChatText(body.data.message, GREETING_MESSAGE_MAX)
      : ''

    if (!conv) {
      const now = new Date()
      conv = await prisma.conversation.create({
        data: {
          userLowId: low,
          userHighId: high,
          initiatedById: me,
          status: 'pending',
          lastMessageText: text || 'Новый запрос',
          lastMessageAt: now,
          unreadLow: low === otherId ? (text ? 1 : 0) : 0,
          unreadHigh: high === otherId ? (text ? 1 : 0) : 0,
        },
      })

      if (text) {
        await prisma.chatMessage.create({
          data: {
            conversationId: conv.id,
            senderId: me,
            text,
            status: 'sent',
          },
        })
      }

      const meUser = await prisma.user.findUnique({ where: { id: me }, select: { name: true } })
      await createNotification({
        userId: otherId,
        type: 'chat_request',
        title: 'Запрос в чат',
        body: `${meUser?.name || 'Кто-то'} хочет начать переписку`,
        href: `/app/messages/${conv.id}`,
        actorId: me,
      })
    } else if (text) {
      // Existing thread: append if allowed
      const canSend =
        conv.status === 'accepted' ||
        (conv.status === 'pending' && conv.initiatedById === me)
      if (!canSend) {
        return c.json({ error: 'Сначала нужно принять запрос' }, 403)
      }
      if (conv.status === 'pending' && conv.initiatedById === me) {
        // Initiator already waiting — allow only if no messages yet, else block like UI
        const count = await prisma.chatMessage.count({ where: { conversationId: conv.id } })
        if (count > 0) {
          return c.json(
            { conversation: serializeConversation(conv, me, other), alreadyExists: true },
            200,
          )
        }
      }

      const now = new Date()
      await prisma.$transaction([
        prisma.chatMessage.create({
          data: {
            conversationId: conv.id,
            senderId: me,
            text,
            status: 'sent',
          },
        }),
        prisma.conversation.update({
          where: { id: conv.id },
          data: {
            lastMessageText: text,
            lastMessageAt: now,
            unreadLow: low === otherId ? { increment: 1 } : undefined,
            unreadHigh: high === otherId ? { increment: 1 } : undefined,
          },
        }),
      ])
      conv = await prisma.conversation.findUniqueOrThrow({ where: { id: conv.id } })
    }

    return c.json(
      {
        conversation: serializeConversation(conv, me, other),
        alreadyExists: false,
      },
      201,
    )
  },
)

conversationRoutes.get('/:id/messages', async (c) => {
  const userId = c.get('userId')
  const conv = await loadConvForUser(c.req.param('id'), userId)
  if (!conv) return c.json({ error: 'Чат не найден' }, 404)

  const before = c.req.query('before')
  const take = Math.min(Number(c.req.query('limit') || 80) || 80, 100)

  const messages = await prisma.chatMessage.findMany({
    where: {
      conversationId: conv.id,
      ...(before
        ? { createdAt: { lt: new Date(before) } }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take,
  })

  // Mark peer messages as delivered when opened
  await prisma.chatMessage.updateMany({
    where: {
      conversationId: conv.id,
      senderId: { not: userId },
      status: 'sent',
    },
    data: { status: 'delivered' },
  })

  const chronological = messages.reverse()
  const other = await prisma.user.findUnique({
    where: { id: otherUserId(conv, userId) },
    include: userInclude,
  })

  return c.json({
    conversation: serializeConversation(conv, userId, other),
    messages: chronological.map(serializeChatMessage),
  })
})

conversationRoutes.post(
  '/:id/messages',
  rateLimit({ windowMs: 60_000, max: 60, route: 'chat-send' }),
  async (c) => {
    const body = z
      .object({ text: z.string().min(1).max(CHAT_MESSAGE_MAX) })
      .safeParse(await c.req.json().catch(() => null))
    if (!body.success) return c.json({ error: 'Пустое сообщение' }, 400)

    const userId = c.get('userId')
    const conv = await loadConvForUser(c.req.param('id'), userId)
    if (!conv) return c.json({ error: 'Чат не найден' }, 404)

    if (conv.status !== 'accepted') {
      return c.json({ error: 'Переписка ещё не открыта' }, 403)
    }

    const text = sanitizeChatText(body.data.text, CHAT_MESSAGE_MAX)
    if (!text) return c.json({ error: 'Пустое сообщение' }, 400)

    const otherId = otherUserId(conv, userId)
    const now = new Date()

    const [message] = await prisma.$transaction([
      prisma.chatMessage.create({
        data: {
          conversationId: conv.id,
          senderId: userId,
          text,
          status: 'sent',
        },
      }),
      prisma.conversation.update({
        where: { id: conv.id },
        data: {
          lastMessageText: text,
          lastMessageAt: now,
          ...(conv.userLowId === otherId
            ? { unreadLow: { increment: 1 } }
            : { unreadHigh: { increment: 1 } }),
        },
      }),
    ])

    const me = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
    await createNotification({
      userId: otherId,
      type: 'chat_request',
      title: 'Новое сообщение',
      body: `${me?.name || 'Собеседник'}: ${text.slice(0, 80)}`,
      href: `/app/messages/${conv.id}`,
      actorId: userId,
    })

    return c.json({ message: serializeChatMessage(message) }, 201)
  },
)

conversationRoutes.post('/:id/accept', async (c) => {
  const userId = c.get('userId')
  const conv = await loadConvForUser(c.req.param('id'), userId)
  if (!conv) return c.json({ error: 'Чат не найден' }, 404)

  if (conv.status === 'accepted') {
    const other = await prisma.user.findUnique({
      where: { id: otherUserId(conv, userId) },
      include: userInclude,
    })
    return c.json({ conversation: serializeConversation(conv, userId, other) })
  }

  if (conv.initiatedById === userId) {
    return c.json({ error: 'Нельзя принять свой же запрос' }, 403)
  }

  const updated = await prisma.conversation.update({
    where: { id: conv.id },
    data: { status: 'accepted' },
  })

  const other = await prisma.user.findUnique({
    where: { id: otherUserId(updated, userId) },
    include: userInclude,
  })

  const me = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
  await createNotification({
    userId: conv.initiatedById,
    type: 'chat_request',
    title: 'Запрос принят',
    body: `${me?.name || 'Собеседник'} принял переписку`,
    href: `/app/messages/${conv.id}`,
    actorId: userId,
  })

  return c.json({ conversation: serializeConversation(updated, userId, other) })
})

conversationRoutes.post('/:id/read', async (c) => {
  const userId = c.get('userId')
  const conv = await loadConvForUser(c.req.param('id'), userId)
  if (!conv) return c.json({ error: 'Чат не найден' }, 404)

  const isLow = conv.userLowId === userId
  await prisma.$transaction([
    prisma.conversation.update({
      where: { id: conv.id },
      data: isLow ? { unreadLow: 0 } : { unreadHigh: 0 },
    }),
    prisma.chatMessage.updateMany({
      where: {
        conversationId: conv.id,
        senderId: { not: userId },
        status: { in: ['sent', 'delivered'] },
      },
      data: { status: 'read' },
    }),
  ])

  return c.json({ ok: true })
})
