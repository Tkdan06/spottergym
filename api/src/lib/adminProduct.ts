import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import { type OverviewRange } from './adminOverview.js'
import {
  activityDurationSeconds,
  aiSuccessRate,
  closeSequentialFunnel,
  durationBucket,
  progressReturnedUsers,
  sliceFunnel,
  type MetricDefinition,
  type ProductFunnelStep,
  type ProductReferralFilter,
  type ProductView,
  windowLabel,
} from './adminProductMath.js'
import { moscowDayKey } from './adminAnalytics.js'

export type ProductFilters = {
  gymId: string | null
  source: string | null
  referral: ProductReferralFilter
}

export type ProductFilterOptions = {
  gyms: { id: string; label: string }[]
  sources: { id: string; label: string; users: number }[]
}

type StepTimes = { firstAt: Map<string, number>; events: number }

type Row = { userId: string | null; at: Date | null; events: bigint | number | null }

export type AdminProductPayload = {
  view: ProductView
  timezone: 'Europe/Moscow'
  generatedAt: string
  range: {
    preset: OverviewRange['preset']
    from: string
    to: string
    fromKey: string
    toKey: string
  }
  applied: ProductFilters
  options: ProductFilterOptions
  social?: { funnel: ProductFunnelStep[] }
  training?: { funnel: ProductFunnelStep[] }
  coreLoop?: { funnel: ProductFunnelStep[] }
  chats?: {
    funnel: ProductFunnelStep[]
    kpi: { requests: number; accepted: number; chats: number; messages: number }
  }
  activity?: {
    kpi: {
      checkIns: number
      activeUsers: number
      trainingDays: number
      averageDurationSeconds: number | null
    }
    hours: { hour: number; checkIns: number }[]
    durations: { bucket: string; checkIns: number }[]
  }
  progress?: {
    kpi: {
      opens: number
      users: number
      periodSelections: number
      returnedUsers: number
    }
  }
  ai?: {
    funnel: ProductFunnelStep[]
    kpi: {
      users: number
      requests: number
      generated: number
      failed: number
      successRate: number | null
    }
  }
}

function n(value: bigint | number | null | undefined): number {
  if (value == null) return 0
  const raw = typeof value === 'bigint' ? Number(value) : value
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 0
}

function toStepTimes(rows: Row[]): StepTimes {
  const firstAt = new Map<string, number>()
  let events = 0
  for (const row of rows) {
    if (!row.userId || !row.at) continue
    firstAt.set(row.userId, row.at.getTime())
    events += n(row.events)
  }
  return { firstAt, events }
}

function mergeMin(a: StepTimes, b: StepTimes): StepTimes {
  const firstAt = new Map(a.firstAt)
  for (const [id, at] of b.firstAt) {
    const prev = firstAt.get(id)
    if (prev == null || at < prev) firstAt.set(id, at)
  }
  return { firstAt, events: a.events + b.events }
}

function def(
  event: string,
  numerator: string,
  denominator: string,
  window: string,
): MetricDefinition {
  return { event, numerator, denominator, window }
}

export function parseProductFilters(query: {
  gym?: string | null
  source?: string | null
  referral?: string | null
}): ProductFilters {
  const gymId = (query.gym || '').trim().slice(0, 80) || null
  const source = (query.source || '').trim().slice(0, 80) || null
  const referral =
    query.referral === 'yes' || query.referral === 'no' ? query.referral : 'all'
  return { gymId, source, referral }
}

export function userScopeSql(filters: ProductFilters): Prisma.Sql {
  const conds: Prisma.Sql[] = [Prisma.sql`u."deletedAt" IS NULL`]
  if (filters.gymId) {
    conds.push(Prisma.sql`(
      u."homeGymId" = ${filters.gymId}
      OR EXISTS (
        SELECT 1 FROM "UserGym" ug
        WHERE ug."userId" = u.id AND ug."gymId" = ${filters.gymId}
      )
    )`)
  }
  if (filters.referral === 'yes') {
    conds.push(Prisma.sql`EXISTS (SELECT 1 FROM "Invite" i WHERE i."inviteeId" = u.id)`)
  } else if (filters.referral === 'no') {
    conds.push(Prisma.sql`NOT EXISTS (SELECT 1 FROM "Invite" i WHERE i."inviteeId" = u.id)`)
  }
  if (filters.source === 'direct') {
    conds.push(Prisma.sql`NOT EXISTS (
      SELECT 1 FROM "LandingEvent" e
      WHERE e."userId" = u.id AND e."utmSource" <> ''
    )`)
  } else if (filters.source) {
    conds.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "LandingEvent" e
      WHERE e."userId" = u.id AND e."utmSource" = ${filters.source}
    )`)
  }
  return Prisma.join(conds, ' AND ')
}

async function landingFirsts(
  names: string[],
  from: Date,
  to: Date,
  scope: Prisma.Sql,
): Promise<StepTimes> {
  if (!names.length) return { firstAt: new Map(), events: 0 }
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT e."userId" AS "userId", MIN(e."createdAt") AS at, COUNT(*)::bigint AS events
    FROM "LandingEvent" e
    INNER JOIN "User" u ON u.id = e."userId"
    WHERE ${scope}
      AND e."userId" IS NOT NULL
      AND e.name IN (${Prisma.join(names)})
      AND e."createdAt" >= ${from}
      AND e."createdAt" < ${to}
    GROUP BY e."userId"
  `
  return toStepTimes(rows)
}

async function likeFirsts(from: Date, to: Date, scope: Prisma.Sql): Promise<StepTimes> {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT l."fromUserId" AS "userId", MIN(l."createdAt") AS at, COUNT(*)::bigint AS events
    FROM "Like" l
    INNER JOIN "User" u ON u.id = l."fromUserId"
    WHERE ${scope}
      AND l."createdAt" >= ${from}
      AND l."createdAt" < ${to}
    GROUP BY l."fromUserId"
  `
  return toStepTimes(rows)
}

async function requestFirsts(from: Date, to: Date, scope: Prisma.Sql): Promise<StepTimes> {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT c."initiatedById" AS "userId", MIN(c."createdAt") AS at, COUNT(*)::bigint AS events
    FROM "Conversation" c
    INNER JOIN "User" u ON u.id = c."initiatedById"
    WHERE ${scope}
      AND c."createdAt" >= ${from}
      AND c."createdAt" < ${to}
    GROUP BY c."initiatedById"
  `
  return toStepTimes(rows)
}

async function messageFirsts(from: Date, to: Date, scope: Prisma.Sql): Promise<StepTimes> {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT m."senderId" AS "userId", MIN(m."createdAt") AS at, COUNT(*)::bigint AS events
    FROM "ChatMessage" m
    INNER JOIN "User" u ON u.id = m."senderId"
    WHERE ${scope}
      AND m."createdAt" >= ${from}
      AND m."createdAt" < ${to}
    GROUP BY m."senderId"
  `
  return toStepTimes(rows)
}

async function chatConversationCount(from: Date, to: Date, scope: Prisma.Sql): Promise<number> {
  const rows = await prisma.$queryRaw<[{ n: bigint }]>`
    SELECT COUNT(DISTINCT m."conversationId")::bigint AS n
    FROM "ChatMessage" m
    INNER JOIN "User" u ON u.id = m."senderId"
    WHERE ${scope}
      AND m."createdAt" >= ${from}
      AND m."createdAt" < ${to}
  `
  return n(rows[0]?.n)
}

async function workoutFirsts(from: Date, to: Date, scope: Prisma.Sql): Promise<StepTimes> {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT w."userId" AS "userId", MIN(w."createdAt") AS at, COUNT(*)::bigint AS events
    FROM "WorkoutSession" w
    INNER JOIN "User" u ON u.id = w."userId"
    WHERE ${scope}
      AND w."performedAt" >= ${from}
      AND w."performedAt" < ${to}
    GROUP BY w."userId"
  `
  return toStepTimes(rows)
}

async function workoutRepeatFirsts(from: Date, to: Date, scope: Prisma.Sql): Promise<StepTimes> {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT w."userId" AS "userId", MIN(w."performedAt") AS at, COUNT(*)::bigint AS events
    FROM "WorkoutSession" w
    INNER JOIN "User" u ON u.id = w."userId"
    INNER JOIN (
      SELECT "userId", MIN("performedAt") AS first_at
      FROM "WorkoutSession"
      GROUP BY "userId"
    ) f ON f."userId" = w."userId"
    WHERE ${scope}
      AND w."performedAt" > f.first_at
      AND w."performedAt" >= ${from}
      AND w."performedAt" < ${to}
    GROUP BY w."userId"
  `
  return toStepTimes(rows)
}

async function insightFirsts(from: Date, to: Date, scope: Prisma.Sql): Promise<StepTimes> {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT w."userId" AS "userId", MIN(w."createdAt") AS at, COUNT(*)::bigint AS events
    FROM "WorkoutAiInsight" w
    INNER JOIN "User" u ON u.id = w."userId"
    WHERE ${scope}
      AND w."createdAt" >= ${from}
      AND w."createdAt" < ${to}
    GROUP BY w."userId"
  `
  return toStepTimes(rows)
}

async function loadFilterOptions(): Promise<ProductFilterOptions> {
  const [gyms, sources] = await Promise.all([
    prisma.gym.findMany({
      select: { id: true, name: true, network: true },
      orderBy: [{ network: 'asc' }, { name: 'asc' }],
    }),
    prisma.$queryRaw<{ source: string; users: bigint }[]>`
      SELECT e."utmSource" AS source, COUNT(DISTINCT e."userId")::bigint AS users
      FROM "LandingEvent" e
      WHERE e."userId" IS NOT NULL AND e."utmSource" <> ''
      GROUP BY e."utmSource"
      ORDER BY users DESC
      LIMIT 20
    `,
  ])
  return {
    gyms: gyms.map((g) => ({
      id: g.id,
      label: `${g.network} · ${g.name.replace(/^DDX\s+/i, '').replace(/^World Class\s+/i, '').trim() || g.name}`,
    })),
    sources: [
      { id: 'direct', label: 'direct', users: 0 },
      ...sources.map((s) => ({ id: s.source, label: s.source, users: n(s.users) })),
    ],
  }
}

async function buildSocial(from: Date, to: Date, scope: Prisma.Sql, window: string) {
  const [people, profiles, likes, requests, accepted, messages, chats] = await Promise.all([
    landingFirsts(['people_list_viewed'], from, to, scope),
    landingFirsts(['profile_viewed'], from, to, scope),
    likeFirsts(from, to, scope),
    requestFirsts(from, to, scope),
    landingFirsts(['chat_request_accepted'], from, to, scope),
    messageFirsts(from, to, scope),
    chatConversationCount(from, to, scope),
  ])
  const chatStarted = { firstAt: messages.firstAt, events: chats }
  const funnel = closeSequentialFunnel([
    {
      id: 'people_viewed',
      label: 'People viewed',
      ...people,
      definition: def(
        'people_list_viewed',
        'users with ≥1 people_list_viewed',
        '— (first step)',
        window,
      ),
    },
    {
      id: 'profile_viewed',
      label: 'Profile viewed',
      ...profiles,
      definition: def(
        'profile_viewed',
        'users who viewed a profile after people viewed',
        'people viewed users',
        window,
      ),
    },
    {
      id: 'like_sent',
      label: 'Like sent',
      ...likes,
      definition: def('Like.createdAt (fact)', 'users who liked after profile', 'profile viewed users', window),
    },
    {
      id: 'request_sent',
      label: 'Request sent',
      ...requests,
      definition: def(
        'Conversation.createdAt (fact)',
        'users who sent a request after like',
        'like sent users',
        window,
      ),
    },
    {
      id: 'request_accepted',
      label: 'Request accepted',
      ...accepted,
      definition: def(
        'chat_request_accepted',
        'users with an accept after request',
        'request sent users',
        window,
      ),
    },
    {
      id: 'chat_started',
      label: 'Chat started',
      ...chatStarted,
      definition: def(
        'ChatMessage (first per user)',
        'users who sent a message after accept',
        'request accepted users',
        window,
      ),
    },
    {
      id: 'message_sent',
      label: 'Message sent',
      ...messages,
      definition: def(
        'ChatMessage.createdAt (fact)',
        'users who sent a message after chat started',
        'chat started users',
        window,
      ),
    },
  ])
  return {
    funnel,
    chats,
    messages: messages.events,
    requests: requests.events,
    accepted: accepted.events,
  }
}

async function buildTraining(from: Date, to: Date, scope: Prisma.Sql, window: string) {
  const [opened, created, saved, repeated, progress] = await Promise.all([
    landingFirsts(['workout_started'], from, to, scope),
    workoutFirsts(from, to, scope),
    landingFirsts(['workout_saved'], from, to, scope),
    workoutRepeatFirsts(from, to, scope),
    landingFirsts(['progress_opened'], from, to, scope),
  ])
  const savedMerged = mergeMin(created, saved)
  const funnel = closeSequentialFunnel([
    {
      id: 'workout_opened',
      label: 'Workout opened',
      ...opened,
      definition: def('workout_started', 'users who opened a new workout editor', '— (first step)', window),
    },
    {
      id: 'workout_created',
      label: 'Workout created',
      ...created,
      definition: def(
        'WorkoutSession.performedAt (fact, not CheckIn)',
        'users with a saved session after open',
        'workout opened users',
        window,
      ),
    },
    {
      id: 'workout_saved',
      label: 'Workout completed/saved',
      firstAt: savedMerged.firstAt,
      events: saved.events || created.events,
      definition: def(
        'workout_saved ∪ WorkoutSession',
        'users who saved after create (save = session row; no separate completed)',
        'workout created users',
        window,
      ),
    },
    {
      id: 'workout_repeated',
      label: 'Workout repeated',
      ...repeated,
      definition: def(
        'WorkoutSession #2+ (not CheckIn)',
        'users with a second-or-later session in the window',
        'workout saved users',
        window,
      ),
    },
    {
      id: 'progress_viewed',
      label: 'Progress viewed',
      ...progress,
      definition: def('progress_opened', 'users who opened progress after a repeat', 'workout repeated users', window),
    },
  ])
  return { funnel }
}

async function buildCoreLoop(from: Date, to: Date, scope: Prisma.Sql, window: string) {
  const [regs, gymRows, people, profiles, likes, requests, messages, returnRows] = await Promise.all([
    prisma.$queryRaw<Row[]>`
      SELECT u.id AS "userId", u."registeredAt" AS at, 1::bigint AS events
      FROM "User" u
      WHERE ${scope}
        AND u."registeredAt" >= ${from}
        AND u."registeredAt" < ${to}
    `,
    prisma.$queryRaw<Row[]>`
      SELECT
        u.id AS "userId",
        LEAST(
          CASE WHEN u."homeGymId" IS NOT NULL THEN u."registeredAt" END,
          ge.at,
          ug.at
        ) AS at,
        1::bigint AS events
      FROM "User" u
      LEFT JOIN (
        SELECT e."userId", MIN(e."createdAt") AS at
        FROM "LandingEvent" e
        WHERE e.name IN ('gym_selected', 'gym_skipped')
          AND e."createdAt" < ${to}
        GROUP BY e."userId"
      ) ge ON ge."userId" = u.id
      LEFT JOIN (
        SELECT "userId", MIN("createdAt") AS at
        FROM "UserGym"
        WHERE "createdAt" < ${to}
        GROUP BY "userId"
      ) ug ON ug."userId" = u.id
      WHERE ${scope}
        AND u."registeredAt" >= ${from}
        AND u."registeredAt" < ${to}
        AND LEAST(
          CASE WHEN u."homeGymId" IS NOT NULL THEN u."registeredAt" END,
          ge.at,
          ug.at
        ) IS NOT NULL
    `,
    landingFirsts(['people_list_viewed'], from, to, scope),
    landingFirsts(['profile_viewed'], from, to, scope),
    likeFirsts(from, to, scope),
    requestFirsts(from, to, scope),
    messageFirsts(from, to, scope),
    prisma.$queryRaw<Row[]>`
      SELECT u.id AS "userId", u."lastSeenAt" AS at, 1::bigint AS events
      FROM "User" u
      WHERE ${scope}
        AND u."registeredAt" >= ${from}
        AND u."registeredAt" < ${to}
        AND (timezone('Europe/Moscow', u."lastSeenAt"))::date
          > (timezone('Europe/Moscow', u."registeredAt"))::date
    `,
  ])

  const registered = toStepTimes(regs)
  const gym = toStepTimes(gymRows)
  const social = mergeMin(likes, requests)
  const returned = toStepTimes(returnRows)

  const funnel = closeSequentialFunnel([
    {
      id: 'registration',
      label: 'Registration',
      ...registered,
      definition: def('User.registeredAt', 'users registered in the window', '— (cohort)', window),
    },
    {
      id: 'gym_context',
      label: 'Gym context',
      ...gym,
      definition: def(
        'gym_selected ∪ gym_skipped ∪ homeGymId ∪ UserGym',
        'registrants who chose, skipped, or joined a gym (skip still counts)',
        'registration users',
        window,
      ),
    },
    {
      id: 'people',
      label: 'People',
      ...people,
      definition: def('people_list_viewed', 'registrants who opened a people list after gym context', 'gym context users', window),
    },
    {
      id: 'profile',
      label: 'Profile',
      ...profiles,
      definition: def('profile_viewed', 'registrants who opened a profile after people', 'people users', window),
    },
    {
      id: 'social_action',
      label: 'Social action',
      ...social,
      definition: def(
        'Like ∪ Conversation',
        'registrants who liked or sent a request after profile',
        'profile users',
        window,
      ),
    },
    {
      id: 'chat',
      label: 'Chat',
      ...messages,
      definition: def('ChatMessage', 'registrants who sent a chat message after social action', 'social action users', window),
    },
    {
      id: 'return',
      label: 'Return',
      ...returned,
      definition: def(
        'User.lastSeenAt day > registration day (МСК)',
        'registrants who came back another MSK day after chat',
        'chat users',
        window,
      ),
    },
  ])
  return { funnel }
}

async function buildActivity(from: Date, to: Date, scope: Prisma.Sql, now: Date) {
  const rows = await prisma.$queryRaw<
    {
      userId: string
      checkedInAt: Date
      checkedOutAt: Date | null
      expiresAt: Date | null
    }[]
  >`
    SELECT k."userId", k."checkedInAt", k."checkedOutAt", k."expiresAt"
    FROM "CheckIn" k
    INNER JOIN "User" u ON u.id = k."userId"
    WHERE ${scope}
      AND k."checkedInAt" >= ${from}
      AND k."checkedInAt" < ${to}
  `

  const users = new Set<string>()
  const days = new Set<string>()
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, checkIns: 0 }))
  const durationMap = new Map<string, number>([
    ['<30м', 0],
    ['30–60м', 0],
    ['1–2ч', 0],
    ['2–3ч', 0],
    ['3ч+', 0],
  ])
  let durationSum = 0

  for (const row of rows) {
    users.add(row.userId)
    days.add(`${row.userId}:${moscowDayKey(row.checkedInAt)}`)
    const shifted = new Date(row.checkedInAt.getTime() + 3 * 60 * 60 * 1000)
    hours[shifted.getUTCHours()].checkIns += 1
    const seconds = activityDurationSeconds({
      checkedInAt: row.checkedInAt,
      checkedOutAt: row.checkedOutAt,
      expiresAt: row.expiresAt,
      now,
    })
    durationSum += seconds
    const bucket = durationBucket(seconds)
    durationMap.set(bucket, (durationMap.get(bucket) || 0) + 1)
  }

  return {
    kpi: {
      checkIns: rows.length,
      activeUsers: users.size,
      trainingDays: days.size,
      averageDurationSeconds: rows.length ? Math.round(durationSum / rows.length) : null,
    },
    hours,
    durations: [...durationMap.entries()].map(([bucket, checkIns]) => ({ bucket, checkIns })),
  }
}

async function buildProgress(from: Date, to: Date, scope: Prisma.Sql) {
  const rows = await prisma.$queryRaw<{ userId: string; events: bigint }[]>`
    SELECT e."userId" AS "userId", COUNT(*)::bigint AS events
    FROM "LandingEvent" e
    INNER JOIN "User" u ON u.id = e."userId"
    WHERE ${scope}
      AND e."userId" IS NOT NULL
      AND e.name = 'progress_opened'
      AND e."createdAt" >= ${from}
      AND e."createdAt" < ${to}
    GROUP BY e."userId"
  `
  const opensByUser = new Map(rows.map((row) => [row.userId, n(row.events)]))
  let opens = 0
  for (const count of opensByUser.values()) opens += count
  return {
    kpi: {
      opens,
      users: opensByUser.size,
      periodSelections: 0,
      returnedUsers: progressReturnedUsers(opensByUser),
    },
  }
}

async function buildAi(from: Date, to: Date, scope: Prisma.Sql, window: string) {
  const [opened, requested, generated, viewed, failed] = await Promise.all([
    landingFirsts(['ai_analysis_opened'], from, to, scope),
    landingFirsts(['ai_analysis_requested'], from, to, scope),
    insightFirsts(from, to, scope),
    landingFirsts(['ai_recommendation_viewed'], from, to, scope),
    landingFirsts(['ai_analysis_failed'], from, to, scope),
  ])
  const funnel = closeSequentialFunnel([
    {
      id: 'ai_opened',
      label: 'AI screen opened',
      ...opened,
      definition: def('ai_analysis_opened', 'users who opened week/month recap', '— (first step)', window),
    },
    {
      id: 'ai_requested',
      label: 'Analysis requested',
      ...requested,
      definition: def('ai_analysis_requested', 'users who requested after open', 'AI opened users', window),
    },
    {
      id: 'ai_generated',
      label: 'Analysis generated',
      ...generated,
      definition: def(
        'WorkoutAiInsight.createdAt (fact, not value)',
        'users with a generated insight after request',
        'analysis requested users',
        window,
      ),
    },
    {
      id: 'ai_viewed',
      label: 'Recommendation viewed',
      ...viewed,
      definition: def(
        'ai_recommendation_viewed',
        'users who viewed a recommendation after generate (month recap only today)',
        'analysis generated users',
        window,
      ),
    },
  ])
  const users = new Set([
    ...opened.firstAt.keys(),
    ...requested.firstAt.keys(),
    ...generated.firstAt.keys(),
  ]).size
  return {
    funnel,
    kpi: {
      users,
      requests: requested.events,
      generated: generated.events,
      failed: failed.events,
      successRate: aiSuccessRate(generated.events, requested.events),
    },
  }
}

export async function buildAdminProduct(
  view: ProductView,
  range: OverviewRange,
  filters: ProductFilters,
): Promise<AdminProductPayload> {
  const now = new Date()
  const { from, to, fromKey, toKey, preset } = range
  const window = windowLabel(fromKey, toKey)
  const scope = userScopeSql(filters)
  const options = await loadFilterOptions()

  const base: AdminProductPayload = {
    view,
    timezone: 'Europe/Moscow',
    generatedAt: now.toISOString(),
    range: {
      preset,
      from: from.toISOString(),
      to: to.toISOString(),
      fromKey,
      toKey,
    },
    applied: filters,
    options,
  }

  if (view === 'funnels') {
    const [social, training] = await Promise.all([
      buildSocial(from, to, scope, window),
      buildTraining(from, to, scope, window),
    ])
    return { ...base, social: { funnel: social.funnel }, training }
  }
  if (view === 'social') {
    const social = await buildSocial(from, to, scope, window)
    return { ...base, social: { funnel: social.funnel } }
  }
  if (view === 'chats') {
    const social = await buildSocial(from, to, scope, window)
    return {
      ...base,
      chats: {
        funnel: sliceFunnel(social.funnel, [
          'request_sent',
          'request_accepted',
          'chat_started',
          'message_sent',
        ]),
        kpi: {
          requests: social.requests,
          accepted: social.accepted,
          chats: social.chats,
          messages: social.messages,
        },
      },
    }
  }
  if (view === 'workouts') {
    return { ...base, training: await buildTraining(from, to, scope, window) }
  }
  if (view === 'core-loop') {
    return { ...base, coreLoop: await buildCoreLoop(from, to, scope, window) }
  }
  if (view === 'activity') {
    return { ...base, activity: await buildActivity(from, to, scope, now) }
  }
  if (view === 'progress') {
    return { ...base, progress: await buildProgress(from, to, scope) }
  }
  return { ...base, ai: await buildAi(from, to, scope, window) }
}
