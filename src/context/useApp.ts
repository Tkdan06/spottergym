import { useContext } from 'react'
import { AppContext } from './AppContext'
import { getUser } from '../data/mock'
import { otherParticipantId } from '../lib/conversations'
import type { Conversation } from '../types'

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

export function useOtherParticipant(conversation: Conversation) {
  const { user, directory } = useApp()
  const otherId = otherParticipantId(conversation, user?.id)
  if (!otherId) return undefined
  return directory.find((u) => u.id === otherId) ?? getUser(otherId)
}
