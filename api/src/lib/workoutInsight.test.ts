import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { WorkoutExerciseInsight, WorkoutInsights } from './workoutAnalytics.ts'
import {
  collectAllowedExercises,
  evaluateInsightEligibility,
  extractJson,
  hashInsightInput,
  insightsForModel,
  sanitizeInsightLetter,
} from './workoutInsight.ts'

const NOW = new Date('2026-08-26T12:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000

function lift(name: string, over: Partial<WorkoutExerciseInsight> = {}): WorkoutExerciseInsight {
  return {
    identity: `n:${name.toLowerCase()}`,
    name,
    sessionCount: 2,
    setCount: 6,
    volume: 1280,
    maxWeightKg: 90,
    bestSet: { weightKg: 90, reps: 8 },
    firstBest: { weightKg: 80, reps: 8 },
    lastBest: { weightKg: 90, reps: 8, at: NOW.toISOString() },
    weightDeltaKg: 10,
    repsDelta: 0,
    weightDeltaPercent: 12.5,
    volumeDelta: 160,
    volumeDeltaPercent: 12.5,
    trend: 'improving',
    plateauCandidate: false,
    plateau: {
      sessionCount: 2,
      spanDays: 5,
      minWeightKg: 80,
      maxWeightKg: 90,
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

function modelInput(over: Partial<WorkoutInsights> = {}) {
  const data = insights(over)
  return insightsForModel(
    data,
    {
      currentStart: new Date(NOW.getTime() - 7 * DAY),
      previousStart: new Date(NOW.getTime() - 14 * DAY),
      now: NOW,
    },
    {
      start: new Date('2026-08-24T21:00:00.000Z'),
      end: new Date('2026-08-31T21:00:00.000Z'),
    },
  )
}

describe('evaluateInsightEligibility', () => {
  it('locks when there is only one workout', () => {
    const gate = evaluateInsightEligibility(
      insights({ workoutCount: { current: 1, previous: 0, delta: 1, deltaPercent: null } }),
    )
    assert.equal(gate.ok, false)
    assert.equal(gate.reason, 'need_workouts')
  })

  it('skips two flat workouts with no PR or improving lifts', () => {
    const gate = evaluateInsightEligibility(
      insights({
        workoutCount: { current: 2, previous: 2, delta: 0, deltaPercent: 0 },
        volume: { current: 1000, previous: 1000, delta: 0, deltaPercent: 0 },
      }),
    )
    assert.equal(gate.ok, false)
    assert.equal(gate.reason, 'no_signal')
  })

  it('is ready when there is a PR', () => {
    const gate = evaluateInsightEligibility(
      insights({
        workoutCount: { current: 2, previous: 2, delta: 0, deltaPercent: 0 },
        prs: {
          count: 1,
          items: [
            { name: 'Жим лёжа', at: NOW.toISOString(), weightKg: 100, reps: 6, kind: 'weight' },
          ],
        },
      }),
    )
    assert.equal(gate.ok, true)
    assert.equal(gate.reason, null)
  })

  it('is ready when volume rose at least 5%', () => {
    const gate = evaluateInsightEligibility(
      insights({
        workoutCount: { current: 3, previous: 3, delta: 0, deltaPercent: 0 },
        volume: { current: 11200, previous: 10000, delta: 1200, deltaPercent: 12 },
      }),
    )
    assert.equal(gate.ok, true)
  })
})

describe('insightsForModel', () => {
  it('strips PII keys and keeps PR plus volume delta', () => {
    const input = modelInput({
      workoutCount: { current: 4, previous: 3, delta: 1, deltaPercent: 33.3 },
      volume: { current: 24500, previous: 21800, delta: 2700, deltaPercent: 12.4 },
      prs: {
        count: 1,
        items: [
          { name: 'Жим лёжа', at: NOW.toISOString(), weightKg: 100, reps: 6, kind: 'weight' },
        ],
      },
      improving: [lift('Жим лёжа')],
    })
    const raw = JSON.stringify(input)
    assert.equal(/email/i.test(raw), false)
    assert.equal(/userId/i.test(raw), false)
    assert.equal(raw.includes('@'), false)
    assert.equal(input.prs.count, 1)
    assert.equal(input.prs.items[0].name, 'Жим лёжа')
    assert.equal(input.volume.deltaPercent, 12.4)
    assert.equal('exercises' in input, false)
    assert.equal(input.improving[0]?.name, 'Жим лёжа')
    assert.equal(input.improving[0]?.plateau.spanDays, 5)
    assert.deepEqual(input.felt, [])
  })

  it('passes mixed felt including null and does not invent normal', () => {
    const felt = [
      { at: '2026-08-24T12:00:00.000Z', feedback: 'hard' as const },
      { at: '2026-08-26T12:00:00.000Z', feedback: null },
    ]
    const input = insightsForModel(
      insights({ workoutCount: { current: 2, previous: 0, delta: 2, deltaPercent: null } }),
      {
        currentStart: new Date(NOW.getTime() - 7 * DAY),
        previousStart: new Date(NOW.getTime() - 14 * DAY),
        now: NOW,
      },
      {
        start: new Date('2026-08-24T21:00:00.000Z'),
        end: new Date('2026-08-31T21:00:00.000Z'),
      },
      felt,
    )
    assert.equal(input.felt.length, 2)
    assert.equal(input.felt[0]?.feedback, 'hard')
    assert.equal(input.felt[1]?.feedback, null)
  })

  it('hashes the same payload the same way', () => {
    const a = modelInput({
      workoutCount: { current: 4, previous: 3, delta: 1, deltaPercent: 33.3 },
    })
    const b = modelInput({
      workoutCount: { current: 4, previous: 3, delta: 1, deltaPercent: 33.3 },
    })
    assert.equal(hashInsightInput(a), hashInsightInput(b))
  })
})

describe('sanitizeInsightLetter', () => {
  const input = modelInput({
    workoutCount: { current: 4, previous: 3, delta: 1, deltaPercent: 33.3 },
    volume: { current: 24500, previous: 21800, delta: 2700, deltaPercent: 12.4 },
    prs: {
      count: 1,
      items: [{ name: 'Жим лёжа', at: NOW.toISOString(), weightKg: 100, reps: 6, kind: 'weight' }],
    },
    improving: [lift('Жим лёжа')],
  })

  it('keeps at most three insights and drops unknown exercises', () => {
    const letter = sanitizeInsightLetter(
      {
        summary: { title: 'Неделя в плюсе', text: 'Четыре тренировки и новый жим.' },
        insights: [
          { type: 'progress', priority: 'high', title: '1', text: 'a', exercise: 'Жим лёжа', value: '12.4%' },
          { type: 'behavior', title: '2', text: 'b' },
          { type: 'attention', title: '3', text: 'c' },
          { type: 'try_next', title: '4', text: 'd' },
        ],
        recommendations: [{ title: 'Дальше', text: 'Оставь жим', reason: 'PR' }],
      },
      input,
    )
    assert.equal(letter.insights.length, 3)
    assert.equal(letter.insights[0]?.exercise, 'Жим лёжа')
    const unknown = sanitizeInsightLetter(
      {
        summary: { title: 'Неделя', text: 'Текст.' },
        insights: [
          { type: 'progress', title: 'X', text: 'y', exercise: 'Сделанный упражнение' },
        ],
        recommendations: [],
      },
      input,
    )
    assert.equal(unknown.insights[0]?.exercise, null)
  })

  it('throws on invented counts, gym time without activity, and medical claims', () => {
    assert.throws(() =>
      sanitizeInsightLetter(
        {
          summary: { title: '4 тренировки', text: 'Ты тренировался 4 раза и провёл в зале 2 часа.' },
          insights: [],
          recommendations: [],
        },
        input,
      ),
    )
    assert.throws(() =>
      sanitizeInsightLetter(
        {
          summary: { title: 'Неделя', text: 'У тебя перетренированность и травма.' },
          insights: [],
          recommendations: [],
        },
        input,
      ),
    )
    const letter = sanitizeInsightLetter(
      {
        summary: { title: 'Неделя', text: 'Две тренировки и рост объёма 12.4.' },
        insights: [
          { type: 'attention', title: 'Плато', text: 'У тебя перетрен.', exercise: 'Жим лёжа' },
        ],
        recommendations: [],
      },
      input,
    )
    assert.equal(letter.insights.length, 0)
  })

  it('drops invented numeric values', () => {
    const letter = sanitizeInsightLetter(
      {
        summary: { title: 'Неделя', text: 'Текст с цифрой из фактов 12.4.' },
        insights: [
          {
            type: 'progress',
            title: 'Жим',
            text: 'Рост',
            exercise: 'Жим лёжа',
            value: '999кг',
          },
        ],
      },
      input,
    )
    assert.equal(letter.insights[0]?.value, null)
    assert.equal(letter.insights[0]?.exercise, 'Жим лёжа')
  })

  it('parses fenced JSON and rejects empty summary', () => {
    const fenced = extractJson('```json\n{"summary":{"title":"A","text":"B"},"insights":[]}\n```')
    const letter = sanitizeInsightLetter(fenced, input)
    assert.equal(letter.summary.title, 'A')
    assert.throws(() =>
      sanitizeInsightLetter({ summary: { title: 'A', text: '   ' }, insights: [] }, input),
    )
  })

  it('throws on garbage so generate can return failed instead of 500', () => {
    assert.throws(() => extractJson('это не json'))
    assert.throws(() => sanitizeInsightLetter({ headline: 'coach schema' }, input))
  })
})

describe('collectAllowedExercises', () => {
  it('includes PR names', () => {
    const names = collectAllowedExercises(
      modelInput({
        prs: {
          count: 1,
          items: [{ name: 'Присед', at: NOW.toISOString(), weightKg: 100, reps: 5, kind: 'weight' }],
        },
      }),
    )
    assert.equal(names.has('Присед'), true)
  })
})
