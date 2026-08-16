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
import { resolveAdminFlags } from '../lib/admin.js'
import { createNotification, pushChatMessage } from '../lib/notify.js'
import { loadAuthedUser, requireAuth, type AuthedEnv } from '../middleware/auth.js'
import { rateLimit } from '../middleware/rateLimit.js'

export const conversationRoutes = new Hono<AuthedEnv>()

conversationRoutes.use('*', requireAuth)

const userInclude = {
  gyms: true,
  checkIns: { where: { checkedOutAt: null }, take: 1 },
} as const

const INBOX_PAGE = 50
const MESSAGES_PAGE = 80

async function loadConvForUser(conversationId: string, userId: string) {
  const conv = await prisma.conversation.findUnique({ where: { id: conversationId } })
  if (!conv || !isParticipant(conv, userId)) return null
  return conv
}

function parseBeforeDate(raw: string | undefined): Date | null {
  if (!raw?.trim()) return null
  const d = new Date(raw)
  return Number.isFinite(d.getTime()) ? d : null
}

/** Inbox — newest activity first */
conversationRoutes.get(
  '/',
  rateLimit({ windowMs: 60_000, max: 120, route: 'chat-list' }),
  async (c) => {
    const userId = c.get('userId')
    const before = parseBeforeDate(c.req.query('before') || undefined)
    const take = Math.min(Number(c.req.query('limit') || INBOX_PAGE) || INBOX_PAGE, 100)

    const list = await prisma.conversation.findMany({
      where: {
        OR: [
          { userLowId: userId, hiddenLowAt: null },
          { userHighId: userId, hiddenHighAt: null },
        ],
        ...(before ? { lastMessageAt: { lt: before } } : {}),
      },
      orderBy: { lastMessageAt: 'desc' },
      take: take + 1,
    })

    const hasMore = list.length > take
    const page = hasMore ? list.slice(0, take) : list

    const otherIds = [...new Set(page.map((conv) => otherUserId(conv, userId)))]
    const others = await prisma.user.findMany({
      where: { id: { in: otherIds } },
      include: userInclude,
    })
    const byId = new Map(others.map((u) => [u.id, u]))

    return c.json({
      conversations: page.map((conv) =>
        serializeConversation(conv, userId, byId.get(otherUserId(conv, userId))),
      ),
      hasMore,
    })
  },
)

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
    if (other.deletedAt) return c.json({ error: 'Пользователь недоступен' }, 403)
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

    // New thread: respect «открыт к общению» (admins may message anyone)
    if (!conv && !other.lookingToMeet) {
      const meUser = await loadAuthedUser(me)
      const adminOk = meUser ? resolveAdminFlags(meUser).isAdmin : false
      if (!adminOk) {
        return c.json({ error: 'Сейчас не открыт к общению' }, 403)
      }
    }

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
          unreadLow: low === otherId ? 1 : 0,
          unreadHigh: high === otherId ? 1 : 0,
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
      const canSend =
        conv.status === 'accepted' ||
        (conv.status === 'pending' && conv.initiatedById === me)
      if (!canSend) {
        return c.json({ error: 'Сначала нужно принять запрос' }, 403)
      }
      if (conv.status === 'pending' && conv.initiatedById === me) {
        const count = await prisma.chatMessage.count({ where: { conversationId: conv.id } })
        if (count > 0) {
          return c.json(
            {
              error: 'Запрос уже отправлен. Дождись ответа собеседника.',
              conversation: serializeConversation(conv, me, other),
            },
            409,
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
            hiddenLowAt: null,
            hiddenHighAt: null,
            unreadLow: low === otherId ? { increment: 1 } : undefined,
            unreadHigh: high === otherId ? { increment: 1 } : undefined,
          },
        }),
      ])
      conv = await prisma.conversation.findUniqueOrThrow({ where: { id: conv.id } })

      if (conv.status === 'accepted') {
        const meUser = await prisma.user.findUnique({ where: { id: me }, select: { name: true } })
        void pushChatMessage({
          userId: otherId,
          senderName: meUser?.name || 'Новое сообщение',
          text,
          conversationId: conv.id,
        }).catch((err) => console.warn('[push] chat message', err))
      }
    } else {
      // Re-open from profile: show chat again for the current user
      const isLow = conv.userLowId === me
      if ((isLow && conv.hiddenLowAt) || (!isLow && conv.hiddenHighAt)) {
        conv = await prisma.conversation.update({
          where: { id: conv.id },
          data: isLow ? { hiddenLowAt: null } : { hiddenHighAt: null },
        })
      }
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

conversationRoutes.get(
  '/:id/messages',
  rateLimit({ windowMs: 60_000, max: 180, route: 'chat-messages' }),
  async (c) => {
    const userId = c.get('userId')
    const conv = await loadConvForUser(c.req.param('id'), userId)
    if (!conv) return c.json({ error: 'Чат не найден' }, 404)

    const before = parseBeforeDate(c.req.query('before') || undefined)
    if (c.req.query('before') && !before) {
      return c.json({ error: 'Некорректный параметр before' }, 400)
    }
    const take = Math.min(Number(c.req.query('limit') || MESSAGES_PAGE) || MESSAGES_PAGE, 100)

    const messages = await prisma.chatMessage.findMany({
      where: {
        conversationId: conv.id,
        ...(before ? { createdAt: { lt: before } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
    })

    const hasMore = messages.length > take
    const page = hasMore ? messages.slice(0, take) : messages

    // Mark peer messages as delivered when opened (latest page only)
    if (!before) {
      await prisma.chatMessage.updateMany({
        where: {
          conversationId: conv.id,
          senderId: { not: userId },
          status: 'sent',
        },
        data: { status: 'delivered' },
      })
    }

    // Reflect delivered in this response (updateMany runs after findMany)
    const chronological = page.reverse().map((m) => {
      if (
        !before &&
        m.senderId !== userId &&
        m.status === 'sent'
      ) {
        return serializeChatMessage({ ...m, status: 'delivered' })
      }
      return serializeChatMessage(m)
    })
    const other = await prisma.user.findUnique({
      where: { id: otherUserId(conv, userId) },
      include: userInclude,
    })

    return c.json({
      conversation: serializeConversation(conv, userId, other),
      messages: chronological,
      hasMore,
    })
  },
)

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

    const otherId = otherUserId(conv, userId)
    if (await areUsersBlocked(userId, otherId)) {
      return c.json({ error: 'Нельзя писать: пользователь в блоке' }, 403)
    }

    const text = sanitizeChatText(body.data.text, CHAT_MESSAGE_MAX)
    if (!text) return c.json({ error: 'Пустое сообщение' }, 400)

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
          hiddenLowAt: null,
          hiddenHighAt: null,
          ...(conv.userLowId === otherId
            ? { unreadLow: { increment: 1 } }
            : { unreadHigh: { increment: 1 } }),
        },
      }),
    ])

    const meUser = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
    void pushChatMessage({
      userId: otherId,
      senderName: meUser?.name || 'Новое сообщение',
      text,
      conversationId: conv.id,
    }).catch((err) => console.warn('[push] chat message', err))

    return c.json({ message: serializeChatMessage(message) }, 201)
  },
)

conversationRoutes.post(
  '/:id/accept',
  rateLimit({ windowMs: 60_000, max: 40, route: 'chat-accept' }),
  async (c) => {
    const userId = c.get('userId')
    const conv = await loadConvForUser(c.req.param('id'), userId)
    if (!conv) return c.json({ error: 'Чат не найден' }, 404)

    const otherId = otherUserId(conv, userId)
    if (await areUsersBlocked(userId, otherId)) {
      return c.json({ error: 'Нельзя принять: пользователь в блоке' }, 403)
    }

    if (conv.status === 'accepted') {
      const other = await prisma.user.findUnique({
        where: { id: otherId },
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
  },
)

conversationRoutes.post(
  '/:id/read',
  rateLimit({ windowMs: 60_000, max: 120, route: 'chat-read' }),
  async (c) => {
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
  },
)

/** Pin / unpin chat for the current user only (Telegram-style) */
conversationRoutes.post(
  '/:id/pin',
  rateLimit({ windowMs: 60_000, max: 40, route: 'chat-pin' }),
  async (c) => {
    const userId = c.get('userId')
    const conv = await loadConvForUser(c.req.param('id'), userId)
    if (!conv) return c.json({ error: 'Чат не найден' }, 404)

    const body = z
      .object({ pinned: z.boolean().optional() })
      .safeParse(await c.req.json().catch(() => ({})))

    const isLow = conv.userLowId === userId
    const currentlyPinned = Boolean(isLow ? conv.pinnedLowAt : conv.pinnedHighAt)
    const nextPinned =
      body.success && typeof body.data.pinned === 'boolean'
        ? body.data.pinned
        : !currentlyPinned

    const updated = await prisma.conversation.update({
      where: { id: conv.id },
      data: isLow
        ? { pinnedLowAt: nextPinned ? new Date() : null }
        : { pinnedHighAt: nextPinned ? new Date() : null },
    })

    const other = await prisma.user.findUnique({
      where: { id: otherUserId(updated, userId) },
      include: userInclude,
    })

    return c.json({ conversation: serializeConversation(updated, userId, other) })
  },
)

/** Delete chat for me only (hides from inbox; peer keeps the thread) */
conversationRoutes.delete(
  '/:id',
  rateLimit({ windowMs: 60_000, max: 40, route: 'chat-hide' }),
  async (c) => {
    const userId = c.get('userId')
    const conv = await loadConvForUser(c.req.param('id'), userId)
    if (!conv) return c.json({ error: 'Чат не найден' }, 404)

    const isLow = conv.userLowId === userId
    await prisma.conversation.update({
      where: { id: conv.id },
      data: isLow
        ? { hiddenLowAt: new Date(), pinnedLowAt: null, unreadLow: 0 }
        : { hiddenHighAt: new Date(), pinnedHighAt: null, unreadHigh: 0 },
    })

    return c.json({ ok: true, id: conv.id })
  },
)
