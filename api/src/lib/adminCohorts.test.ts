import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { moscowDayKey, moscowDayStartUtc } from './adminAnalytics.js'
import {
  ahaDeadlineUtc,
  ahaScore,
  cohortBucketKey,
  correlationCaption,
  isDayNObserved,
  matchesAcquisition,
  matchesProductDimension,
  moscowMonthKey,
  moscowWeekStartKey,
  performedInAhaWindow,
  pooledDayN,
  rankAhaCandidates,
  retainedOnDayN,
  MIN_AHA_SAMPLE,
} from './adminCohortsMath.js'

const MSK = (iso: string) => new Date(`${iso}+03:00`)

describe('cohort date boundaries (MSK)', () => {
  it('puts late-UTC Saturday into Sunday MSK week', () => {
    const utcSaturdayNight = new Date('2026-08-29T21:05:00.000Z')
    assert.equal(moscowDayKey(utcSaturdayNight), '2026-08-30')
    assert.equal(moscowWeekStartKey(utcSaturdayNight), '2026-08-24')
    assert.equal(moscowMonthKey(utcSaturdayNight), '2026-08')
  })

  it('week starts Monday MSK, month is YYYY-MM', () => {
    assert.equal(moscowWeekStartKey(MSK('2026-08-24T00:00:00')), '2026-08-24')
    assert.equal(moscowWeekStartKey(MSK('2026-08-30T23:00:00')), '2026-08-24')
    assert.equal(moscowWeekStartKey(MSK('2026-08-31T00:00:00')), '2026-08-31')
    assert.equal(cohortBucketKey(MSK('2026-08-31T10:00:00'), 'month'), '2026-08')
    assert.equal(cohortBucketKey(MSK('2026-08-31T10:00:00'), 'week'), '2026-08-31')
  })

  it('D+N is observed only when the target day is before today', () => {
    const reg = MSK('2026-08-23T12:00:00')
    assert.equal(isDayNObserved(reg, 7, '2026-08-30'), false)
    assert.equal(isDayNObserved(reg, 7, '2026-08-31'), true)
  })
})

describe('exact-day retention', () => {
  it('retains only lastSeen on the exact MSK day D+N', () => {
    const reg = MSK('2026-08-20T10:00:00')
    assert.equal(retainedOnDayN(reg, MSK('2026-08-27T09:00:00'), 7), true)
    assert.equal(retainedOnDayN(reg, MSK('2026-08-26T23:00:00'), 7), false)
    assert.equal(retainedOnDayN(reg, MSK('2026-08-28T00:00:00'), 7), false)
  })

  it('pooled rate ignores users whose D+N is not observed', () => {
    const today = '2026-08-30'
    const cell = pooledDayN(
      [
        { registeredAt: MSK('2026-08-20T10:00:00'), lastSeenAt: MSK('2026-08-27T10:00:00') },
        { registeredAt: MSK('2026-08-20T10:00:00'), lastSeenAt: MSK('2026-08-21T10:00:00') },
        { registeredAt: MSK('2026-08-29T10:00:00'), lastSeenAt: MSK('2026-08-30T10:00:00') },
      ],
      7,
      today,
      1,
    )
    assert.equal(cell.eligible, 2)
    assert.equal(cell.retained, 1)
    assert.equal(cell.rate, 0.5)
  })
})

describe('aha window and users without actions', () => {
  it('counts an action only before D+7, not after', () => {
    const reg = MSK('2026-08-20T10:00:00')
    const deadline = ahaDeadlineUtc(reg, 7)
    assert.equal(deadline.toISOString(), moscowDayStartUtc('2026-08-27').toISOString())
    assert.equal(performedInAhaWindow(reg, Date.parse('2026-08-22T12:00:00+03:00')), true)
    assert.equal(performedInAhaWindow(reg, Date.parse('2026-08-27T00:00:00+03:00')), false)
    assert.equal(performedInAhaWindow(reg, undefined), false)
  })

  it('duplicate events still mean one performed user', () => {
    const reg = MSK('2026-08-20T10:00:00')
    const first = Date.parse('2026-08-21T12:00:00+03:00')
    assert.equal(performedInAhaWindow(reg, first), true)
    assert.equal(performedInAhaWindow(reg, first), true)
  })
})

describe('dimensions', () => {
  it('organic / seo / referral do not require a custom segment builder', () => {
    assert.equal(
      matchesAcquisition(
        { source: '', medium: '', campaign: '', searchEngine: 'yandex', searchPaid: false },
        false,
        'seo',
        null,
      ),
      true,
    )
    assert.equal(
      matchesAcquisition(
        { source: '', medium: '', campaign: '', searchEngine: 'yandex', searchPaid: true },
        false,
        'seo',
        null,
      ),
      false,
    )
    assert.equal(
      matchesAcquisition(
        { source: 'google', medium: 'organic', campaign: '', searchEngine: '', searchPaid: false },
        false,
        'organic',
        null,
      ),
      true,
    )
    assert.equal(matchesAcquisition(undefined, true, 'referral', null), true)
    assert.equal(matchesAcquisition(undefined, false, 'referral', null), false)
    assert.equal(
      matchesAcquisition(
        { source: 'yandex', medium: 'cpc', campaign: 'aug', searchEngine: '', searchPaid: false },
        false,
        'source',
        'yandex',
      ),
      true,
    )
  })

  it('gym selected is not gym skipped', () => {
    assert.equal(
      matchesProductDimension({ gymSelected: false, social: true, workout: false, ai: false }, 'gym_selected'),
      false,
    )
    assert.equal(
      matchesProductDimension({ gymSelected: true, social: false, workout: false, ai: false }, 'gym_selected'),
      true,
    )
  })
})

describe('small samples and ranking', () => {
  it('does not score 1–2 or 3-user 100% as the aha winner', () => {
    const tiny = ahaScore(1, 0, 3, 20)
    assert.equal(tiny.thin, true)
    assert.equal(tiny.score, null)

    const ranked = rankAhaCandidates([
      { action: 'like_sent', usersWith: 3, usersWithout: 20, r7With: 1, r7Without: 0.1 },
      { action: 'workout_saved', usersWith: 40, usersWithout: 40, r7With: 0.3, r7Without: 0.15 },
      { action: 'ai_used', usersWith: 2, usersWithout: 80, r7With: 1, r7Without: 0.1 },
    ])
    assert.equal(ranked[0].action, 'workout_saved')
    assert.equal(ranked[0].thin, false)
    assert.equal(ranked.some((row) => row.action === 'like_sent' && row.thin), true)
    assert.ok((ranked[0].score ?? 0) > 0)
  })

  it('ranks by lift × √min(n), not by percent gap alone', () => {
    const ranked = rankAhaCandidates([
      { action: 'people_viewed', usersWith: 8, usersWithout: 8, r7With: 1, r7Without: 0 },
      { action: 'profile_viewed', usersWith: 80, usersWithout: 80, r7With: 0.25, r7Without: 0.1 },
    ])
    assert.equal(ranked[0].action, 'people_viewed')
    assert.equal(MIN_AHA_SAMPLE, 8)
  })

  it('caption is correlation, never causation', () => {
    const text = correlationCaption('лайк', 0.12)
    assert.match(text, /имеют retention выше/)
    assert.doesNotMatch(text, /увеличивает/)
    assert.doesNotMatch(text, /причин/)
  })
})
