/** Referral ladder — shared rules (API + client keep in sync). */

export type ReferralTierId = 0 | 1 | 2 | 3 | 4

export type ReferralTierDef = {
  id: ReferralTierId
  /** Credited friends needed to reach this tier */
  minCredited: number
  /** Empty at 0 — no public badge */
  title: string
  /** Short label on avatar badge */
  badge: string
  /** Card / profile chrome intensity */
  chrome: 'none' | 'soft' | 'strong' | 'hero'
}

export const REFERRAL_TIERS: ReferralTierDef[] = [
  { id: 0, minCredited: 0, title: '', badge: '', chrome: 'none' },
  { id: 1, minCredited: 1, title: 'Spotter Friend', badge: 'Friend', chrome: 'soft' },
  { id: 2, minCredited: 3, title: 'Gym Crew', badge: 'Crew', chrome: 'soft' },
  { id: 3, minCredited: 5, title: 'Spotter Evangelist', badge: 'Evangelist', chrome: 'strong' },
  { id: 4, minCredited: 10, title: 'GymBro Spotter', badge: 'GymBro', chrome: 'hero' },
]

export function referralTierFromCount(creditedCount: number): ReferralTierDef {
  const n = Math.max(0, Math.floor(creditedCount))
  let current = REFERRAL_TIERS[0]
  for (const tier of REFERRAL_TIERS) {
    if (n >= tier.minCredited) current = tier
  }
  return current
}

export function nextReferralTier(creditedCount: number): ReferralTierDef | null {
  const current = referralTierFromCount(creditedCount)
  const next = REFERRAL_TIERS.find((t) => t.id === current.id + 1)
  return next ?? null
}

export function referralsToNext(creditedCount: number): number | null {
  const next = nextReferralTier(creditedCount)
  if (!next) return null
  return Math.max(0, next.minCredited - creditedCount)
}
