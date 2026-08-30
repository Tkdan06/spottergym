import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import { type OverviewRange } from './adminOverview.js'
import {
  canReadTimeline,
  collapseNearby,
  DEBUG_SAMPLE,
  EVENT_CATALOG,
  eventSource,
  findDuplicateGroups,
  isBeforeCursor,
  matchesDomainAndEvent,
  matchesSource,
  MIN_VALID_EVENT,
  nextCursorOf,
  paginateMergedRows,
  parseCursor,
  parseEventKey,
  parsePageLimit,
  parseSearchQuery,
  parseSourceKey,
  parseTimelineDomain,
  SEARCH_LIMIT,
  toTimelineEntry,
  type RawTimelineRow,
  type TimelineCursor,
  type TimelineDomain,
  type TimelineEntry,
} from './adminTimelineMath.js'

export type TimelineSearchHit = {
  id: string
  name: string
  username: string
  email: string
  registeredAt: string
  deleted: boolean
}

export type TimelineSubject = TimelineSearchHit & {
  homeGymId: string | null
}

export type AdminTimelinePayload = {
  timezone: 'Europe/Moscow'
  generatedAt: string
  range: {
    preset: OverviewRange['preset']
    from: string
    to: string
    fromKey: string
    toKey: string
  }
  user: TimelineSubject
  entries: TimelineEntry[]
  hasMore: boolean
  nextCursor: string | null
  options: {
    domains: { id: TimelineDomain; label: string }[]
    events: { key: string; domain: string; label: string }[]
    sources: string[]
  }
  notes: {
    productTimeline: true
    noSecrets: true
    chatTextExcluded: true
    workoutPayloadExcluded: true
    paginated: true
  }
}

export type AdminTimelineError = { error: string; status: 400 | 404 }

export type DebugSample = {
  id: string
  name: string
  at: string
  userId: string | null
}

export type AdminEventDebugPayload = {
  timezone: 'Europe/Moscow'
  generatedAt: string
  range: {
    preset: OverviewRange['preset']
    from: string
    to: string
    fromKey: string
    toKey: string
  }
  eventCount: number
  uniqueUsers: number
  missingUserId: number
  duplicates: {
    groups: number
    sample: { name: string; userId: string | null; at: string; count: number }[]
  }
  invalidTimestamp: { count: number; sample: DebugSample[] }
  invalidReferences: { count: number; sample: DebugSample[] }
  byName: { name: string; events: number; uniqueUsers: number; missingUserId: number }[]
  notes: {
    landingEventOnly: true
    noSecrets: true
    noRawPayloads: true
  }
}

const DOMAIN_LABEL: Record<TimelineDomain, string> = {
  registration: 'Registration',
  gym: 'Gym',
  people: 'People',
  profile: 'Profile',
  like: 'Like',
  request: 'Request',
  chat: 'Chat',
  workout: 'Workout',
  activity: 'Activity',
  progress: 'Progress',
  ai: 'AI',
  landing: 'Landing',
}

function timeWindow(from: Date, to: Date, cursor: TimelineCursor | null) {
  return { gte: from, lt: to, ...(cursor ? { lte: cursor.at } : {}) }
}

function takeSlack(limit: number) {
  return limit + 1
}

export async function searchTimelineUsers(rawQ: string | undefined): Promise<
  { users: TimelineSearchHit[] } | { error: string }
> {
  const parsed = parseSearchQuery(rawQ)
  if ('error' in parsed) return parsed
  const { q } = parsed
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { id: q },
        { username: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      registeredAt: true,
      deletedAt: true,
    },
    orderBy: { registeredAt: 'desc' },
    take: SEARCH_LIMIT,
  })
  return {
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      registeredAt: user.registeredAt.toISOString(),
      deleted: Boolean(user.deletedAt),
    })),
  }
}

async function loadSubject(userId: string): Promise<TimelineSubject | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      registeredAt: true,
      deletedAt: true,
      homeGymId: true,
    },
  })
  if (!user) return null
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    registeredAt: user.registeredAt.toISOString(),
    deleted: Boolean(user.deletedAt),
    homeGymId: user.homeGymId,
  }
}

function asEventRows(
  rows: {
    id: string
    createdAt: Date
    name: string
    placement: string
    path: string
    utmSource: string
    userId: string | null
  }[],
): RawTimelineRow[] {
  return rows.map((row) => ({
    id: `event:${row.id}`,
    at: row.createdAt,
    name: row.name,
    placement: row.placement,
    path: row.path,
    utmSource: row.utmSource,
    userId: row.userId,
    kind: 'event',
  }))
}

function fact(
  prefix: string,
  id: string,
  at: Date,
  name: string,
  userId: string,
  placement = '',
): RawTimelineRow {
  return {
    id: `${prefix}${id}`,
    at,
    name,
    placement,
    path: '',
    utmSource: '',
    userId,
    kind: 'fact',
  }
}

export async function buildAdminTimeline(
  userId: string,
  range: OverviewRange,
  query: {
    domain?: string
    event?: string
    source?: string
    cursor?: string
    limit?: string
  },
  now = new Date(),
): Promise<AdminTimelinePayload | AdminTimelineError> {
  const id = (userId || '').trim().slice(0, 64)
  if (!id) return { error: 'Укажи пользователя', status: 400 }
  const subject = await loadSubject(id)
  if (!subject) return { error: 'Пользователь не найден', status: 404 }

  const domain = parseTimelineDomain(query.domain)
  const eventKey = parseEventKey(query.event)
  const source = parseSourceKey(query.source)
  const cursor = parseCursor(query.cursor)
  const limit = parsePageLimit(query.limit)
  const { from, to } = range
  const slack = takeSlack(limit)
  const want = (name: string) => matchesDomainAndEvent(name, domain, eventKey)
  const created = timeWindow(from, to, cursor)

  const [events, likes, requests, firstChats, workouts, checkIns, insights, registration] = await Promise.all([
    prisma.landingEvent.findMany({
      where: {
        userId: id,
        createdAt: created,
        ...(eventKey ? { name: eventKey } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: slack,
      select: {
        id: true,
        createdAt: true,
        name: true,
        placement: true,
        path: true,
        utmSource: true,
        userId: true,
      },
    }),
    want('like_sent')
      ? prisma.like.findMany({
          where: { fromUserId: id, createdAt: created },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: slack,
          select: { id: true, createdAt: true },
        })
      : Promise.resolve([]),
    want('chat_request_sent')
      ? prisma.conversation.findMany({
          where: { initiatedById: id, createdAt: created },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: slack,
          select: { id: true, createdAt: true },
        })
      : Promise.resolve([]),
    want('first_message_sent')
      ? prisma.$queryRaw<{ id: string; createdAt: Date }[]>`
          SELECT m.id, m."createdAt"
          FROM "ChatMessage" m
          WHERE m."senderId" = ${id}
            AND m."createdAt" >= ${from}
            AND m."createdAt" < ${to}
            AND (${cursor?.at ?? null}::timestamptz IS NULL OR m."createdAt" <= ${cursor?.at ?? from})
            AND NOT EXISTS (
              SELECT 1 FROM "ChatMessage" earlier
              WHERE earlier."conversationId" = m."conversationId"
                AND earlier."createdAt" < m."createdAt"
            )
          ORDER BY m."createdAt" DESC, m.id DESC
          LIMIT ${slack}
        `
      : Promise.resolve([]),
    want('workout_saved')
      ? prisma.workoutSession.findMany({
          where: { userId: id, performedAt: created },
          orderBy: [{ performedAt: 'desc' }, { id: 'desc' }],
          take: slack,
          select: { id: true, performedAt: true },
        })
      : Promise.resolve([]),
    want('check_in')
      ? prisma.checkIn.findMany({
          where: { userId: id, checkedInAt: created },
          orderBy: [{ checkedInAt: 'desc' }, { id: 'desc' }],
          take: slack,
          select: { id: true, checkedInAt: true, gymId: true },
        })
      : Promise.resolve([]),
    want('ai_analysis_completed')
      ? prisma.workoutAiInsight.findMany({
          where: { userId: id, createdAt: created },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: slack,
          select: { id: true, createdAt: true, kind: true },
        })
      : Promise.resolve([]),
    want('registration_completed')
      ? prisma.user.findFirst({
          where: { id, registeredAt: { gte: from, lt: to, ...(cursor ? { lte: cursor.at } : {}) } },
          select: { id: true, registeredAt: true },
        })
      : Promise.resolve(null),
  ])

  const pages: RawTimelineRow[][] = [
    asEventRows(events).filter((row) => want(row.name)),
    likes.map((row) => fact('fact:like:', row.id, row.createdAt, 'like_sent', id)),
    requests.map((row) => fact('fact:request:', row.id, row.createdAt, 'chat_request_sent', id)),
    firstChats.map((row) => fact('fact:chat:', row.id, row.createdAt, 'first_message_sent', id)),
    workouts.map((row) => fact('fact:workout:', row.id, row.performedAt, 'workout_saved', id)),
    checkIns.map((row) => fact('fact:checkin:', row.id, row.checkedInAt, 'check_in', id, row.gymId)),
    insights.map((row) =>
      fact('fact:ai:', row.id, row.createdAt, 'ai_analysis_completed', id, JSON.stringify({ source: row.kind })),
    ),
    registration ? [fact('fact:reg:', registration.id, registration.registeredAt, 'registration_completed', id)] : [],
  ].map((page) => page.filter((row) => isBeforeCursor(row, cursor) && matchesSource(row, source)))

  const merged = paginateMergedRows(pages, null, limit)
  const collapsed = collapseNearby(merged.rows.map(toTimelineEntry))
  const sources = new Set<string>()
  for (const page of pages) {
    for (const row of page) sources.add(eventSource(row.utmSource, row.placement, row.kind))
  }

  return {
    timezone: 'Europe/Moscow',
    generatedAt: now.toISOString(),
    range: {
      preset: range.preset,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      fromKey: range.fromKey,
      toKey: range.toKey,
    },
    user: subject,
    entries: collapsed,
    hasMore: merged.hasMore,
    nextCursor: merged.hasMore ? nextCursorOf(merged.rows) : null,
    options: {
      domains: (Object.keys(DOMAIN_LABEL) as TimelineDomain[]).map((key) => ({
        id: key,
        label: DOMAIN_LABEL[key],
      })),
      events: EVENT_CATALOG.map((item) => ({ key: item.key, domain: item.domain, label: item.label })),
      sources: [...sources].sort(),
    },
    notes: {
      productTimeline: true,
      noSecrets: true,
      chatTextExcluded: true,
      workoutPayloadExcluded: true,
      paginated: true,
    },
  }
}

function n(value: bigint | number | null | undefined): number {
  if (value == null) return 0
  const raw = typeof value === 'bigint' ? Number(value) : value
  return Number.isFinite(raw) ? raw : 0
}

export async function buildEventDebug(
  range: OverviewRange,
  query: { name?: string; userId?: string },
  now = new Date(),
): Promise<AdminEventDebugPayload> {
  const name = parseEventKey(query.name)
  const userId = (query.userId || '').trim().slice(0, 64) || null
  const { from, to } = range
  const future = new Date(now.getTime() + 60 * 60 * 1000)
  const tooOld = new Date(MIN_VALID_EVENT)

  const [countRows, byName, recent, dangling, danglingCountRows, invalidTsRows, invalidTsCountRows] = await Promise.all([
    prisma.$queryRaw<[{ events: bigint; users: bigint; missing: bigint }]>`
      SELECT
        COUNT(*)::bigint AS events,
        COUNT(DISTINCT e."userId") FILTER (WHERE e."userId" IS NOT NULL)::bigint AS users,
        COUNT(*) FILTER (WHERE e."userId" IS NULL)::bigint AS missing
      FROM "LandingEvent" e
      WHERE e."createdAt" >= ${from} AND e."createdAt" < ${to}
        ${name ? Prisma.sql`AND e.name = ${name}` : Prisma.empty}
        ${userId ? Prisma.sql`AND e."userId" = ${userId}` : Prisma.empty}
    `,
    prisma.$queryRaw<{ name: string; events: bigint; users: bigint; missing: bigint }[]>`
      SELECT
        e.name,
        COUNT(*)::bigint AS events,
        COUNT(DISTINCT e."userId") FILTER (WHERE e."userId" IS NOT NULL)::bigint AS users,
        COUNT(*) FILTER (WHERE e."userId" IS NULL)::bigint AS missing
      FROM "LandingEvent" e
      WHERE e."createdAt" >= ${from} AND e."createdAt" < ${to}
        ${name ? Prisma.sql`AND e.name = ${name}` : Prisma.empty}
        ${userId ? Prisma.sql`AND e."userId" = ${userId}` : Prisma.empty}
      GROUP BY e.name
      ORDER BY events DESC
    `,
    prisma.landingEvent.findMany({
      where: {
        createdAt: { gte: from, lt: to },
        ...(name ? { name } : {}),
        ...(userId ? { userId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 400,
      select: { id: true, name: true, createdAt: true, userId: true },
    }),
    prisma.$queryRaw<{ id: string; name: string; createdAt: Date; userId: string }[]>`
      SELECT e.id, e.name, e."createdAt", e."userId"
      FROM "LandingEvent" e
      LEFT JOIN "User" u ON u.id = e."userId"
      WHERE e."createdAt" >= ${from} AND e."createdAt" < ${to}
        AND e."userId" IS NOT NULL AND u.id IS NULL
        ${name ? Prisma.sql`AND e.name = ${name}` : Prisma.empty}
        ${userId ? Prisma.sql`AND e."userId" = ${userId}` : Prisma.empty}
      ORDER BY e."createdAt" DESC
      LIMIT ${DEBUG_SAMPLE}
    `,
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint AS count
      FROM "LandingEvent" e
      LEFT JOIN "User" u ON u.id = e."userId"
      WHERE e."createdAt" >= ${from} AND e."createdAt" < ${to}
        AND e."userId" IS NOT NULL AND u.id IS NULL
        ${name ? Prisma.sql`AND e.name = ${name}` : Prisma.empty}
        ${userId ? Prisma.sql`AND e."userId" = ${userId}` : Prisma.empty}
    `,
    prisma.$queryRaw<{ id: string; name: string; createdAt: Date; userId: string | null }[]>`
      SELECT e.id, e.name, e."createdAt", e."userId"
      FROM "LandingEvent" e
      WHERE e."createdAt" >= ${from} AND e."createdAt" < ${to}
        AND (e."createdAt" > ${future} OR e."createdAt" < ${tooOld})
        ${name ? Prisma.sql`AND e.name = ${name}` : Prisma.empty}
        ${userId ? Prisma.sql`AND e."userId" = ${userId}` : Prisma.empty}
      ORDER BY e."createdAt" DESC
      LIMIT ${DEBUG_SAMPLE}
    `,
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint AS count
      FROM "LandingEvent" e
      WHERE e."createdAt" >= ${from} AND e."createdAt" < ${to}
        AND (e."createdAt" > ${future} OR e."createdAt" < ${tooOld})
        ${name ? Prisma.sql`AND e.name = ${name}` : Prisma.empty}
        ${userId ? Prisma.sql`AND e."userId" = ${userId}` : Prisma.empty}
    `,
  ])

  const duplicates = findDuplicateGroups(
    recent.map((row) => ({ userId: row.userId, name: row.name, at: row.createdAt })),
  )

  return {
    timezone: 'Europe/Moscow',
    generatedAt: now.toISOString(),
    range: {
      preset: range.preset,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      fromKey: range.fromKey,
      toKey: range.toKey,
    },
    eventCount: n(countRows[0]?.events),
    uniqueUsers: n(countRows[0]?.users),
    missingUserId: n(countRows[0]?.missing),
    duplicates: {
      groups: duplicates.length,
      sample: duplicates.slice(0, DEBUG_SAMPLE).map((row) => ({
        name: row.name,
        userId: row.userId,
        at: row.at,
        count: row.count,
      })),
    },
    invalidTimestamp: {
      count: n(invalidTsCountRows[0]?.count),
      sample: invalidTsRows.map((row) => ({
        id: row.id,
        name: row.name,
        at: row.createdAt.toISOString(),
        userId: row.userId,
      })),
    },
    invalidReferences: {
      count: n(danglingCountRows[0]?.count),
      sample: dangling.map((row) => ({
        id: row.id,
        name: row.name,
        at: row.createdAt.toISOString(),
        userId: row.userId,
      })),
    },
    byName: byName.map((row) => ({
      name: row.name,
      events: n(row.events),
      uniqueUsers: n(row.users),
      missingUserId: n(row.missing),
    })),
    notes: {
      landingEventOnly: true,
      noSecrets: true,
      noRawPayloads: true,
    },
  }
}

export { canReadTimeline, parseSearchQuery }
