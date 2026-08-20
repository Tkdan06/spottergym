import { type ReactNode, useEffect, useState } from 'react'
import { SoftFlash } from './SoftFlash'
import { buildInvitePayload, shareOrCopyInvite } from '../lib/inviteShare'
import './InviteFriendsButton.css'

interface InviteButtonProps {
  userId: string
  gymName?: string | null
  statusTitle?: string | null
  className?: string
  children?: ReactNode
}

/**
 * Opens the OS share sheet when available; otherwise copies the invite link.
 * Always gives feedback — never a silent no-op.
 */
export function InviteFriendsButton({
  userId,
  gymName,
  statusTitle,
  className = 'btn btn-primary btn-block',
  children = 'Пригласить друзей',
}: InviteButtonProps) {
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!status) return
    const id = window.setTimeout(() => setStatus(''), 2200)
    return () => window.clearTimeout(id)
  }, [status])

  const onClick = () => {
    const payload = buildInvitePayload({ userId, gymName, statusTitle })
    void shareOrCopyInvite(payload).then((result) => {
      if (result === 'shared') setStatus('Отправлено')
      else if (result === 'copied') setStatus('Ссылка скопирована')
      else if (result === 'failed') setStatus('Не удалось поделиться')
      // cancelled — no toast
    })
  }

  return (
    <>
      <div className="invite-friends-wrap">
        <button type="button" className={className} onClick={onClick}>
          {children}
        </button>
      </div>
      <SoftFlash message={status} />
    </>
  )
}
