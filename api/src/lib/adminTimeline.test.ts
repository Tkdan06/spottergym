import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  canReadTimeline,
  classifyTimestamp,
  collapseNearby,
  domainOf,
  encodeCursor,
  eventSource,
  findDuplicateGroups,
  isSecretKey,
  paginateMergedRows,
  parseCursor,
  parsePageLimit,
  parseSearchQuery,
  productLabel,
  sanitizeMetadata,
  toTimelineEntry,
  TIMELINE_PAGE_MAX,
  TIMELINE_SEARCH_FIELDS,
  type RawTimelineRow,
  type TimelineEntry,
} from './adminTimelineMath.js'

const AT = new Date('2026-08-20T10:00:00.000Z')

function row(partial: Partial<RawTimelineRow> = {}): RawTimelineRow {
  return {
    id: 'event:1',
    at: AT,
    name: 'like_sent',
    placement: '',
    path: '/app',
    utmSource: '',
    userId: 'u1',
    kind: 'event',
    ...partial,
  }
}

describe('permissions', () => {
  it('requires viewUsers; extra admin flags do not grant access', () => {
    assert.equal(canReadTimeline({ isAdmin: false, adminPermissions: { viewUsers: true } }), false)
    assert.equal(canReadTimeline({ isAdmin: true, adminPermissions: { viewUsers: false } }), false)
    assert.equal(canReadTimeline({ isAdmin: true, adminPermissions: { viewUsers: true } }), true)
  })
})

describe('user search identifiers', () => {
  it('allows only id, username, name, email — not IP or secrets', () => {
    assert.deepEqual([...TIMELINE_SEARCH_FIELDS], ['id', 'username', 'name', 'email'])
    assert.equal(parseSearchQuery('').error, 'Укажи id, username, имя или email')
    assert.equal(parseSearchQuery('   ').error, 'Укажи id, username, имя или email')
    assert.equal(parseSearchQuery('masha').q, 'masha')
    assert.ok(!TIMELINE_SEARCH_FIELDS.includes('signupIp' as never))
    assert.ok(!TIMELINE_SEARCH_FIELDS.includes('passwordHash' as never))
  })
})

describe('product timeline mapping', () => {
  it('uses product labels and domains, not a raw dump', () => {
    assert.equal(productLabel('people_list_viewed'), 'Смотрел людей')
    assert.equal(domainOf('gym_selected'), 'gym')
    assert.equal(domainOf('like_sent'), 'like')
    assert.equal(domainOf('check_in'), 'activity')
    assert.equal(toTimelineEntry(row({ name: 'workout_saved' })).event, 'Сохранил тренировку')
    assert.equal(toTimelineEntry(row({ name: 'check_in', kind: 'fact', placement: 'ddx' })).metadata.gymId, 'ddx')
  })

  it('collapses a fact+event pair for the same step', () => {
    const a: TimelineEntry = {
      ...toTimelineEntry(row({ id: 'event:1', name: 'like_sent', kind: 'event' })),
    }
    const b: TimelineEntry = {
      ...toTimelineEntry(
        row({ id: 'fact:like:2', name: 'like_sent', kind: 'fact', at: new Date(AT.getTime() + 400) }),
      ),
    }
    const collapsed = collapseNearby([a, b])
    assert.equal(collapsed.length, 1)
    assert.equal(collapsed[0].kind, 'event')
  })
})

describe('event details never include secrets', () => {
  it('strips tokens, passwords, GigaChat, chat text, IP, weights', () => {
    assert.equal(isSecretKey('passwordHash'), true)
    assert.equal(isSecretKey('gigaChat'), true)
    assert.equal(isSecretKey('apiKey'), true)
    assert.equal(isSecretKey('text'), true)
    assert.equal(isSecretKey('surface'), false)
    const meta = sanitizeMetadata({
      surface: 'gym',
      password: 'secret',
      token: 'abc',
      apiKey: 'k',
      gigaChat: 'tok',
      text: 'привет',
      ip: '1.1.1.1',
      weight: '80',
      path: '/app',
    })
    assert.deepEqual(meta, { surface: 'gym', path: '/app' })
    const entry = toTimelineEntry(
      row({
        placement: JSON.stringify({
          surface: 'home',
          token: 'leak',
          source: 'onboarding',
        }),
      }),
    )
    assert.equal(entry.metadata.surface, 'home')
    assert.equal(entry.metadata.source, 'onboarding')
    assert.equal(entry.metadata.token, undefined)
  })
})

describe('source and pagination', () => {
  it('reads source from allowlisted meta, else UTM, else direct; facts stay fact', () => {
    assert.equal(eventSource('', '{"source":"onboarding"}', 'event'), 'onboarding')
    assert.equal(eventSource('instagram', '', 'event'), 'instagram')
    assert.equal(eventSource('', '', 'event'), 'direct')
    assert.equal(eventSource('instagram', '', 'fact'), 'fact')
  })

  it('pages server-side and does not return the whole history', () => {
    const many = Array.from({ length: 500 }, (_, i) =>
      row({
        id: `event:${String(i).padStart(4, '0')}`,
        at: new Date(AT.getTime() - i * 1000),
      }),
    )
    const first = paginateMergedRows([many], null, 40)
    assert.equal(first.rows.length, 40)
    assert.equal(first.hasMore, true)
    assert.equal(first.rows[0].id, 'event:0000')
    const cursor = parseCursor(encodeCursor(first.rows[39].at, first.rows[39].id))
    const second = paginateMergedRows([many], cursor, 40)
    assert.equal(second.rows.length, 40)
    assert.ok(second.rows[0].id !== first.rows[0].id)
    assert.ok(many.length > TIMELINE_PAGE_MAX)
  })

  it('clamps page size', () => {
    assert.equal(parsePageLimit('0'), 1)
    assert.equal(parsePageLimit('999'), TIMELINE_PAGE_MAX)
    assert.equal(parsePageLimit(undefined), 40)
  })
})

describe('debugger classifiers', () => {
  it('flags missing userId, duplicates, bad timestamps, dangling refs via helpers', () => {
    const now = new Date('2026-08-30T12:00:00.000Z')
    assert.equal(classifyTimestamp(now, now), 'ok')
    assert.equal(classifyTimestamp(new Date('2010-01-01T00:00:00.000Z'), now), 'too_old')
    assert.equal(classifyTimestamp(new Date(now.getTime() + 3 * 60 * 60 * 1000), now), 'future')
    const dups = findDuplicateGroups([
      { userId: 'u1', name: 'like_sent', at: AT },
      { userId: 'u1', name: 'like_sent', at: new Date(AT.getTime() + 200) },
      { userId: 'u1', name: 'people_list_viewed', at: AT },
    ])
    assert.equal(dups.length, 1)
    assert.equal(dups[0].count, 2)
    assert.equal(dups[0].name, 'like_sent')
  })
})
