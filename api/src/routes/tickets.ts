import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../db.js'
import { resolveAdminFlags } from '../lib/admin.js'
import {
  ADMIN_MESSAGE_MAX,
  FEEDBACK_MESSAGE_MAX,
  FEEDBACK_MESSAGE_MIN,
} from '../lib/fieldLimits.js'
import { createNotification } from '../lib/notify.js'
import { serializeTicket } from '../lib/tickets.js'
import { loadAuthedUser, requireAuth, type AuthedEnv } from '../middleware/auth.js'

export const ticketRoutes = new Hono<AuthedEnv>()

ticketRoutes.use('*', requireAuth)

const ticketInclude = {
  messages: true,
  user: { select: { id: true, name: true, email: true } },
} as const

const categorySchema = z.enum(['technical', 'question', 'suggestion', 'safety', 'other'])

ticketRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const me = await loadAuthedUser(userId)
  if (!me) return c.json({ error: 'Требуется вход' }, 401)
  const flags = resolveAdminFlags(me)

  const tickets = await prisma.feedbackTicket.findMany({
    where: flags.isAdmin && flags.adminPermissions.tickets ? {} : { userId },
    include: ticketInclude,
    orderBy: { updatedAt: 'desc' },
    take: 200,
  })
  return c.json({ tickets: tickets.map(serializeTicket) })
})

ticketRoutes.post('/', async (c) => {
  const body = z
    .object({
      category: categorySchema,
      message: z.string().trim().min(FEEDBACK_MESSAGE_MIN).max(FEEDBACK_MESSAGE_MAX),
    })
    .safeParse(await c.req.json().catch(() => null))
  if (!body.success) {
    return c.json({ error: `Опиши запрос от ${FEEDBACK_MESSAGE_MIN} символов` }, 400)
  }

  const me = await loadAuthedUser(c.get('userId'))
  if (!me) return c.json({ error: 'Требуется вход' }, 401)

  const text = body.data.message.trim()
  const ticket = await prisma.feedbackTicket.create({
    data: {
      userId: me.id,
      category: body.data.category,
      subject: text.slice(0, 48),
      status: 'open',
      messages: {
        create: {
          senderType: 'user',
          senderId: me.id,
          senderName: me.name,
          text,
        },
      },
    },
    include: ticketInclude,
  })

  await createNotification({
    userId: me.id,
    type: 'admin',
    title: 'Обращение создано',
    body: 'Поддержка ответит в разделе «Обратная связь»',
    href: `/app/feedback/${ticket.id}`,
  })

  return c.json({ ticket: serializeTicket(ticket) }, 201)
})

/** Админ пишет пользователю — создаёт тикет от поддержки */
ticketRoutes.post('/outbound', async (c) => {
  const body = z
    .object({
      userId: z.string().min(1).max(64),
      message: z.string().trim().min(2).max(ADMIN_MESSAGE_MAX),
    })
    .safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'Некорректные данные' }, 400)

  const me = await loadAuthedUser(c.get('userId'))
  if (!me) return c.json({ error: 'Требуется вход' }, 401)
  const flags = resolveAdminFlags(me)
  if (!flags.isAdmin || !flags.adminPermissions.messageUsers) {
    return c.json({ error: 'Недостаточно прав' }, 403)
  }

  const target = await prisma.user.findUnique({ where: { id: body.data.userId } })
  if (!target) return c.json({ error: 'Пользователь не найден' }, 404)

  const text = body.data.message.trim()
  const ticket = await prisma.feedbackTicket.create({
    data: {
      userId: target.id,
      category: 'other',
      subject: text.slice(0, 48),
      status: 'in_progress',
      assigneeId: me.id,
      messages: {
        create: {
          senderType: 'admin',
          senderId: me.id,
          senderName: me.name,
          text,
        },
      },
    },
    include: ticketInclude,
  })

  await createNotification({
    userId: target.id,
    type: 'admin',
    title: 'Сообщение от поддержки',
    body: text.slice(0, 120),
    href: `/app/feedback/${ticket.id}`,
    actorId: me.id,
  })

  return c.json({ ticket: serializeTicket(ticket) }, 201)
})

ticketRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  const me = await loadAuthedUser(c.get('userId'))
  if (!me) return c.json({ error: 'Требуется вход' }, 401)
  const flags = resolveAdminFlags(me)

  const ticket = await prisma.feedbackTicket.findUnique({
    where: { id },
    include: ticketInclude,
  })
  if (!ticket) return c.json({ error: 'Не найдено' }, 404)
  if (ticket.userId !== me.id && !(flags.isAdmin && flags.adminPermissions.tickets)) {
    return c.json({ error: 'Нет доступа' }, 403)
  }
  return c.json({ ticket: serializeTicket(ticket) })
})

ticketRoutes.post('/:id/reply', async (c) => {
  const id = c.req.param('id')
  const body = z
    .object({
      message: z.string().trim().min(2).max(FEEDBACK_MESSAGE_MAX),
      closeAs: z.enum(['resolved', 'closed']).optional(),
    })
    .safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'Пустое сообщение' }, 400)

  const me = await loadAuthedUser(c.get('userId'))
  if (!me) return c.json({ error: 'Требуется вход' }, 401)
  const flags = resolveAdminFlags(me)

  const ticket = await prisma.feedbackTicket.findUnique({
    where: { id },
    include: ticketInclude,
  })
  if (!ticket) return c.json({ error: 'Не найдено' }, 404)

  const isOwner = ticket.userId === me.id
  const isAdmin = flags.isAdmin && flags.adminPermissions.tickets
  if (!isOwner && !isAdmin) return c.json({ error: 'Нет доступа' }, 403)

  if (['resolved', 'closed'].includes(ticket.status) && !isAdmin) {
    return c.json({ error: 'Обращение закрыто' }, 400)
  }

  const asAdmin = isAdmin && !isOwner
  const text = body.data.message.trim().slice(0, asAdmin ? ADMIN_MESSAGE_MAX : FEEDBACK_MESSAGE_MAX)

  let nextStatus = ticket.status
  if (asAdmin) {
    if (body.data.closeAs) nextStatus = body.data.closeAs
    else if (ticket.status === 'open' || ticket.status === 'new') nextStatus = 'in_progress'
  }

  const updated = await prisma.feedbackTicket.update({
    where: { id },
    data: {
      status: nextStatus,
      assigneeId: asAdmin ? me.id : ticket.assigneeId,
      updatedAt: new Date(),
      messages: {
        create: {
          senderType: asAdmin ? 'admin' : 'user',
          senderId: me.id,
          senderName: asAdmin ? me.name : me.name,
          text,
        },
      },
    },
    include: ticketInclude,
  })

  if (asAdmin && ticket.userId !== me.id) {
    await createNotification({
      userId: ticket.userId,
      type: 'admin',
      title: body.data.closeAs ? 'Обращение закрыто' : 'Ответ поддержки',
      body: text.slice(0, 120),
      href: `/app/feedback/${ticket.id}`,
      actorId: me.id,
    })
  }

  return c.json({ ticket: serializeTicket(updated) })
})

ticketRoutes.patch('/:id/status', async (c) => {
  const id = c.req.param('id')
  const body = z
    .object({
      status: z.enum(['new', 'open', 'in_progress', 'resolved', 'closed']),
    })
    .safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'Некорректный статус' }, 400)

  const me = await loadAuthedUser(c.get('userId'))
  if (!me) return c.json({ error: 'Требуется вход' }, 401)
  const flags = resolveAdminFlags(me)
  if (!flags.isAdmin || !flags.adminPermissions.tickets) {
    return c.json({ error: 'Недостаточно прав' }, 403)
  }

  const ticket = await prisma.feedbackTicket.findUnique({ where: { id } })
  if (!ticket) return c.json({ error: 'Не найдено' }, 404)

  const updated = await prisma.feedbackTicket.update({
    where: { id },
    data: {
      status: body.data.status,
      assigneeId:
        body.data.status === 'in_progress' ? me.id : ticket.assigneeId,
    },
    include: ticketInclude,
  })

  if (ticket.userId !== me.id) {
    await createNotification({
      userId: ticket.userId,
      type: 'admin',
      title: 'Статус обращения обновлён',
      body: `Статус: ${body.data.status}`,
      href: `/app/feedback/${ticket.id}`,
      actorId: me.id,
    })
  }

  return c.json({ ticket: serializeTicket(updated) })
})
