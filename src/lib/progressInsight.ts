import type { WorkoutExerciseInsight, WorkoutInsights } from './apiClient'
import { formatSignedPercent, ruPlural } from './workouts'

export type ProgressInsightKind =
  | 'positive_progress'
  | 'negative_progress'
  | 'plateau'
  | 'declining'
  | 'consistency'
  | 'insufficient_data'

export type ProgressInsightCopy = {
  kind: ProgressInsightKind
  headline: string
}

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

export function visibleDeclining(insights: WorkoutInsights): WorkoutExerciseInsight[] {
  return insights.exercises
    .filter((lift) => lift.trend === 'declining' && Boolean(liftProgressLabel(lift)))
    .slice(0, 5)
}

export function plateauDaysLabel(lift: WorkoutExerciseInsight): string | null {
  const days = Math.round(lift.plateau.spanDays)
  if (days < 2) return 'Без прогресса'
  return `Без прогресса ${days} ${ruPlural(days, 'день', 'дня', 'дней')}`
}

function exerciseCountHeadline(verb: 'сильнее' | 'слабее', count: number) {
  return `Ты стал ${verb} в ${count} ${ruPlural(
    count,
    'упражнении',
    'упражнениях',
    'упражнениях',
  )}.`
}

/**
 * Deterministic summary from already-computed insights.
 * Not an LLM: no invented recommendations, no fake numbers.
 */
export function deriveProgressInsight(insights: WorkoutInsights): ProgressInsightCopy {
  const improving = visibleImproving(insights)
  const decliningLifts = visibleDeclining(insights)
  const plateaus = insights.plateauCandidates

  if (improving.length > 0) {
    return {
      kind: 'positive_progress',
      headline: exerciseCountHeadline('сильнее', improving.length),
    }
  }

  if (decliningLifts.length > 0) {
    return {
      kind: 'negative_progress',
      headline: exerciseCountHeadline('слабее', decliningLifts.length),
    }
  }

  if (plateaus.length > 0) {
    return {
      kind: 'plateau',
      headline: 'Похоже, ты застрял',
    }
  }

  const count = insights.workoutCount
  if (count.previous > 0 && count.delta < 0) {
    return {
      kind: 'declining',
      headline: 'Нагрузка снизилась',
    }
  }

  const freq = insights.frequency.currentPerWeek
  const weeks = insights.consistency.consecutiveWeeks
  if (freq >= 2 && weeks >= 3) {
    return {
      kind: 'consistency',
      headline: 'Хороший ритм',
    }
  }

  return {
    kind: 'insufficient_data',
    headline: 'Пока мало данных',
  }
}
