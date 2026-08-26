import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { WorkoutExerciseInsight, WorkoutInsights } from './workoutAnalytics.ts'
import { extractJson } from './workoutInsight.ts'
import {
  evaluateMonthlyEligibility,
  hashMonthlyInput,
  monthlyInsightsForModel,
  moscowMonthBounds,
  sanitizeMonthlyLetter,
} from './workoutMonthly.ts'

const NOW = new Date('2026-08-26T12:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000

function lift(name: string, over: Partial<WorkoutExerciseInsight> = {}): WorkoutExerciseInsight {
  return {
    identity: `n:${name.toLowerCase()}`,
    name,
    sessionCount: 4,
    setCount: 12,
    volume: 4800,
    maxWeightKg: 100,
    bestSet: { weightKg: 100, reps: 5 },
    firstBest: { weightKg: 90, reps: 5 },
    lastBest: { weightKg: 100, reps: 5, at: NOW.toISOString() },
    weightDeltaKg: 10,
    repsDelta: 0,
    weightDeltaPercent: 11.1,
    volumeDelta: 400,
    volumeDeltaPercent: 9,
    trend: 'improving',
    plateauCandidate: false,
    plateau: {
      sessionCount: 4,
      spanDays: 21,
      minWeightKg: 90,
      maxWeightKg: 100,
      weightDeltaKg: 10,
      repsDelta: 0,
    },
    ...over,
  }
}

function insights(over: Partial<WorkoutInsights> = {}): WorkoutInsights {
  return {
    workoutCount: { current: 0, previous: 0, delta: 0, deltaPercent: null },
    frequency: { currentPerWeek: 0, previousPerWeek: 0 },
    volume: { current: 0, previous: 0, delta: 0, deltaPercent: null },
    consistency: { trainingDays: 0, sessionCount: 0, perWeek: 0, consecutiveWeeks: 0 },
    prs: { count: 0, items: [] },
    exercises: [],
    improving: [],
    plateauCandidates: [],
    activity: null,
    ...over,
  }
}

function modelInput(
  over: Partial<WorkoutInsights> = {},
  historyOver: Partial<WorkoutInsights> = {},
) {
  return monthlyInsightsForModel(
    insights(over),
    insights(historyOver),
    {
      currentStart: new Date(NOW.getTime() - 30 * DAY),
      previousStart: new Date(NOW.getTime() - 60 * DAY),
      now: NOW,
    },
    moscowMonthBounds(NOW),
  )
}

describe('moscowMonthBounds', () => {
  it('uses the MSK calendar month for 26 Aug 2026', () => {
    const { start, end } = moscowMonthBounds(NOW)
    assert.equal(start.toISOString(), '2026-07-31T21:00:00.000Z')
    assert.equal(end.toISOString(), '2026-08-31T21:00:00.000Z')
  })
})

describe('evaluateMonthlyEligibility', () => {
  it('locks when there are fewer than four workouts', () => {
    const gate = evaluateMonthlyEligibility(
      insights({ workoutCount: { current: 3, previous: 2, delta: 1, deltaPercent: 50 } }),
    )
    assert.equal(gate.ok, false)
    assert.equal(gate.reason, 'need_workouts')
  })

  it('skips four flat workouts with no PR or improving lifts', () => {
    const gate = evaluateMonthlyEligibility(
      insights({
        workoutCount: { current: 4, previous: 4, delta: 0, deltaPercent: 0 },
        volume: { current: 8000, previous: 8000, delta: 0, deltaPercent: 0 },
      }),
    )
    assert.equal(gate.ok, false)
    assert.equal(gate.reason, 'no_signal')
  })

  it('is ready when there is a PR', () => {
    const gate = evaluateMonthlyEligibility(
      insights({
        workoutCount: { current: 4, previous: 4, delta: 0, deltaPercent: 0 },
        prs: {
          count: 1,
          items: [
            { name: 'Жим лёжа', at: NOW.toISOString(), weightKg: 100, reps: 6, kind: 'weight' },
          ],
        },
      }),
    )
    assert.equal(gate.ok, true)
  })

  it('is ready when volume rose at least 5%', () => {
    const gate = evaluateMonthlyEligibility(
      insights({
        workoutCount: { current: 5, previous: 5, delta: 0, deltaPercent: 0 },
        volume: { current: 11200, previous: 10000, delta: 1200, deltaPercent: 12 },
      }),
    )
    assert.equal(gate.ok, true)
  })

  it('is ready when a 30-day lift is a plateau candidate', () => {
    const gate = evaluateMonthlyEligibility(
      insights({
        workoutCount: { current: 6, previous: 6, delta: 0, deltaPercent: 0 },
        plateauCandidates: [lift('Присед', { trend: 'stable', plateauCandidate: true })],
      }),
    )
    assert.equal(gate.ok, true)
  })
})

describe('monthlyInsightsForModel', () => {
  it('strips PII, keeps 30d PR and volume, and does not send exercises[]', () => {
    const input = modelInput(
      {
        workoutCount: { current: 12, previous: 9, delta: 3, deltaPercent: 33.3 },
        volume: { current: 42000, previous: 36800, delta: 5200, deltaPercent: 14.1 },
        prs: {
          count: 2,
          items: [
            { name: 'Жим лёжа', at: NOW.toISOString(), weightKg: 100, reps: 6, kind: 'weight' },
          ],
        },
        improving: [lift('Жим лёжа')],
      },
      {
        workoutCount: { current: 28, previous: 20, delta: 8, deltaPercent: 40 },
        improving: [lift('Тяга')],
        plateauCandidates: [lift('Присед', { trend: 'stable', plateauCandidate: true })],
      },
    )
    const raw = JSON.stringify(input)
    assert.equal(/email/i.test(raw), false)
    assert.equal(/userId/i.test(raw), false)
    assert.equal('exercises' in input, false)
    assert.equal(input.period.range, 30)
    assert.equal(input.prs.count, 2)
    assert.equal(input.volume.deltaPercent, 14.1)
    assert.equal(input.history90.range, 90)
    assert.equal(input.history90.improving[0]?.name, 'Тяга')
    assert.equal('workoutCount' in input.history90, false)
    assert.equal(input.workoutCount.current, 12)
    assert.deepEqual(input.felt, [])
  })

  it('passes mixed felt including null and does not invent normal', () => {
    const felt = [
      { at: '2026-08-10T12:00:00.000Z', feedback: 'easy' as const },
      { at: '2026-08-20T12:00:00.000Z', feedback: null },
      { at: '2026-08-26T12:00:00.000Z', feedback: 'hard' as const },
    ]
    const input = monthlyInsightsForModel(
      insights({ workoutCount: { current: 12, previous: 9, delta: 3, deltaPercent: 33.3 } }),
      insights(),
      {
        currentStart: new Date(NOW.getTime() - 30 * DAY),
        previousStart: new Date(NOW.getTime() - 60 * DAY),
        now: NOW,
      },
      moscowMonthBounds(NOW),
      felt,
    )
    assert.equal(input.felt.length, 3)
    assert.equal(input.felt[0]?.feedback, 'easy')
    assert.equal(input.felt[1]?.feedback, null)
    assert.equal(input.felt[2]?.feedback, 'hard')
  })

  it('hashes the same payload the same way', () => {
    const a = modelInput({
      workoutCount: { current: 12, previous: 9, delta: 3, deltaPercent: 33.3 },
    })
    const b = modelInput({
      workoutCount: { current: 12, previous: 9, delta: 3, deltaPercent: 33.3 },
    })
    assert.equal(hashMonthlyInput(a), hashMonthlyInput(b))
  })
})

describe('sanitizeMonthlyLetter', () => {
  const input = modelInput({
    workoutCount: { current: 12, previous: 9, delta: 3, deltaPercent: 33.3 },
    volume: { current: 42000, previous: 36800, delta: 5200, deltaPercent: 14.1 },
    prs: {
      count: 1,
      items: [{ name: 'Жим лёжа', at: NOW.toISOString(), weightKg: 100, reps: 6, kind: 'weight' }],
    },
    improving: [lift('Жим лёжа')],
  })

  it('keeps at most three wins and two attention items', () => {
    const letter = sanitizeMonthlyLetter(
      {
        headline: { title: 'Стабильный месяц', text: 'Двенадцать тренировок и жим вырос.' },
        wins: [
          { title: '1', text: 'a', exercise: 'Жим лёжа', value: '14.1%' },
          { title: '2', text: 'b' },
          { title: '3', text: 'c' },
          { title: '4', text: 'd' },
        ],
        attention: [{ title: 'A', text: 'x' }, { title: 'B', text: 'y' }, { title: 'C', text: 'z' }],
        recommendations: [{ title: 'Дальше', text: 'Оставь жим', reason: 'PR' }],
        wrap: 'Коротко: плюс к базе.',
      },
      input,
    )
    assert.equal(letter.wins.length, 3)
    assert.equal(letter.attention.length, 2)
    assert.equal(letter.wins[0]?.exercise, 'Жим лёжа')
  })

  it('drops unknown exercises and invented values', () => {
    const letter = sanitizeMonthlyLetter(
      {
        headline: { title: 'Месяц', text: 'Текст с 14.1 из фактов.' },
        wins: [
          {
            title: 'Жим',
            text: 'Рост',
            exercise: 'Сделанный упражнение',
            value: '999кг',
          },
        ],
      },
      input,
    )
    assert.equal(letter.wins[0]?.exercise, null)
    assert.equal(letter.wins[0]?.value, null)
  })

  it('throws on medical claims in the headline', () => {
    assert.throws(() =>
      sanitizeMonthlyLetter(
        {
          headline: { title: 'Месяц', text: 'У тебя травма и перетренированность.' },
          wins: [],
          attention: [],
          recommendations: [],
          wrap: '',
        },
        input,
      ),
    )
  })

  it('parses fenced JSON and rejects empty headline', () => {
    const fenced = extractJson(
      '```json\n{"headline":{"title":"A","text":"B"},"wins":[],"attention":[],"recommendations":[],"wrap":"C"}\n```',
    )
    const letter = sanitizeMonthlyLetter(fenced, input)
    assert.equal(letter.headline.title, 'A')
    assert.equal(letter.wrap, 'C')
    assert.throws(() =>
      sanitizeMonthlyLetter({ headline: { title: 'A', text: '   ' }, wins: [] }, input),
    )
  })

  it('throws on garbage so generate can return failed instead of 500', () => {
    assert.throws(() => extractJson('это не json'))
    assert.throws(() => sanitizeMonthlyLetter({ summary: 'weekly schema' }, input))
  })
})
