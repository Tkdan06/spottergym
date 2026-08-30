import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { addMoscowDays, moscowDayKey, moscowDayStartUtc } from './adminAnalytics.js'
import {
  assembleGymRows,
  densityBuckets,
  isLowDensity,
  isViewedOther,
  nearestRankPercentile,
  networkCorrelations,
  networkScatter,
  NO_HOME_GYM_ID,
  parseGymSort,
  pearson,
  peopleSurface,
  socialRate,
  sortGymRows,
  uniqueCount,
  type GymFacts,
  type GymRow,
} from './adminGymsMath.js'

const NOW = new Date('2026-08-29T21:05:00.000Z') // 2026-08-30 00:05 MSK
const TODAY = moscowDayKey(NOW)
const FROM = moscowDayStartUtc('2026-08-01')
const TO = NOW

function user(
  id: string,
  homeGymId: string | null,
  registeredKey: string,
  lastSeenKey: string,
) {
  return {
    id,
    homeGymId,
    registeredAt: moscowDayStartUtc(registeredKey),
    lastSeenAt: new Date(moscowDayStartUtc(lastSeenKey).getTime() + 12 * 60 * 60 * 1000),
  }
}

function facts(partial: Partial<GymFacts> = {}): GymFacts {
  return {
    catalog: [
      { id: 'ddx', name: 'DDX Ясенево', network: 'DDX', city: 'Москва' },
      { id: 'empty', name: 'Пустой клуб', network: 'X', city: 'Москва' },
    ],
    users: [],
    memberships: [],
    likes: [],
    conversations: [],
    messages: [],
    workouts: [],
    checkIns: [],
    ...partial,
  }
}

function assemble(partial: Partial<GymFacts> = {}, sort: 'activeUsers' | 'retention' | 'social' | 'growth' = 'activeUsers') {
  return assembleGymRows(facts(partial), { from: FROM, to: TO, toKey: TODAY }, TODAY, sort)
}

function row(rows: GymRow[], id: string) {
  const found = rows.find((item) => item.id === id)
  assert.ok(found, `missing gym row ${id}`)
  return found
}

describe('gym sort and density helpers', () => {
  it('defaults unknown sort to active users', () => {
    assert.equal(parseGymSort(undefined), 'activeUsers')
    assert.equal(parseGymSort('nope'), 'activeUsers')
    assert.equal(parseGymSort('growth'), 'growth')
  })

  it('shows the observed distribution, not a product SLA', () => {
    const buckets = densityBuckets([0, 0, 1, 2, 8, 30])
    assert.deepEqual(
      buckets.map((b) => b.gyms),
      [2, 1, 1, 1, 0, 1],
    )
    assert.equal(isLowDensity(0, 0), false)
    assert.equal(isLowDensity(3, 1), true)
    assert.equal(isLowDensity(3, 2), false)
  })

  it('does not invent a people-list gymId from placement', () => {
    assert.equal(peopleSurface('{"surface":"gym"}'), 'gym')
    assert.equal(peopleSurface('{"surface":"home"}'), 'home')
    assert.equal(peopleSurface('{"surface":"gym","gymId":"ddx"}'), 'gym')
    assert.equal(peopleSurface(''), null)
  })

  it('treats a check-in away from home as viewed other', () => {
    assert.equal(isViewedOther('ddx', 'encore'), true)
    assert.equal(isViewedOther(null, 'ddx'), true)
    assert.equal(isViewedOther('ddx', 'ddx'), false)
  })
})

describe('required gym edge cases', () => {
  it('keeps users without a gym in their own row', () => {
    const out = assemble({
      users: [user('u1', null, '2026-08-10', '2026-08-30')],
    })
    assert.equal(out.noHomeUsers, 1)
    assert.equal(row(out.gyms, NO_HOME_GYM_ID).totalUsers, 1)
    assert.equal(row(out.gyms, 'ddx').totalUsers, 0)
    assert.equal(row(out.gyms, 'empty').empty, true)
  })

  it('lists catalog gyms with zero users', () => {
    const out = assemble()
    assert.equal(row(out.gyms, 'empty').totalUsers, 0)
    assert.equal(row(out.gyms, 'empty').empty, true)
    assert.equal(row(out.gyms, 'empty').lowDensity, false)
  })

  it('splits current home gym from a viewed other gym', () => {
    const out = assemble({
      users: [user('u1', 'ddx', '2026-08-10', '2026-08-30')],
      checkIns: [
        { userId: 'u1', gymId: 'ddx' },
        { userId: 'u1', gymId: 'empty' },
        { userId: 'u1', gymId: 'empty' },
      ],
    })
    const home = row(out.gyms, 'ddx')
    const other = row(out.gyms, 'empty')
    assert.equal(home.totalUsers, 1)
    assert.equal(home.viewedUsers, 1)
    assert.equal(home.viewedOtherUsers, 0)
    assert.equal(home.checkIns, 1)
    assert.equal(other.totalUsers, 0)
    assert.equal(other.viewedUsers, 1)
    assert.equal(other.viewedOtherUsers, 1)
    assert.equal(other.checkIns, 2)
    assert.equal(out.viewedUsers, 1)
    assert.equal(out.viewedOtherUsers, 1)
  })

  it('keeps users whose home gym is missing from the catalog', () => {
    const out = assemble({
      users: [user('u1', 'gone-club', '2026-08-10', '2026-08-30')],
    })
    assert.equal(out.missingCatalogUsers, 1)
    const gone = row(out.gyms, 'gone-club')
    assert.equal(gone.catalog, false)
    assert.equal(gone.name, 'Нет в каталоге')
    assert.equal(gone.totalUsers, 1)
  })

  it('dedupes social actors and viewed users, keeps action counts', () => {
    const out = assemble({
      users: [user('u1', 'ddx', '2026-08-10', '2026-08-30')],
      likes: [{ fromUserId: 'u1' }, { fromUserId: 'u1' }],
      conversations: [{ id: 'c1', initiatedById: 'u1' }],
      messages: [{ senderId: 'u1' }, { senderId: 'u1' }, { senderId: 'u1' }],
      workouts: [{ userId: 'u1' }, { userId: 'u1' }],
      checkIns: [
        { userId: 'u1', gymId: 'ddx' },
        { userId: 'u1', gymId: 'ddx' },
      ],
    })
    const ddx = row(out.gyms, 'ddx')
    assert.equal(ddx.socialActors, 1)
    assert.equal(ddx.socialActions, 2 + 1 + 3)
    assert.equal(ddx.chats, 1)
    assert.equal(ddx.workouts, 2)
    assert.equal(ddx.checkIns, 2)
    assert.equal(ddx.viewedUsers, 1)
    assert.equal(uniqueCount(['u1', 'u1', 'u2']), 2)
  })
})

describe('ranking and network signal', () => {
  it('sorts by active users, retention, social, growth', () => {
    const thin = {
      day: 7,
      eligible: 2,
      retained: 2,
      rate: 1,
      thin: true,
    }
    const fat = {
      day: 7,
      eligible: 20,
      retained: 4,
      rate: 0.2,
      thin: false,
    }
    const a = {
      id: 'a',
      name: 'A',
      network: '',
      city: '',
      catalog: true,
      totalUsers: 4,
      members: 4,
      activeUsers: 3,
      activeToday: 1,
      wau: 2,
      mau: 3,
      r7: fat,
      r30: fat,
      socialActors: 1,
      socialActions: 1,
      socialRate: 1 / 3,
      chats: 0,
      workouts: 0,
      checkIns: 0,
      viewedUsers: 0,
      viewedOtherUsers: 0,
      growth: 5,
      lowDensity: false,
      empty: false,
    } satisfies GymRow
    const b = {
      ...a,
      id: 'b',
      name: 'B',
      activeUsers: 1,
      r7: thin,
      socialActors: 8,
      socialActions: 8,
      growth: 1,
    }
    assert.equal(sortGymRows([a, b], 'activeUsers')[0].id, 'a')
    assert.equal(sortGymRows([a, b], 'retention')[0].id, 'b')
    assert.equal(sortGymRows([a, b], 'social')[0].id, 'b')
    assert.equal(sortGymRows([a, b], 'growth')[0].id, 'a')
  })

  it('reports correlation without claiming cause', () => {
    assert.equal(socialRate(2, 0), null)
    assert.equal(socialRate(2, 4), 0.5)
    const perfect = pearson([1, 2, 3, 4], [2, 4, 6, 8])
    assert.ok(perfect.r != null && perfect.r > 0.99)
    assert.equal(perfect.thin, true)
    const none = pearson([1], [1])
    assert.equal(none.r, null)
    const points = networkScatter([
      {
        id: 'ddx',
        name: 'DDX',
        network: 'DDX',
        city: 'Москва',
        catalog: true,
        totalUsers: 10,
        members: 10,
        activeUsers: 8,
        activeToday: 2,
        wau: 6,
        mau: 8,
        r7: { day: 7, eligible: 10, retained: 4, rate: 0.4, thin: false },
        r30: { day: 7, eligible: 10, retained: 2, rate: 0.2, thin: false },
        socialActors: 4,
        socialActions: 12,
        socialRate: 0.5,
        chats: 2,
        workouts: 3,
        checkIns: 5,
        viewedUsers: 5,
        viewedOtherUsers: 1,
        growth: 2,
        lowDensity: false,
        empty: false,
      },
    ])
    const corr = networkCorrelations(points)
    assert.equal(corr.activeVsSocial.n, 1)
    assert.equal(corr.activeVsSocial.thin, true)
  })

  it('attributes likes to the actor home gym, not the viewed club', () => {
    const out = assemble({
      users: [user('u1', 'ddx', '2026-08-10', '2026-08-30')],
      likes: [{ fromUserId: 'u1' }],
      checkIns: [{ userId: 'u1', gymId: 'empty' }],
    })
    assert.equal(row(out.gyms, 'ddx').socialActors, 1)
    assert.equal(row(out.gyms, 'empty').socialActors, 0)
    assert.equal(row(out.gyms, 'empty').viewedOtherUsers, 1)
  })

  it('uses nearest-rank percentiles of the observed catalog', () => {
    assert.equal(nearestRankPercentile([], 50), null)
    assert.equal(nearestRankPercentile([0, 1, 2, 10], 50), 1)
    assert.equal(nearestRankPercentile([0, 1, 2, 10], 90), 10)
  })
})

describe('retention window still exact-day MSK', () => {
  it('R7 is D+7 lastSeen, not a 7-day window', () => {
    const registered = addMoscowDays(TODAY, -8)
    const onTarget = addMoscowDays(registered, 7)
    const out = assemble({
      users: [user('u1', 'ddx', registered, onTarget)],
    })
    const ddx = row(out.gyms, 'ddx')
    assert.equal(ddx.r7.eligible, 1)
    assert.equal(ddx.r7.retained, 1)
  })
})
