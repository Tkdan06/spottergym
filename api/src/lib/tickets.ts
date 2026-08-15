import type { FeedbackMessage, FeedbackTicket, User } from '@prisma/client'

type TicketWithMsgs = FeedbackTicket & {
  messages: FeedbackMessage[]
  user?: Pick<User, 'id' | 'name' | 'email'>
}

export function serializeTicket(t: TicketWithMsgs) {
  return {
    id: t.id,
    userId: t.userId,
    userName: t.user?.name || '',
    userEmail: t.user?.email || '',
    category: t.category,
    subject: t.subject,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    assigneeId: t.assigneeId || '',
    messages: t.messages
      .slice()
      .sort((a, b) => +a.createdAt - +b.createdAt)
      .map((m) => ({
        id: m.id,
        senderType: m.senderType,
        senderId: m.senderId,
        /** Never expose admin real name to clients */
        senderName: m.senderType === 'admin' ? 'Админ' : m.senderName,
        text: m.text,
        createdAt: m.createdAt.toISOString(),
      })),
  }
}
