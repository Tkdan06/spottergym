import type { Conversation } from '../types'

/** Self in stored chats is often the legacy id `me`, not the real account id. */
export function otherParticipantId(
  conversation: Conversation,
  userId?: string | null,
): string {
  const ids = conversation.participantIds
  const other = ids.find((id) => id !== 'me' && id !== userId)
  if (other) return other
  return ids.find((id) => id !== userId) ?? ids.find((id) => id !== 'me') ?? ''
}
