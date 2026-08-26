import type {
  WorkoutExerciseInsight,
  WorkoutInsights,
  WorkoutProgressRange,
} from './apiClient'
import { formatSignedPercent, ruPlural } from './workouts'

export type ProgressInsightKind =
  | 'positive_progress'
  | 'plateau'
  | 'declining'
  | 'consistency'
  | 'insufficient_data'

export type ProgressInsightCopy = {
  kind: ProgressInsightKind
  headline: string
  detail: string | null
  meta: string | null
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

function signedAmount(n: number) {
  const sign = n > 0 ? '+' : ''
  const value = Number.isInteger(n) ? String(n) : n.toFixed(1)
  return `${sign}${value}`
}

export function periodDaysLabel(range: WorkoutProgressRange) {
  return `${range} ${ruPlural(range, 'день', 'дня', 'дней')}`
}

/** Same visible-delta rule as the Progress list: never a blank % cell. */
export function liftProgressLabel(lift: WorkoutExerciseInsight): string | null {
  const pct = formatSignedPercent(lift.weightDeltaPercent)
  if (pct) return pct
  if (lift.repsDelta == null || lift.repsDelta === 0) return null
  const sign = lift.repsDelta > 0 ? '+' : ''
  return `${sign}${lift.repsDelta} повт.`
}

export function visibleImproving(insights: WorkoutInsights): WorkoutExerciseInsight[] {
  return insights.improving.filter((lift) => Boolean(liftProgressLabel(lift)))
}

export function plateauDaysLabel(lift: WorkoutExerciseInsight): string | null {
  const days = Math.round(lift.plateau.spanDays)
  if (days < 2) return 'Без прогресса'
  return `Без прогресса ${days} ${ruPlural(days, 'день', 'дня', 'дней')}`
}

/** Frequency vs same-length previous window. Hidden when there is nothing to compare. */
export function formatRhythmDelta(currentPerWeek: number, previousPerWeek: number): string | null {
  if (previousPerWeek <= 0) return null
  const delta = round1(currentPerWeek - previousPerWeek)
  if (delta === 0) return null
  return `${signedAmount(delta)} к прошлому периоду`
}

/**
 * Deterministic summary from already-computed insights.
 * Not an LLM: no invented recommendations, no fake numbers.
 */
export function deriveProgressInsight(insights: WorkoutInsights): ProgressInsightCopy {
  const improving = visibleImproving(insights)
  const plateaus = insights.plateauCandidates
  const n = insights.workoutCount.current
  const prs = insights.prs.count

  const metaParts: string[] = []
  if (n > 0) {
    metaParts.push(`${n} ${ruPlural(n, 'тренировка', 'тренировки', 'тренировок')}`)
  }
  if (prs > 0) {
    metaParts.push(`${prs} ${ruPlural(prs, 'новый рекорд', 'новых рекорда', 'новых рекордов')}`)
  }
  const meta = metaParts.length ? metaParts.join(' · ') : null

  if (improving.length > 0) {
    const names = improving.slice(0, 2).map((l) => l.name)
    let detail: string | null = null
    if (plateaus[0]) {
      detail = `${plateaus[0].name} пока без изменений.`
    } else if (names.length === 1) {
      detail = `${names[0]} — лучший результат за период.`
    } else if (names.length >= 2) {
      detail = `${names[0]} и ${names[1]} — лучший результат за период.`
    }
    return {
      kind: 'positive_progress',
      headline: `Ты стал сильнее в ${improving.length} ${ruPlural(
        improving.length,
        'упражнении',
        'упражнениях',
        'упражнениях',
      )}.`,
      detail,
      meta,
    }
  }

  if (plateaus.length > 0) {
    const p = plateaus[0]
    const days = Math.round(p.plateau.spanDays)
    const detail =
      days >= 2
        ? `${p.name} не меняется уже ${days} ${ruPlural(days, 'день', 'дня', 'дней')}.`
        : `${p.name} пока без прогресса.`
    return {
      kind: 'plateau',
      headline: 'Похоже, ты застрял',
      detail,
      meta,
    }
  }

  const count = insights.workoutCount
  if (count.previous > 0 && count.delta < 0) {
    return {
      kind: 'declining',
      headline: 'Нагрузка снизилась',
      detail: 'За период тренировок стало меньше, чем за такой же срок до этого.',
      meta,
    }
  }

  const freq = insights.frequency.currentPerWeek
  const weeks = insights.consistency.consecutiveWeeks
  if (freq >= 2 && weeks >= 3) {
    return {
      kind: 'consistency',
      headline: 'Хороший ритм',
      detail: `Ты стабильно тренируешься ${freq} в неделю.`,
      meta,
    }
  }

  return {
    kind: 'insufficient_data',
    headline: 'Пока мало данных',
    detail: 'Запиши ещё несколько тренировок, чтобы Spotter смог увидеть динамику.',
    meta,
  }
}
