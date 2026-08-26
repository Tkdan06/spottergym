import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { exerciseIdentity, feltTimeline, parseWorkoutFelt } from './workouts.ts'
import {
  lookupIdempotentWorkout,
  payloadHash,
  rememberIdempotentWorkout,
} from './workoutIdempotency.ts'

describe('parseWorkoutFelt', () => {
  it('accepts easy, normal, hard and null', () => {
    assert.equal(parseWorkoutFelt('easy'), 'easy')
    assert.equal(parseWorkoutFelt('normal'), 'normal')
    assert.equal(parseWorkoutFelt('hard'), 'hard')
    assert.equal(parseWorkoutFelt(null), null)
  })

  it('rejects invalid values', () => {
    assert.throws(() => parseWorkoutFelt('invalid_value'))
    assert.throws(() => parseWorkoutFelt('Тяжело'))
    assert.throws(() => parseWorkoutFelt(1))
  })
})

describe('feltTimeline', () => {
  const start = new Date('2026-08-20T00:00:00.000Z')
  it('keeps null mixed with values and stays inside the window', () => {
    const points = feltTimeline(
      [
        { performedAt: new Date('2026-08-19T12:00:00.000Z'), feedback: 'easy' },
        { performedAt: new Date('2026-08-21T12:00:00.000Z'), feedback: 'normal' },
        { performedAt: new Date('2026-08-23T12:00:00.000Z'), feedback: null },
        { performedAt: new Date('2026-08-25T12:00:00.000Z'), feedback: 'hard' },
        { performedAt: new Date('2026-12-01T12:00:00.000Z'), feedback: 'easy' },
      ],
      start,
      20,
      new Date('2026-08-26T12:00:00.000Z'),
    )
    assert.equal(points.length, 3)
    assert.equal(points[0]?.feedback, 'normal')
    assert.equal(points[1]?.feedback, null)
    assert.equal(points[2]?.feedback, 'hard')
  })
})

describe('exerciseIdentity', () => {
  it('folds ё so лежа and лёжа match', () => {
    assert.equal(exerciseIdentity({ name: 'Жим лёжа' }), exerciseIdentity({ name: 'Жим лежа' }))
    assert.equal(exerciseIdentity({ name: 'жим лёжа' }), exerciseIdentity({ name: 'Жим Лёжа' }))
  })
})

describe('idempotency cache', () => {
  it('returns the same workout id for the same key and hash', () => {
    const hash = payloadHash({ title: 'A' })
    rememberIdempotentWorkout('u1', 'k1', hash, 'w1')
    const hit = lookupIdempotentWorkout('u1', 'k1', hash)
    assert.equal(hit.status, 'hit')
    if (hit.status === 'hit') assert.equal(hit.workoutId, 'w1')
    const conflict = lookupIdempotentWorkout('u1', 'k1', payloadHash({ title: 'B' }))
    assert.equal(conflict.status, 'conflict')
  })
})
