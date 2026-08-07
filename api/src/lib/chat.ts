import type { ChatMessage, Conversation } from '@prisma/client'
import { serializePublicUser } from './serialize.js'

export function pairUserIds(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a]
}

/** Strip control chars; keep normal newlines out (single-line chat). */
export function sanitizeChatText(raw: string, max: number) {
  const cleaned = raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (cleaned.length > max) return cleaned.slice(0, max)
  return cleaned
}

export function isParticipant(conv: Conversation, userId: string) {
  return conv.userLowId === userId || conv.userHighId === userId
}

export function otherUserId(conv: Conversation, userId: string) {
  return conv.userLowId === userId ? conv.userHighId : conv.userLowId
}

export function unreadFor(conv: Conversation, userId: string) {
  return conv.userLowId === userId ? conv.unreadLow : conv.unreadHigh
}

export function pinnedAtFor(conv: Conversation, userId: string): Date | null {
  return conv.userLowId === userId ? conv.pinnedLowAt : conv.pinnedHighAt
}

export function requestStatusFor(conv: Conversation, userId: string) {
  if (conv.status === 'accepted') return 'accepted' as const
  return conv.initiatedById === userId ? ('pending' as const) : ('incoming' as const)
}

export function serializeConversation(
  conv: Conversation,
  viewerId: string,
  other?: Parameters<typeof serializePublicUser>[0] | null,
) {
  const otherId = otherUserId(conv, viewerId)
  const pinnedAt = pinnedAtFor(conv, viewerId)
  return {
    id: conv.id,
    participantIds: [viewerId, otherId] as [string, string],
    lastMessage: conv.lastMessageText,
    updatedAt: conv.lastMessageAt.toISOString(),
    unreadCount: unreadFor(conv, viewerId),
    requestStatus: requestStatusFor(conv, viewerId),
    pinned: Boolean(pinnedAt),
    pinnedAt: pinnedAt ? pinnedAt.toISOString() : null,
    other: other ? serializePublicUser(other) : undefined,
  }
}

export function serializeChatMessage(m: ChatMessage) {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    text: m.text,
    createdAt: m.createdAt.toISOString(),
    status: m.status === 'read' ? 'read' : m.status === 'delivered' ? 'delivered' : 'sent',
  }
}
