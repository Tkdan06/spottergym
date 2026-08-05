import { useContext } from 'react'
import { AppContext } from './AppContext'
import type { Conversation } from '../types'

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

export function useOtherParticipant(conversation: Conversation) {
  const { user, directory } = useApp()
  const otherId = conversation.participantIds.find((id) => id !== user?.id) ?? ''
  return directory.find((u) => u.id === otherId)
}
