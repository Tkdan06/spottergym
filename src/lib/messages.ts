import type { Message, MessageStatus } from '../types'

export function normalizeMessage(raw: Message & { read?: boolean }): Message {
  const status: MessageStatus =
    raw.status ??
    (raw.read === false && raw.senderId !== 'me'
      ? 'delivered'
      : raw.read === false
        ? 'delivered'
        : 'read')

  // Incoming unread for me → delivered (not yet read by me conceptually for ticks on mine)
  // Legacy: own messages with read:true → read; read:false → delivered
  let resolved: MessageStatus = status
  if (!raw.status) {
    if (raw.senderId === 'me') {
      resolved = raw.read === false ? 'delivered' : 'read'
    } else {
      resolved = raw.read === false ? 'delivered' : 'read'
    }
  }

  return {
    id: raw.id,
    conversationId: raw.conversationId,
    senderId: raw.senderId,
    text: raw.text,
    createdAt: raw.createdAt,
    status: resolved,
  }
}

export function normalizeMessages(list: Message[]): Message[] {
  return list.map((m) => normalizeMessage(m))
}
