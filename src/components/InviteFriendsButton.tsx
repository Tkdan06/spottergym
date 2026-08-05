import { type ReactNode } from 'react'
import { buildInvitePayload, canUseNativeShare, shareInvite } from '../lib/inviteShare'

interface InviteButtonProps {
  userId: string
  gymName?: string | null
  className?: string
  children?: ReactNode
}

/**
 * Opens only the phone OS share sheet.
 * Works in a secure context (HTTPS or localhost). On plain HTTP LAN it may be unavailable.
 */
export function InviteFriendsButton({
  userId,
  gymName,
  className = 'btn btn-primary btn-block',
  children = 'Пригласить друзей',
}: InviteButtonProps) {
  const onClick = () => {
    const payload = buildInvitePayload({ userId, gymName })
    if (!canUseNativeShare()) return
    void shareInvite(payload)
  }

  return (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  )
}
