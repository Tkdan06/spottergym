export type CohortGrain = 'week' | 'month'
export type AcqDimension = 'all' | 'source' | 'medium' | 'campaign' | 'referral' | 'organic' | 'seo'
export type ProductDimension = 'all' | 'gym_selected' | 'social' | 'workout' | 'ai'
export type AhaAction =
  | 'people_viewed'
  | 'profile_viewed'
  | 'like_sent'
  | 'request_sent'
  | 'chat_started'
  | 'workout_saved'
  | 'progress_opened'
  | 'ai_used'

export const AHA_ACTIONS: { id: AhaAction; label: string }[] = [
  { id: 'people_viewed', label: 'просмотрел людей' },
  { id: 'profile_viewed', label: 'открыл профиль' },
  { id: 'like_sent', label: 'поставил лайк' },
  { id: 'request_sent', label: 'отправил запрос' },
  { id: 'chat_started', label: 'начал чат' },
  { id: 'workout_saved', label: 'записал тренировку' },
  { id: 'progress_opened', label: 'открыл прогресс' },
  { id: 'ai_used', label: 'использовал AI' },
]

export type RetentionCell = {
  day: number
  eligible: number
  retained: number
  rate: number | null
  thin: boolean
}

export type AdminCohortsPayload = {
  timezone: 'Europe/Moscow'
  generatedAt: string
  formula: 'exact_day_n_msk'
  range: { preset: string; fromKey: string; toKey: string }
  applied: {
    grain: CohortGrain
    acq: AcqDimension
    acqValue: string | null
    product: ProductDimension
  }
  options: { sources: string[]; mediums: string[]; campaigns: string[] }
  rows: {
    key: string
    label: string
    users: number
    retention: RetentionCell[]
  }[]
}

export type AhaCompareGroup = {
  users: number
  retention: RetentionCell[]
  activeDaysAvg: number | null
  workoutsAvg: number | null
  checkInsAvg: number | null
}

export type AdminAhaPayload = {
  timezone: 'Europe/Moscow'
  generatedAt: string
  formula: 'exact_day_n_msk'
  range: { preset: string; fromKey: string; toKey: string }
  action: AhaAction
  actionLabel: string
  caption: string
  disclaimer: string
  windowDays: number
  minSample: number
  withAction: AhaCompareGroup
  withoutAction: AhaCompareGroup
  candidates: {
    action: AhaAction
    usersWith: number
    usersWithout: number
    r7With: number | null
    r7Without: number | null
    difference: number | null
    sampleSize: number
    score: number | null
    thin: boolean
  }[]
}

export function formatCellRate(cell: RetentionCell | undefined): string {
  if (!cell || cell.rate == null) return '—'
  if (cell.thin) return `мало · ${cell.eligible}`
  return `${Math.round(cell.rate * 1000) / 10}%`
}

export function formatRate(value: number | null | undefined, thin?: boolean): string {
  if (value == null || !Number.isFinite(value)) return '—'
  if (thin) return 'мало данных'
  return `${Math.round(value * 1000) / 10}%`
}

export function formatSignedRate(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const pct = Math.round(value * 1000) / 10
  return `${pct > 0 ? '+' : ''}${pct} п.п.`
}

export function ahaActionLabel(id: AhaAction): string {
  return AHA_ACTIONS.find((item) => item.id === id)?.label || id
}
