import { referralTierFromCount } from '../lib/referralTiers'
import type { UserProfile } from '../types'
import './ReferralBadge.css'

type Size = 'sm' | 'md'

export function referralChromeClass(
  user: Pick<UserProfile, 'referralChrome' | 'referralTier' | 'referralCreditedCount'>,
) {
  const chrome = user.referralChrome || referralTierFromCount(user.referralCreditedCount || 0).chrome
  if (!chrome || chrome === 'none') return ''
  return `referral-chrome referral-chrome--${chrome}`
}

export function ReferralBadge({
  user,
  size = 'sm',
  showTitle = false,
}: {
  user: Pick<UserProfile, 'referralTier' | 'referralBadge' | 'referralTitle' | 'referralCreditedCount'>
  size?: Size
  showTitle?: boolean
}) {
  const tier = user.referralTier ?? referralTierFromCount(user.referralCreditedCount || 0).id
  if (!tier) return null
  const label =
    (showTitle ? user.referralTitle : user.referralBadge) ||
    referralTierFromCount(user.referralCreditedCount || 0).badge
  if (!label) return null

  return (
    <span
      className={`referral-badge referral-badge--t${tier} referral-badge--${size}`}
      title={user.referralTitle || label}
    >
      {label}
    </span>
  )
}
