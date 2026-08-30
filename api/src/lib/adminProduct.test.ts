import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { moscowDayKey } from './adminAnalytics.js'
import {
  activityDurationSeconds,
  aiSuccessRate,
  closeSequentialFunnel,
  durationBucket,
  firstAtByUser,
  hasGymContext,
  isRepeatWorkout,
  matchesGymFilter,
  matchesReferralFilter,
  matchesSourceFilter,
  median,
  progressReturnedUsers,
  sliceFunnel,
  workoutBelongsToTraining,
  type FunnelStepSource,
} from './adminProductMath.js'

function step(
  id: string,
  rows: { userId: string; at: number }[],
  events: number,
): FunnelStepSource {
  return {
    id,
    label: id,
    firstAt: firstAtByUser(rows),
    events,
    definition: {
      numerator: 'users',
      denominator: 'previous users',
      event: id,
      window: 'period',
    },
  }
}

describe('product funnel: zero / duplicates / missing / order', () => {
  it('zero data stays empty without a worst step', () => {
    const funnel = closeSequentialFunnel([
      step('people', [], 0),
      step('profile', [], 0),
      step('like', [], 0),
    ])
    assert.deepEqual(
      funnel.map((s) => s.users),
      [0, 0, 0],
    )
    assert.equal(
      funnel.every((s) => s.events === 0),
      true,
    )
    assert.equal(
      funnel.some((s) => s.worst),
      false,
    )
    assert.equal(funnel[0].conversion, null)
  })

  it('deduplicates users but keeps event volume', () => {
    const t = Date.parse('2026-08-20T10:00:00.000Z')
    const funnel = closeSequentialFunnel([
      step(
        'people',
        [
          { userId: 'u1', at: t },
          { userId: 'u1', at: t + 1000 },
          { userId: 'u1', at: t + 2000 },
        ],
        3,
      ),
    ])
    assert.equal(funnel[0].users, 1)
    assert.equal(funnel[0].events, 3)
  })

  it('drops users when a later event is missing', () => {
    const t = Date.parse('2026-08-20T10:00:00.000Z')
    const funnel = closeSequentialFunnel([
      step(
        'people',
        [
          { userId: 'a', at: t },
          { userId: 'b', at: t },
        ],
        2,
      ),
      step('profile', [{ userId: 'a', at: t + 60_000 }], 1),
      step('like', [], 0),
    ])
    assert.deepEqual(
      funnel.map((s) => s.users),
      [2, 1, 0],
    )
    assert.equal(funnel[2].dropOff, 1)
    assert.equal(funnel[2].worst, true)
    assert.equal(funnel.filter((s) => s.worst).length, 1)
  })

  it('ignores out-of-order later steps in the closed funnel', () => {
    const t = Date.parse('2026-08-20T10:00:00.000Z')
    const funnel = closeSequentialFunnel([
      step('people', [{ userId: 'a', at: t + 10_000 }], 1),
      step('profile', [{ userId: 'a', at: t }], 1),
    ])
    assert.equal(funnel[0].users, 1)
    assert.equal(funnel[1].users, 0)
  })

  it('computes median time between sequential steps', () => {
    const t = Date.parse('2026-08-20T10:00:00.000Z')
    const funnel = closeSequentialFunnel([
      step(
        'opened',
        [
          { userId: 'a', at: t },
          { userId: 'b', at: t },
        ],
        2,
      ),
      step(
        'saved',
        [
          { userId: 'a', at: t + 120_000 },
          { userId: 'b', at: t + 360_000 },
        ],
        2,
      ),
    ])
    assert.equal(funnel[1].medianSecondsFromPrev, 240)
  })
})

describe('timezone', () => {
  it('MSK day crosses UTC midnight', () => {
    assert.equal(moscowDayKey(new Date('2026-08-29T21:00:00.000Z')), '2026-08-30')
    assert.equal(moscowDayKey(new Date('2026-08-29T20:59:59.000Z')), '2026-08-29')
  })
})

describe('users without gym / check-in; workouts without activity', () => {
  it('gym context accepts skip and membership, not only home gym', () => {
    assert.equal(hasGymContext({ homeGymId: null, gymSkipped: true }), true)
    assert.equal(hasGymContext({ homeGymId: null, memberGyms: 1 }), true)
    assert.equal(hasGymContext({ homeGymId: null }), false)
  })

  it('gym filter includes users without a gym when no gym is selected', () => {
    assert.equal(matchesGymFilter({ homeGymId: null, memberGymIds: [] }, null), true)
    assert.equal(matchesGymFilter({ homeGymId: null, memberGymIds: [] }, 'ddx-1'), false)
    assert.equal(matchesGymFilter({ homeGymId: null, memberGymIds: ['ddx-1'] }, 'ddx-1'), true)
  })

  it('training counts a workout even when the user never checked in', () => {
    assert.equal(
      workoutBelongsToTraining({ performedAt: new Date('2026-08-20T10:00:00.000Z') }, []),
      true,
    )
  })

  it('repeat starts at the second session, independent of check-ins', () => {
    const days = [
      new Date('2026-08-01T10:00:00.000Z'),
      new Date('2026-08-08T10:00:00.000Z'),
    ]
    assert.equal(isRepeatWorkout(days, 0), false)
    assert.equal(isRepeatWorkout(days, 1), true)
  })
})

describe('referral / source filters', () => {
  it('referral yes/no/all', () => {
    assert.equal(matchesReferralFilter(true, 'all'), true)
    assert.equal(matchesReferralFilter(false, 'yes'), false)
    assert.equal(matchesReferralFilter(true, 'yes'), true)
    assert.equal(matchesReferralFilter(false, 'no'), true)
  })

  it('direct is empty UTM; named source must match', () => {
    assert.equal(matchesSourceFilter([], 'direct'), true)
    assert.equal(matchesSourceFilter(['yandex'], 'direct'), false)
    assert.equal(matchesSourceFilter(['yandex'], 'yandex'), true)
    assert.equal(matchesSourceFilter(['yandex'], null), true)
  })
})

describe('activity duration and progress return', () => {
  const now = new Date('2026-08-20T15:00:00.000Z')

  it('uses checkout, then expiry, and caps at 8h', () => {
    assert.equal(
      activityDurationSeconds({
        checkedInAt: new Date('2026-08-20T14:00:00.000Z'),
        checkedOutAt: new Date('2026-08-20T14:40:00.000Z'),
        expiresAt: null,
        now,
      }),
      40 * 60,
    )
    assert.equal(
      durationBucket(
        activityDurationSeconds({
          checkedInAt: new Date('2026-08-20T14:00:00.000Z'),
          checkedOutAt: new Date('2026-08-20T14:40:00.000Z'),
          expiresAt: null,
          now,
        }),
      ),
      '30–60м',
    )
  })

  it('return to progress is 2+ opens, not a single session fire', () => {
    assert.equal(
      progressReturnedUsers(
        new Map([
          ['a', 1],
          ['b', 3],
        ]),
      ),
      1,
    )
  })
})

describe('AI failures are not value', () => {
  it('success rate is generated / requested and stays null on zero requests', () => {
    assert.equal(aiSuccessRate(6, 10), 0.6)
    assert.equal(aiSuccessRate(0, 0), null)
    assert.equal(aiSuccessRate(4, 4), 1)
  })

  it('failed analyses do not count as generated', () => {
    const requested = 10
    const generated = 7
    const failed = 3
    assert.equal(generated + failed, requested)
    assert.equal(aiSuccessRate(generated, requested), 0.7)
    assert.notEqual(generated, requested)
  })
})

describe('sliceFunnel', () => {
  it('keeps later user counts so chats match social', () => {
    const t = Date.parse('2026-08-20T10:00:00.000Z')
    const full = closeSequentialFunnel([
      step('like', [{ userId: 'a', at: t }, { userId: 'b', at: t }], 2),
      step('request', [{ userId: 'a', at: t + 1 }], 1),
      step('accept', [{ userId: 'a', at: t + 2 }], 1),
    ])
    const chats = sliceFunnel(full, ['request', 'accept'])
    assert.equal(chats[0].users, full[1].users)
    assert.equal(chats[1].users, full[2].users)
    assert.equal(chats[0].conversion, 1)
  })
})

describe('median helper', () => {
  it('handles empty and even lists', () => {
    assert.equal(median([]), null)
    assert.equal(median([3, 1, 2]), 2)
    assert.equal(median([1, 3]), 2)
  })
})
