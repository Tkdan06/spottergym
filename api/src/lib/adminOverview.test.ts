import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  addMoscowDays,
  moscowDayKey,
  moscowDayStartUtc,
} from './adminAnalytics.js'
import {
  averageCohortRates,
  buildFunnelSteps,
  clampFunnelCounts,
  formatOverviewCount,
  isMoscowDayKey,
  parseOverviewRange,
  sqlSafeInt,
} from './adminOverview.js'

describe('parseOverviewRange', () => {
  const now = new Date('2026-08-29T21:05:00.000Z') // 2026-08-30 00:05 MSK
  const todayKey = moscowDayKey(now)

  it('uses Europe/Moscow calendar days, not UTC', () => {
    assert.equal(todayKey, '2026-08-30')
    assert.equal(moscowDayKey(new Date('2026-08-29T20:59:59.000Z')), '2026-08-29')
  })

  it('defaults to 7d ending today MSK', () => {
    const range = parseOverviewRange({}, now)
    assert.ok(!('error' in range))
    if ('error' in range) return
    assert.equal(range.preset, '7d')
    assert.equal(range.toKey, '2026-08-30')
    assert.equal(range.fromKey, '2026-08-24')
    assert.equal(range.from.toISOString(), moscowDayStartUtc('2026-08-24').toISOString())
    assert.ok(range.to.getTime() <= now.getTime())
  })

  it('today is a single MSK day', () => {
    const range = parseOverviewRange({ preset: 'today' }, now)
    assert.ok(!('error' in range))
    if ('error' in range) return
    assert.equal(range.fromKey, '2026-08-30')
    assert.equal(range.toKey, '2026-08-30')
    assert.equal(range.from.toISOString(), '2026-08-29T21:00:00.000Z')
  })

  it('30d / 90d / 12m stay inside the selected window', () => {
    const d30 = parseOverviewRange({ preset: '30d' }, now)
    const d90 = parseOverviewRange({ preset: '90d' }, now)
    const y = parseOverviewRange({ preset: '12m' }, now)
    assert.ok(!('error' in d30) && !('error' in d90) && !('error' in y))
    if ('error' in d30 || 'error' in d90 || 'error' in y) return
    assert.equal(d30.fromKey, addMoscowDays(todayKey, -29))
    assert.equal(d90.fromKey, addMoscowDays(todayKey, -89))
    assert.equal(y.fromKey, addMoscowDays(todayKey, -364))
  })

  it('custom inclusive MSK dates and clamps a future end to today', () => {
    const range = parseOverviewRange(
      { preset: 'custom', from: '2026-08-01', to: '2026-09-01' },
      now,
    )
    assert.ok(!('error' in range))
    if ('error' in range) return
    assert.equal(range.fromKey, '2026-08-01')
    assert.equal(range.toKey, '2026-08-30')
  })

  it('rejects unknown preset, missing custom dates, inverted and future starts', () => {
    assert.equal(parseOverviewRange({ preset: 'week' }, now).error, 'Неизвестный период')
    assert.equal(
      parseOverviewRange({ preset: 'custom' }, now).error,
      'Укажи даты «с» и «по»',
    )
    assert.equal(
      parseOverviewRange({ preset: 'custom', from: '2026-08-20', to: '2026-08-10' }, now)
        .error,
      'Дата «с» позже даты «по»',
    )
    assert.equal(
      parseOverviewRange({ preset: 'custom', from: '2026-09-01', to: '2026-09-02' }, now)
        .error,
      'Период не может начинаться в будущем',
    )
    assert.equal(
      parseOverviewRange({ preset: 'custom', from: '2024-01-01', to: '2026-08-30' }, now)
        .error,
      'Период не длиннее 12 месяцев',
    )
    assert.equal(isMoscowDayKey('2026-02-30'), false)
    assert.equal(
      parseOverviewRange({ preset: 'custom', from: '2026-02-30', to: '2026-03-01' }, now)
        .error,
      'Даты должны быть в формате ГГГГ-ММ-ДД',
    )
  })
})

describe('funnel drop-off', () => {
  it('keeps steps nested and highlights the largest drop-off', () => {
    const steps = buildFunnelSteps({
      registered: 100,
      entered: 80,
      meaningful: 20,
      returned: 16,
    })
    assert.equal(steps[0].users, 100)
    assert.equal(steps[1].dropOff, 20)
    assert.equal(steps[2].dropOff, 60)
    assert.equal(steps[3].dropOff, 4)
    assert.equal(steps[2].worst, true)
    assert.equal(steps.filter((s) => s.worst).length, 1)
    assert.equal(steps[2].conversion, 0.25)
    assert.equal(steps[2].dropOffRate, 0.75)
  })

  it('empty and zero funnels have no highlight and null rates', () => {
    const empty = buildFunnelSteps({
      registered: 0,
      entered: 0,
      meaningful: 0,
      returned: 0,
    })
    assert.deepEqual(
      empty.map((s) => s.users),
      [0, 0, 0, 0],
    )
    assert.equal(empty.some((s) => s.worst), false)
    assert.equal(empty[0].conversion, null)
    assert.equal(empty[1].conversion, null)
  })

  it('clamps inverted SQL counts so the funnel stays monotonic', () => {
    const clamped = clampFunnelCounts({
      registered: 10,
      entered: 40,
      meaningful: 25,
      returned: 80,
    })
    assert.deepEqual(clamped, {
      registered: 10,
      entered: 10,
      meaningful: 10,
      returned: 10,
    })
  })

  it('does not treat gym selection as an activation step', () => {
    const labels = buildFunnelSteps({
      registered: 5,
      entered: 4,
      meaningful: 3,
      returned: 1,
    }).map((s) => s.id)
    assert.deepEqual(labels, ['registered', 'entered', 'meaningful', 'returned'])
    assert.ok(!labels.includes('gym' as never))
  })
})

describe('retention averaging', () => {
  it('keeps exact-day unweighted cohort mean and handles no data', () => {
    const empty = averageCohortRates(7, [])
    assert.equal(empty.rate, null)
    assert.equal(empty.cohorts, 0)

    const point = averageCohortRates(7, [
      { total: 10, retained: 2 },
      { total: 2, retained: 2 },
    ])
    assert.equal(point.cohorts, 2)
    assert.equal(point.cohortUsers, 12)
    assert.equal(point.retained, 4)
    assert.equal(point.rate, (0.2 + 1) / 2)
  })
})

describe('sqlSafeInt', () => {
  it('inlines trusted day offsets so Postgres gets int, not Prisma INT8', () => {
    const sql = sqlSafeInt(7)
    assert.deepEqual(sql.strings, ['7'])
    assert.deepEqual(sql.values, [])
    assert.throws(() => sqlSafeInt(7.5))
    assert.throws(() => sqlSafeInt(-1))
  })
})

describe('display values', () => {
  it('formats zero and large counts for the dashboard', () => {
    assert.equal(formatOverviewCount(0), '0')
    assert.equal(formatOverviewCount(1_234_567), '1\u00a0234\u00a0567')
  })
})
