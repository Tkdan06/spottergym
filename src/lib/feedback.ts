import { loadJson, saveJson } from './storage'
import type {
  FeedbackCategoryId,
  FeedbackMessage,
  FeedbackTicket,
  FeedbackTicketStatus,
  TicketTab,
} from '../types'

export const STORAGE_TICKETS = 'spotter.feedback.tickets'

export const FEEDBACK_CATEGORIES: {
  id: FeedbackCategoryId
  label: string
  hint: string
}[] = [
  { id: 'technical', label: 'Техника', hint: 'Баги и сбои' },
  { id: 'question', label: 'Вопрос', hint: 'Как пользоваться' },
  { id: 'suggestion', label: 'Идея', hint: 'Что улучшить' },
  { id: 'safety', label: 'Безопасность', hint: 'Жалоба или риск' },
  { id: 'other', label: 'Другое', hint: 'Всё остальное' },
]

export const STATUS_LABELS: Record<FeedbackTicketStatus, string> = {
  new: 'Новое',
  open: 'Открыто',
  in_progress: 'В работе',
  resolved: 'Выполнено',
  closed: 'Закрыто',
}

const CLOSED = new Set<FeedbackTicketStatus>(['resolved', 'closed'])

export function categoryLabel(id: FeedbackCategoryId) {
  return FEEDBACK_CATEGORIES.find((c) => c.id === id)?.label ?? id
}

export function statusLabel(status: FeedbackTicketStatus) {
  return STATUS_LABELS[status] ?? status
}

export function isTicketClosed(status: FeedbackTicketStatus) {
  return CLOSED.has(status)
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function loadTickets(): FeedbackTicket[] {
  return loadJson<FeedbackTicket[]>(STORAGE_TICKETS, [])
}

export function saveTickets(tickets: FeedbackTicket[]) {
  saveJson(STORAGE_TICKETS, tickets)
}

export function seedTicketsIfEmpty() {
  const current = loadTickets()
  if (current.length) return current
  const now = Date.now()
  const seeded: FeedbackTicket[] = [
    {
      id: 't-demo-1',
      userId: 'u-lera',
      userName: 'Лера',
      userEmail: 'lera@spotter.demo',
      category: 'suggestion',
      subject: 'Фильтры на этаже',
      status: 'open',
      createdAt: new Date(now - 1000 * 60 * 90).toISOString(),
      updatedAt: new Date(now - 1000 * 60 * 90).toISOString(),
      assigneeId: '',
      messages: [
        {
          id: 'tm-1',
          senderType: 'user',
          senderId: 'u-lera',
          senderName: 'Лера',
          text: 'Можно добавить фильтр по уровню новичок/опытный на этаже?',
          createdAt: new Date(now - 1000 * 60 * 90).toISOString(),
        },
      ],
    },
    {
      id: 't-demo-2',
      userId: 'u-ivan',
      userName: 'Иван',
      userEmail: 'ivan@spotter.demo',
      category: 'technical',
      subject: 'Статус в зале',
      status: 'in_progress',
      createdAt: new Date(now - 1000 * 60 * 60 * 5).toISOString(),
      updatedAt: new Date(now - 1000 * 60 * 40).toISOString(),
      assigneeId: 'me',
      messages: [
        {
          id: 'tm-2',
          senderType: 'user',
          senderId: 'u-ivan',
          senderName: 'Иван',
          text: 'Отметился в одном зале, а статус светился будто в двух. Уже лучше, но проверю ещё.',
          createdAt: new Date(now - 1000 * 60 * 60 * 5).toISOString(),
        },
        {
          id: 'tm-3',
          senderType: 'admin',
          senderId: 'me',
          senderName: 'Поддержка',
          text: 'Взяли в работу. Напиши, если снова повторится на конкретном клубе.',
          createdAt: new Date(now - 1000 * 60 * 40).toISOString(),
        },
      ],
    },
  ]
  saveTickets(seeded)
  return seeded
}

export function ticketsForUser(userId: string, all = loadTickets()) {
  return all
    .filter((t) => t.userId === userId)
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
}

export function filterTicketsByTab(all: FeedbackTicket[], tab: TicketTab) {
  if (tab === 'incoming') {
    return all.filter((t) => t.status === 'new' || t.status === 'open')
  }
  if (tab === 'in_progress') {
    return all.filter((t) => t.status === 'in_progress')
  }
  return all.filter((t) => isTicketClosed(t.status))
}

export function ticketCounts(all: FeedbackTicket[]) {
  return {
    incoming: filterTicketsByTab(all, 'incoming').length,
    in_progress: filterTicketsByTab(all, 'in_progress').length,
    closed: filterTicketsByTab(all, 'closed').length,
  }
}

export function createTicket(input: {
  userId: string
  userName: string
  userEmail: string
  category: FeedbackCategoryId
  message: string
}): FeedbackTicket {
  const text = input.message.trim()
  if (text.length < 10) throw new Error('Опиши запрос от 10 символов')
  const now = new Date().toISOString()
  const msg: FeedbackMessage = {
    id: uid('tm'),
    senderType: 'user',
    senderId: input.userId,
    senderName: input.userName,
    text,
    createdAt: now,
  }
  const ticket: FeedbackTicket = {
    id: uid('t'),
    userId: input.userId,
    userName: input.userName,
    userEmail: input.userEmail,
    category: input.category,
    subject: text.slice(0, 48),
    status: 'open',
    createdAt: now,
    updatedAt: now,
    assigneeId: '',
    messages: [msg],
  }
  const next = [ticket, ...loadTickets()]
  saveTickets(next)
  return ticket
}

export function replyToTicket(input: {
  ticketId: string
  senderType: 'user' | 'admin'
  senderId: string
  senderName: string
  message: string
  closeAs?: 'resolved' | 'closed'
  takeInProgress?: boolean
}): FeedbackTicket {
  const text = input.message.trim()
  if (text.length < 2) throw new Error('Пустое сообщение')
  const all = loadTickets()
  const idx = all.findIndex((t) => t.id === input.ticketId)
  if (idx < 0) throw new Error('Обращение не найдено')
  const ticket = all[idx]
  if (isTicketClosed(ticket.status)) throw new Error('Обращение закрыто')

  const now = new Date().toISOString()
  const msg: FeedbackMessage = {
    id: uid('tm'),
    senderType: input.senderType,
    senderId: input.senderId,
    senderName: input.senderName,
    text,
    createdAt: now,
  }

  let status: FeedbackTicketStatus = ticket.status
  let assigneeId = ticket.assigneeId
  if (input.senderType === 'user') {
    status = 'open'
  } else if (input.closeAs) {
    status = input.closeAs
  } else if (input.takeInProgress || status === 'new' || status === 'open') {
    status = 'in_progress'
    assigneeId = input.senderId
  }

  const updated: FeedbackTicket = {
    ...ticket,
    status,
    assigneeId,
    updatedAt: now,
    messages: [...ticket.messages, msg],
  }
  const next = [...all]
  next[idx] = updated
  saveTickets(next)
  return updated
}

export function setTicketStatus(
  ticketId: string,
  status: FeedbackTicketStatus,
  assigneeId?: string,
): FeedbackTicket {
  const all = loadTickets()
  const idx = all.findIndex((t) => t.id === ticketId)
  if (idx < 0) throw new Error('Обращение не найдено')
  const updated: FeedbackTicket = {
    ...all[idx],
    status,
    assigneeId: assigneeId ?? all[idx].assigneeId,
    updatedAt: new Date().toISOString(),
  }
  const next = [...all]
  next[idx] = updated
  saveTickets(next)
  return updated
}

export function getTicket(ticketId: string) {
  return loadTickets().find((t) => t.id === ticketId)
}
