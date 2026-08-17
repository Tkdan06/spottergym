import { referralTierFromCount, type ReferralTierId } from '../lib/referralTiers'
import type { UserProfile } from '../types'
import './ReferralBadge.css'

type Size = 'sm' | 'md' | 'lg'

const STICKERS: Record<Exclude<ReferralTierId, 0>, string> = {
  1: '/images/referral/t1-muscle.png',
  2: '/images/referral/t2-dumbbell.png',
  3: '/images/referral/t3-100kg.png',
  4: '/images/referral/t4-crown.png',
}

export function referralChromeClass(
  user: Pick<UserProfile, 'referralChrome' | 'referralTier' | 'referralCreditedCount'>,
) {
  const chrome = user.referralChrome || referralTierFromCount(user.referralCreditedCount || 0).chrome
  if (!chrome || chrome === 'none') return ''
  return `referral-chrome referral-chrome--${chrome}`
}

export function referralStickerSrc(tier: number): string | null {
  if (tier === 1 || tier === 2 || tier === 3 || tier === 4) return STICKERS[tier]
  return null
}

/** Sports sticker on avatar / card. Full status title via tooltip + aria-label. */
export function ReferralBadge({
  user,
  size = 'sm',
  className = '',
}: {
  user: Pick<UserProfile, 'referralTier' | 'referralBadge' | 'referralTitle' | 'referralCreditedCount'>
  size?: Size
  className?: string
}) {
  const def = referralTierFromCount(user.referralCreditedCount || 0)
  const tier = user.referralTier ?? def.id
  if (!tier) return null
  const title = user.referralTitle || def.title
  if (!title) return null
  const src = referralStickerSrc(tier)
  if (!src) return null

  return (
    <span
      className={`referral-badge referral-badge--t${tier} referral-badge--${size} ${className}`.trim()}
      title={title}
      aria-label={title}
    >
      <img src={src} alt="" draggable={false} className="referral-sticker-img" />
    </span>
  )
}
