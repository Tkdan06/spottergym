export type GrowthView = 'acquisition' | 'landing' | 'seo' | 'referral'

export const GROWTH_NAV: { id: GrowthView; label: string }[] = [
  { id: 'acquisition', label: 'Acquisition' },
  { id: 'landing', label: 'Landing' },
  { id: 'seo', label: 'SEO' },
  { id: 'referral', label: 'Referral' },
]

export type GrowthFunnelStep = {
  id: string
  label: string
  users: number
  conversion: number | null
}

export type SourceQualityRow = {
  source: string
  channel: string
  visitors: number
  registrations: number
  activation: number
  activationRate: number | null
  r7: number | null
  r30: number | null
  r7Eligible: number
  r30Eligible: number
  thin: boolean
}

export type AdminGrowthPayload = {
  view: GrowthView
  timezone: 'Europe/Moscow'
  generatedAt: string
  range: { preset: string; fromKey: string; toKey: string }
  funnel: GrowthFunnelStep[]
  sources: SourceQualityRow[]
  landing?: {
    views: number
    uniqueVisitors: number
    ctaRegister: number
    registerSuccess: number
    byCampaign: { key: string; visitors: number; registrations: number }[]
    byContent: { key: string; visitors: number }[]
    byTerm: { key: string; visitors: number }[]
    byReferrer: { key: string; visitors: number }[]
  }
  seo?: {
    visits: number
    registrations: number
    activation: number
    r7: number | null
    r30: number | null
    engines: { engine: string; paid: boolean; visitors: number; registrations: number }[]
    keywords: { keyword: string; engine: string; visitors: number; registrations: number }[]
    unknownKeywords: number
  }
  referral?: {
    invites: number
    opens: number
    opensAvailable: false
    registrations: number
    activation: number
    r7: number | null
    r30: number | null
    quality: { invited: number; activated: number; retainedR7: number; retainedR30: number }
  }
  cross?: { source: string; gym: string; registrations: number; activation: number; r7: number | null }[]
}

export function isGrowthView(value: string | null | undefined): value is GrowthView {
  return !!value && GROWTH_NAV.some((item) => item.id === value)
}

export function formatGrowthCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '0'
  return Math.round(value).toLocaleString('ru-RU')
}

export function formatGrowthRate(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${Math.round(value * 1000) / 10}%`
}
