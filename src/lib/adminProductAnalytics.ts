export type ProductView =
  | 'funnels'
  | 'core-loop'
  | 'social'
  | 'chats'
  | 'workouts'
  | 'activity'
  | 'progress'
  | 'ai'

export const PRODUCT_NAV: { id: ProductView; label: string }[] = [
  { id: 'funnels', label: 'Воронки' },
  { id: 'core-loop', label: 'Core Loop' },
  { id: 'social', label: 'Знакомства' },
  { id: 'chats', label: 'Чаты' },
  { id: 'workouts', label: 'Тренировки' },
  { id: 'activity', label: 'Активность' },
  { id: 'progress', label: 'Прогресс' },
  { id: 'ai', label: 'AI-тренер' },
]

export type MetricDefinition = {
  numerator: string
  denominator: string
  event: string
  window: string
}

export type ProductFunnelStep = {
  id: string
  label: string
  users: number
  events: number
  conversion: number | null
  dropOff: number
  dropOffRate: number | null
  medianSecondsFromPrev: number | null
  worst: boolean
  definition: MetricDefinition
}

export type AdminProductPayload = {
  view: ProductView
  timezone: 'Europe/Moscow'
  generatedAt: string
  range: {
    preset: string
    from: string
    to: string
    fromKey: string
    toKey: string
  }
  applied: { gymId: string | null; source: string | null; referral: 'all' | 'yes' | 'no' }
  options: {
    gyms: { id: string; label: string }[]
    sources: { id: string; label: string; users: number }[]
  }
  social?: { funnel: ProductFunnelStep[] }
  training?: { funnel: ProductFunnelStep[] }
  coreLoop?: { funnel: ProductFunnelStep[] }
  chats?: {
    funnel: ProductFunnelStep[]
    kpi: { requests: number; accepted: number; chats: number; messages: number }
  }
  activity?: {
    kpi: {
      checkIns: number
      activeUsers: number
      trainingDays: number
      averageDurationSeconds: number | null
    }
    hours: { hour: number; checkIns: number }[]
    durations: { bucket: string; checkIns: number }[]
  }
  progress?: {
    kpi: {
      opens: number
      users: number
      periodSelections: number
      returnedUsers: number
    }
  }
  ai?: {
    funnel: ProductFunnelStep[]
    kpi: {
      users: number
      requests: number
      generated: number
      failed: number
      successRate: number | null
    }
  }
}

export function isProductView(value: string | null | undefined): value is ProductView {
  return !!value && PRODUCT_NAV.some((item) => item.id === value)
}

export function formatProductCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '0'
  return Math.round(value).toLocaleString('ru-RU')
}

export function formatProductRate(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${Math.round(value * 1000) / 10}%`
}

export function formatMedianSeconds(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  if (value < 60) return `${Math.round(value)} с`
  if (value < 3600) return `${Math.round(value / 60)} мин`
  if (value < 86400) return `${Math.round(value / 3600)} ч`
  return `${(value / 86400).toFixed(1)} дн`
}

export function formatDurationSeconds(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return formatMedianSeconds(value)
}
