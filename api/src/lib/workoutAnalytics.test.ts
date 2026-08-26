import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  activitySummaryFromStats,
  buildWorkoutInsights,
  classifyTrend,
  isPlateauCandidate,
  pctDelta,
  sessionVolume,
  setsVolume,
  splitSessions,
  type AnalyticsSession,
} from './workoutAnalytics.js'
import { parsePeriodRange } from './periodRange.js'

const NOW = new Date('2026-08-26T12:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000

function atDaysAgo(days: number) {
  return new Date(NOW.getTime() - days * DAY)
}

function session(
  daysAgo: number,
  lifts: { name: string; sets: { weightKg: number; reps: number }[]; trackKey?: string }[],
): AnalyticsSession {
  return {
    performedAt: atDaysAgo(daysAgo),
    exercises: lifts.map((l) => ({
      name: l.name,
      trackKey: l.trackKey ?? null,
      sets: l.sets,
    })),
  }
}

describe('setsVolume / sessionVolume', () => {
  it('sums weight × reps and skips reps 0', () => {
    assert.equal(
      setsVolume([
        { weightKg: 80, reps: 8 },
        { weightKg: 80, reps: 8 },
        { weightKg: 60, reps: 0 },
      ]),
      1280,
    )
    const row = session(1, [
      {
        name: 'Жим',
        sets: [
          { weightKg: 80, reps: 8 },
          { weightKg: 80, reps: 8 },
        ],
      },
    ])
    assert.equal(sessionVolume(row), 1280)
  })
})

describe('pctDelta', () => {
  it('returns null when previous is 0', () => {
    assert.equal(pctDelta(4, 0), null)
  })
  it('returns percent change', () => {
    assert.equal(pctDelta(4, 3), 33.3)
  })
})

describe('splitSessions', () => {
  it('puts equal-length current and previous rolling windows', () => {
    const rows = [
      session(1, [{ name: 'Жим', sets: [{ weightKg: 80, reps: 8 }] }]),
      session(8, [{ name: 'Жим', sets: [{ weightKg: 80, reps: 8 }] }]),
      session(15, [{ name: 'Жим', sets: [{ weightKg: 80, reps: 8 }] }]),
    ]
    const { current, previous } = splitSessions(rows, 7, NOW)
    assert.equal(current.length, 1)
    assert.equal(previous.length, 1)
    assert.equal(current[0].performedAt.getTime(), atDaysAgo(1).getTime())
    assert.equal(previous[0].performedAt.getTime(), atDaysAgo(8).getTime())
  })

  it('accepts 180 and 365 day windows', () => {
    const rows = [
      session(10, [{ name: 'Жим', sets: [{ weightKg: 80, reps: 8 }] }]),
      session(200, [{ name: 'Жим', sets: [{ weightKg: 80, reps: 8 }] }]),
      session(400, [{ name: 'Жим', sets: [{ weightKg: 80, reps: 8 }] }]),
    ]
    const half = splitSessions(rows, 180, NOW)
    assert.equal(half.current.length, 1)
    assert.equal(half.previous.length, 1)
    const year = splitSessions(rows, 365, NOW)
    assert.equal(year.current.length, 2)
    assert.equal(year.previous.length, 1)
  })

  it('drops sessions in the future from current', () => {
    const rows = [
      session(1, [{ name: 'Жим', sets: [{ weightKg: 80, reps: 8 }] }]),
      {
        performedAt: new Date('2026-12-01T12:00:00.000Z'),
        exercises: [{ name: 'Жим', trackKey: null, sets: [{ weightKg: 200, reps: 1 }] }],
      },
    ]
    const { current } = splitSessions(rows, 7, NOW)
    assert.equal(current.length, 1)
    assert.equal(current[0].performedAt.getTime(), atDaysAgo(1).getTime())
    const insights = buildWorkoutInsights(7, rows, null, NOW)
    assert.equal(insights.workoutCount.current, 1)
    assert.equal(
      insights.prs.items.some((p) => p.weightKg === 200),
      false,
    )
  })
})

describe('parsePeriodRange', () => {
  it('accepts 180 and 365 and falls back to 30', () => {
    assert.equal(parsePeriodRange('180'), 180)
    assert.equal(parsePeriodRange('365'), 365)
    assert.equal(parsePeriodRange('12'), 30)
  })
})

describe('classifyTrend', () => {
  it('is insufficient_data with a single session', () => {
    assert.equal(
      classifyTrend(1, { weightKg: 80, reps: 8 }, { weightKg: 80, reps: 8 }),
      'insufficient_data',
    )
  })
  it('is improving when weight rises more than 2.5%', () => {
    assert.equal(
      classifyTrend(2, { weightKg: 80, reps: 8 }, { weightKg: 90, reps: 8 }),
      'improving',
    )
  })
})

describe('isPlateauCandidate', () => {
  it('is false on a 7-day range', () => {
    assert.equal(
      isPlateauCandidate({
        range: 7,
        sessionCount: 4,
        spanDays: 20,
        minWeightKg: 80,
        maxWeightKg: 80,
        repsDelta: 0,
        trend: 'stable',
      }),
      false,
    )
  })
  it('is false when working weight rose', () => {
    assert.equal(
      isPlateauCandidate({
        range: 30,
        sessionCount: 4,
        spanDays: 20,
        minWeightKg: 80,
        maxWeightKg: 90,
        repsDelta: 0,
        trend: 'improving',
      }),
      false,
    )
  })
  it('is true when 30d, 3+ sessions, long span, flat weight and reps', () => {
    assert.equal(
      isPlateauCandidate({
        range: 30,
        sessionCount: 3,
        spanDays: 16,
        minWeightKg: 80,
        maxWeightKg: 80,
        repsDelta: 0,
        trend: 'stable',
      }),
      true,
    )
  })
  it('is true on 180d and 365d when the lift is flat', () => {
    const flat = {
      sessionCount: 3,
      spanDays: 16,
      minWeightKg: 80,
      maxWeightKg: 80,
      repsDelta: 0,
      trend: 'stable' as const,
    }
    assert.equal(isPlateauCandidate({ range: 180, ...flat }), true)
    assert.equal(isPlateauCandidate({ range: 365, ...flat }), true)
  })
})

describe('buildWorkoutInsights', () => {
  it('detects a new weight PR and ignores a repeat of the old best', () => {
    const rows = [
      session(20, [{ name: 'Жим лёжа', sets: [{ weightKg: 80, reps: 5 }] }]),
      session(2, [{ name: 'Жим лёжа', sets: [{ weightKg: 80, reps: 5 }] }]),
      session(1, [{ name: 'Жим лёжа', sets: [{ weightKg: 85, reps: 5 }] }]),
    ]
    const insights = buildWorkoutInsights(7, rows, null, NOW)
    assert.equal(insights.prs.count, 1)
    assert.equal(insights.prs.items[0].kind, 'weight')
    assert.equal(insights.prs.items[0].weightKg, 85)
  })

  it('does not mix workout count with check-in visits', () => {
    const rows = [
      session(1, [{ name: 'Жим', sets: [{ weightKg: 80, reps: 8 }] }]),
      session(2, [{ name: 'Жим', sets: [{ weightKg: 80, reps: 8 }] }]),
      session(3, [{ name: 'Жим', sets: [{ weightKg: 80, reps: 8 }] }]),
      session(4, [{ name: 'Жим', sets: [{ weightKg: 80, reps: 8 }] }]),
    ]
    const insights = buildWorkoutInsights(
      7,
      rows,
      { totalSessions: 2, totalMinutes: 90 },
      NOW,
    )
    assert.equal(insights.workoutCount.current, 4)
    assert.equal(insights.activity?.visits, 2)
    assert.notEqual(insights.workoutCount.current, insights.activity?.visits)
  })

  it('marks a 30-day flat lift as plateau and a 7-day window as not', () => {
    const rows = [
      session(20, [{ name: 'Присед', sets: [{ weightKg: 100, reps: 6 }] }]),
      session(12, [{ name: 'Присед', sets: [{ weightKg: 100, reps: 6 }] }]),
      session(2, [{ name: 'Присед', sets: [{ weightKg: 100, reps: 6 }] }]),
    ]
    const month = buildWorkoutInsights(30, rows, null, NOW)
    const week = buildWorkoutInsights(7, rows, null, NOW)
    assert.equal(month.exercises[0]?.plateauCandidate, true)
    assert.equal(week.exercises[0]?.plateauCandidate, false)
  })

  it('returns null activity when there are no check-ins', () => {
    assert.equal(activitySummaryFromStats({ totalSessions: 0, totalMinutes: 0 }), null)
    const insights = buildWorkoutInsights(7, [], { totalSessions: 0, totalMinutes: 0 }, NOW)
    assert.equal(insights.activity, null)
    assert.equal(insights.workoutCount.current, 0)
  })
})
