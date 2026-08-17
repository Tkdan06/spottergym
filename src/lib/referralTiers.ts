/** Referral ladder — keep in sync with api/src/lib/referralTiers.ts */

export type ReferralTierId = 0 | 1 | 2 | 3 | 4

export type ReferralTierDef = {
  id: ReferralTierId
  minCredited: number
  title: string
  badge: string
  chrome: 'none' | 'soft' | 'strong' | 'hero'
}

export const REFERRAL_TIERS: ReferralTierDef[] = [
  { id: 0, minCredited: 0, title: '', badge: '', chrome: 'none' },
  { id: 1, minCredited: 1, title: 'Друг Spotter', badge: 'Muscle', chrome: 'soft' },
  { id: 2, minCredited: 3, title: 'Команда Spotter', badge: 'Dumbbell', chrome: 'soft' },
  { id: 3, minCredited: 5, title: 'Амбассадор Spotter', badge: '100kg', chrome: 'strong' },
  { id: 4, minCredited: 10, title: 'GymBroSpotter', badge: 'Crown', chrome: 'hero' },
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
