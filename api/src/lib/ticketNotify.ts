import { listTicketAdminIds } from './admin.js'
import { createNotification } from './notify.js'

const CATEGORY_LABEL: Record<string, string> = {
  technical: 'Техника',
  question: 'Вопрос',
  suggestion: 'Идея',
  safety: 'Безопасность',
  other: 'Другое',
}

/** Notify every tickets-admin about a new user appeal or user reply (push + badge via type `admin`). */
export async function notifyTicketAdmins(input: {
  ticketId: string
  actorId: string
  actorName: string
  kind: 'created' | 'reply'
  category?: string
  preview: string
}) {
  const adminIds = await listTicketAdminIds(input.actorId)
  if (!adminIds.length) return

  const category = input.category ? CATEGORY_LABEL[input.category] || input.category : ''
  const title =
    input.kind === 'created' ? 'Новое обращение' : 'Ответ в обращении'
  const body =
    input.kind === 'created'
      ? `${input.actorName}${category ? ` · ${category}` : ''}: ${input.preview}`.slice(0, 500)
      : `${input.actorName}: ${input.preview}`.slice(0, 500)
  const href = `/app/admin/tickets?ticket=${encodeURIComponent(input.ticketId)}`

  await Promise.all(
    adminIds.map((userId) =>
      createNotification({
        userId,
        type: 'admin',
        title,
        body,
        href,
        actorId: input.actorId,
        force: true,
      }),
    ),
  )
}
