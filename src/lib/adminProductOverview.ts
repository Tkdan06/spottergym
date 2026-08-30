import type { AdminRetentionPoint } from './adminAnalytics'

export const OVERVIEW_PRESETS = ['today', '7d', '30d', '90d', '12m', 'custom'] as const
export type OverviewPreset = (typeof OVERVIEW_PRESETS)[number]

export type OverviewFunnelStep = {
  id: 'registered' | 'entered' | 'meaningful' | 'returned'
  label: string
  users: number
  conversion: number | null
  dropOff: number
  dropOffRate: number | null
  worst: boolean
}

export type AdminProductOverview = {
  timezone: 'Europe/Moscow'
  generatedAt: string
  range: {
    preset: OverviewPreset
    from: string
    to: string
    fromKey: string
    toKey: string
  }
  kpi: {
    registrations: number
    activeUsers: number
    dau: number
    wau: number
    mau: number
    activationRate: number | null
    r7: AdminRetentionPoint
    r30: AdminRetentionPoint
    workouts: number
    checkIns: number
    socialActions: number
    aiUsers: number
  }
  funnel: OverviewFunnelStep[]
  signals: {
    social: {
      profilesViewed: number
      likes: number
      requests: number
      acceptedRequests: number
      chats: number
    }
    training: {
      workouts: number
      checkIns: number
      activeTrainingDays: number
    }
    ai: {
      users: number
      analysesRequested: number
      analysesGenerated: number
    }
  }
  retention: {
    r1: AdminRetentionPoint
    r7: AdminRetentionPoint
    r30: AdminRetentionPoint
  }
}

export const OVERVIEW_PRESET_LABEL: Record<OverviewPreset, string> = {
  today: 'Сегодня',
  '7d': '7 дней',
  '30d': '30 дней',
  '90d': '90 дней',
  '12m': '12 месяцев',
  custom: 'Custom',
}

export function isOverviewPreset(value: string | null | undefined): value is OverviewPreset {
  return !!value && (OVERVIEW_PRESETS as readonly string[]).includes(value)
}

export function formatOverviewCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '0'
  return Math.round(value).toLocaleString('ru-RU')
}

export function formatOverviewRate(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${Math.round(value * 1000) / 10}%`
}

export function overviewProblemText(funnel: OverviewFunnelStep[]): string | null {
  const worst = funnel.find((step) => step.worst)
  if (!worst) return null
  const from =
    worst.id === 'entered'
      ? 'регистрацией и входом в продукт'
      : worst.id === 'meaningful'
        ? 'входом и первым meaningful action'
        : 'активацией и возвратом'
  return `Главный разрыв сейчас — между ${from}.`
}
