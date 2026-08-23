import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApp } from '../context/useApp'
import { apiClaimInvite } from '../lib/apiClient'
import { isDemoAccount } from '../lib/demoAccount'
import {
  consumeInviteFrom,
  peekInviteFrom,
  persistInviteFrom,
} from '../lib/inviteShare'

/** Persist `?invite=` on any route and attach it once the friend is signed in. */
export function InviteCapture() {
  const [params] = useSearchParams()
  const { user } = useApp()
  const claimedRef = useRef<string | null>(null)

  useEffect(() => {
    persistInviteFrom(params.get('invite'))
    const inviteFrom = peekInviteFrom()
    if (!user || !inviteFrom) return
    if (inviteFrom === user.id || isDemoAccount(user.email)) {
      consumeInviteFrom()
      return
    }
    const key = `${user.id}:${inviteFrom}`
    if (claimedRef.current === key) return
    claimedRef.current = key
    void apiClaimInvite(inviteFrom)
      .then((res) => {
        if (res.attached || res.already) consumeInviteFrom()
      })
      .catch(() => {
        claimedRef.current = null
      })
  }, [params, user])

  return null
}
