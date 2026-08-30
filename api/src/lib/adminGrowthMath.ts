export const GROWTH_VIEWS = ['acquisition', 'landing', 'seo', 'referral'] as const
export type GrowthView = (typeof GROWTH_VIEWS)[number]

export type RawTouch = {
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
  utmContent?: string | null
  utmTerm?: string | null
  referrer?: string | null
  searchEngine?: string | null
  searchKeyword?: string | null
  searchPaid?: boolean | null
  fromParam?: string | null
}

export type GrowthChannel = 'utm' | 'seo' | 'paid_search' | 'organic' | 'referral' | 'direct'

export function isGrowthView(value: string | null | undefined): value is GrowthView {
  return !!value && (GROWTH_VIEWS as readonly string[]).includes(value)
}

export function normalizeUtm(value: string | null | undefined, max = 80): string {
  return (value || '').replace(/\s+/g, ' ').trim().slice(0, max)
}

export function classifyChannel(touch: RawTouch, isInvitee = false): GrowthChannel {
  const source = normalizeUtm(touch.utmSource)
  const medium = normalizeUtm(touch.utmMedium).toLowerCase()
  const engine = normalizeUtm(touch.searchEngine).toLowerCase()
  const fromParam = normalizeUtm(touch.fromParam, 40)
  if (source) return 'utm'
  if (engine && touch.searchPaid) return 'paid_search'
  if (engine) return 'seo'
  if (medium === 'organic') return 'organic'
  if (isInvitee || fromParam) return 'referral'
  return 'direct'
}

export function sourceKey(touch: RawTouch, isInvitee = false): string {
  const source = normalizeUtm(touch.utmSource)
  if (source) return source
  const channel = classifyChannel(touch, isInvitee)
  const engine = normalizeUtm(touch.searchEngine).toLowerCase()
  if (channel === 'seo' || channel === 'paid_search') return engine || 'search'
  if (channel === 'organic') return 'organic'
  if (channel === 'referral') return 'referral'
  return 'direct'
}

export function isSearchTouch(touch: RawTouch): boolean {
  return !!normalizeUtm(touch.searchEngine)
}

export function realKeyword(touch: RawTouch): string | null {
  const keyword = normalizeUtm(touch.searchKeyword, 120)
  return keyword || null
}

/** Visit first, register later — still attributed. Register before the visit is not this visitor's conversion. */
export function attributeRegistration(firstViewAt: number, registeredAt: number): boolean {
  return Number.isFinite(firstViewAt) && Number.isFinite(registeredAt) && registeredAt >= firstViewAt
}

export function isActivated(input: {
  registeredAt: Date
  lastSeenAt: Date
  meaningful: boolean
}): boolean {
  if (input.meaningful) return true
  return input.lastSeenAt.getTime() > input.registeredAt.getTime() + 2 * 60 * 1000
}

export function uniqueIds(ids: string[]): number {
  return new Set(ids.filter(Boolean)).size
}

export type GrowthFunnelCounts = {
  visitors: number
  registrations: number
  activation: number
  meaningful: number
  r7: number
  r30: number
}

export function growthFunnelRates(c: GrowthFunnelCounts) {
  const rate = (part: number, whole: number) => (whole > 0 ? part / whole : null)
  return {
    visitorToReg: rate(c.registrations, c.visitors),
    regToActivation: rate(c.activation, c.registrations),
    activationToMeaningful: rate(c.meaningful, c.activation),
    regToR7: rate(c.r7, c.registrations),
    regToR30: rate(c.r30, c.registrations),
  }
}
