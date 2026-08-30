import { prisma } from '../db.js'
import { moscowDayKey } from './adminAnalytics.js'
import { type OverviewRange } from './adminOverview.js'
import {
  AHA_ACTIONS,
  AHA_COMPARE_DAYS,
  AHA_WINDOW_DAYS,
  COHORT_RETENTION_DAYS,
  MIN_AHA_SAMPLE,
  cohortBucketKey,
  correlationCaption,
  isAcqDimension,
  isAhaAction,
  isCohortGrain,
  isProductDimension,
  matchesAcquisition,
  matchesProductDimension,
  performedInAhaWindow,
  pooledDayN,
  rankAhaCandidates,
  type AcqDimension,
  type AhaAction,
  type AhaCandidate,
  type CohortGrain,
  type CohortUser,
  type ProductDimension,
  type RetentionCell,
} from './adminCohortsMath.js'

export type CohortFilters = {
  grain: CohortGrain
  acq: AcqDimension
  acqValue: string | null
  product: ProductDimension
}

export type CohortRow = {
  key: string
  label: string
  users: number
  retention: RetentionCell[]
}

export type AdminCohortsPayload = {
  timezone: 'Europe/Moscow'
  generatedAt: string
  formula: 'exact_day_n_msk'
  range: { preset: OverviewRange['preset']; fromKey: string; toKey: string }
  applied: CohortFilters
  options: {
    sources: string[]
    mediums: string[]
    campaigns: string[]
  }
  rows: CohortRow[]
}

export type AhaCompareGroup = {
  users: number
  retention: RetentionCell[]
  activeDaysAvg: number | null
  workoutsAvg: number | null
  checkInsAvg: number | null
}

export type AdminAhaPayload = {
  timezone: 'Europe/Moscow'
  generatedAt: string
  formula: 'exact_day_n_msk'
  range: { preset: OverviewRange['preset']; fromKey: string; toKey: string }
  action: AhaAction
  actionLabel: string
  caption: string
  disclaimer: 'Корреляция, не причинно-следственная связь.'
  windowDays: number
  minSample: number
  withAction: AhaCompareGroup
  withoutAction: AhaCompareGroup
  candidates: AhaCandidate[]
}

const ACTION_LABEL: Record<AhaAction, string> = {
  people_viewed: 'просмотрел людей',
  profile_viewed: 'открыл профиль',
  like_sent: 'поставил лайк',
  request_sent: 'отправил запрос',
  chat_started: 'начал чат',
  workout_saved: 'записал тренировку',
  progress_opened: 'открыл прогресс',
  ai_used: 'использовал AI',
}

type TouchRow = {
  userId: string
  source: string
  medium: string
  campaign: string
  searchEngine: string
  searchPaid: boolean
}

type FirstAt = Map<string, number>
type CountMap = Map<string, number>

function n(value: bigint | number | null | undefined): number {
  if (value == null) return 0
  const raw = typeof value === 'bigint' ? Number(value) : value
  return Number.isFinite(raw) && raw > 0 ? raw : 0
}

export function parseCohortFilters(query: {
  grain?: string | null
  acq?: string | null
  acqValue?: string | null
  product?: string | null
}): CohortFilters {
  const grain = isCohortGrain(query.grain) ? query.grain : 'week'
  const acq = isAcqDimension(query.acq) ? query.acq : 'all'
  const acqValue = (query.acqValue || '').trim().slice(0, 80) || null
  const product = isProductDimension(query.product) ? query.product : 'all'
  return { grain, acq, acqValue, product }
}

function toFirstAt(rows: { userId: string; at: Date | null }[]): FirstAt {
  const map = new Map<string, number>()
  for (const row of rows) {
    if (!row.userId || !row.at) continue
    map.set(row.userId, row.at.getTime())
  }
  return map
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-')
  const names = [
    'январь',
    'февраль',
    'март',
    'апрель',
    'май',
    'июнь',
    'июль',
    'август',
    'сентябрь',
    'октябрь',
    'ноябрь',
    'декабрь',
  ]
  const month = names[Number(m) - 1] || key
  return `${month} ${y}`
}

function weekLabel(mondayKey: string): string {
  return `нед. ${mondayKey}`
}

async function loadUsers(from: Date, to: Date): Promise<CohortUser[]> {
  return prisma.user.findMany({
    where: { deletedAt: null, registeredAt: { gte: from, lt: to } },
    select: { id: true, registeredAt: true, lastSeenAt: true, homeGymId: true },
  })
}

async function loadTouches(from: Date, to: Date): Promise<Map<string, TouchRow>> {
  const rows = await prisma.$queryRaw<TouchRow[]>`
    SELECT DISTINCT ON (e."userId")
      e."userId" AS "userId",
      e."utmSource" AS source,
      e."utmMedium" AS medium,
      e."utmCampaign" AS campaign,
      e."searchEngine" AS "searchEngine",
      e."searchPaid" AS "searchPaid"
    FROM "LandingEvent" e
    INNER JOIN "User" u ON u.id = e."userId"
    WHERE u."deletedAt" IS NULL
      AND u."registeredAt" >= ${from}
      AND u."registeredAt" < ${to}
      AND e."userId" IS NOT NULL
    ORDER BY e."userId", e."createdAt"
  `
  return new Map(rows.map((row) => [row.userId, row]))
}

async function loadInvitees(from: Date, to: Date): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT i."inviteeId" AS id
    FROM "Invite" i
    INNER JOIN "User" u ON u.id = i."inviteeId"
    WHERE u."deletedAt" IS NULL
      AND u."registeredAt" >= ${from}
      AND u."registeredAt" < ${to}
  `
  return new Set(rows.map((row) => row.id))
}

async function loadActionFirsts(from: Date, to: Date) {
  const [people, profiles, likes, requests, chats, workouts, progress, aiEvents, aiFacts, gymSelected] =
    await Promise.all([
      prisma.$queryRaw<{ userId: string; at: Date }[]>`
        SELECT e."userId" AS "userId", MIN(e."createdAt") AS at
        FROM "LandingEvent" e
        INNER JOIN "User" u ON u.id = e."userId"
        WHERE u."deletedAt" IS NULL AND u."registeredAt" >= ${from} AND u."registeredAt" < ${to}
          AND e.name = 'people_list_viewed' AND e."createdAt" >= u."registeredAt"
        GROUP BY e."userId"
      `,
      prisma.$queryRaw<{ userId: string; at: Date }[]>`
        SELECT e."userId" AS "userId", MIN(e."createdAt") AS at
        FROM "LandingEvent" e
        INNER JOIN "User" u ON u.id = e."userId"
        WHERE u."deletedAt" IS NULL AND u."registeredAt" >= ${from} AND u."registeredAt" < ${to}
          AND e.name = 'profile_viewed' AND e."createdAt" >= u."registeredAt"
        GROUP BY e."userId"
      `,
      prisma.$queryRaw<{ userId: string; at: Date }[]>`
        SELECT l."fromUserId" AS "userId", MIN(l."createdAt") AS at
        FROM "Like" l
        INNER JOIN "User" u ON u.id = l."fromUserId"
        WHERE u."deletedAt" IS NULL AND u."registeredAt" >= ${from} AND u."registeredAt" < ${to}
          AND l."createdAt" >= u."registeredAt"
        GROUP BY l."fromUserId"
      `,
      prisma.$queryRaw<{ userId: string; at: Date }[]>`
        SELECT c."initiatedById" AS "userId", MIN(c."createdAt") AS at
        FROM "Conversation" c
        INNER JOIN "User" u ON u.id = c."initiatedById"
        WHERE u."deletedAt" IS NULL AND u."registeredAt" >= ${from} AND u."registeredAt" < ${to}
          AND c."createdAt" >= u."registeredAt"
        GROUP BY c."initiatedById"
      `,
      prisma.$queryRaw<{ userId: string; at: Date }[]>`
        SELECT m."senderId" AS "userId", MIN(m."createdAt") AS at
        FROM "ChatMessage" m
        INNER JOIN "User" u ON u.id = m."senderId"
        WHERE u."deletedAt" IS NULL AND u."registeredAt" >= ${from} AND u."registeredAt" < ${to}
          AND m."createdAt" >= u."registeredAt"
        GROUP BY m."senderId"
      `,
      prisma.$queryRaw<{ userId: string; at: Date }[]>`
        SELECT w."userId" AS "userId", MIN(w."createdAt") AS at
        FROM "WorkoutSession" w
        INNER JOIN "User" u ON u.id = w."userId"
        WHERE u."deletedAt" IS NULL AND u."registeredAt" >= ${from} AND u."registeredAt" < ${to}
          AND w."performedAt" >= u."registeredAt"
        GROUP BY w."userId"
      `,
      prisma.$queryRaw<{ userId: string; at: Date }[]>`
        SELECT e."userId" AS "userId", MIN(e."createdAt") AS at
        FROM "LandingEvent" e
        INNER JOIN "User" u ON u.id = e."userId"
        WHERE u."deletedAt" IS NULL AND u."registeredAt" >= ${from} AND u."registeredAt" < ${to}
          AND e.name = 'progress_opened' AND e."createdAt" >= u."registeredAt"
        GROUP BY e."userId"
      `,
      prisma.$queryRaw<{ userId: string; at: Date }[]>`
        SELECT e."userId" AS "userId", MIN(e."createdAt") AS at
        FROM "LandingEvent" e
        INNER JOIN "User" u ON u.id = e."userId"
        WHERE u."deletedAt" IS NULL AND u."registeredAt" >= ${from} AND u."registeredAt" < ${to}
          AND e.name IN ('ai_analysis_requested', 'ai_analysis_completed')
          AND e."createdAt" >= u."registeredAt"
        GROUP BY e."userId"
      `,
      prisma.$queryRaw<{ userId: string; at: Date }[]>`
        SELECT w."userId" AS "userId", MIN(w."createdAt") AS at
        FROM "WorkoutAiInsight" w
        INNER JOIN "User" u ON u.id = w."userId"
        WHERE u."deletedAt" IS NULL AND u."registeredAt" >= ${from} AND u."registeredAt" < ${to}
          AND w."createdAt" >= u."registeredAt"
        GROUP BY w."userId"
      `,
      prisma.$queryRaw<{ userId: string; at: Date }[]>`
        SELECT e."userId" AS "userId", MIN(e."createdAt") AS at
        FROM "LandingEvent" e
        INNER JOIN "User" u ON u.id = e."userId"
        WHERE u."deletedAt" IS NULL AND u."registeredAt" >= ${from} AND u."registeredAt" < ${to}
          AND e.name = 'gym_selected' AND e."createdAt" >= u."registeredAt"
        GROUP BY e."userId"
      `,
    ])

  const ai = new Map<string, number>()
  for (const row of [...aiEvents, ...aiFacts]) {
    if (!row.at) continue
    const prev = ai.get(row.userId)
    const at = row.at.getTime()
    if (prev == null || at < prev) ai.set(row.userId, at)
  }

  return {
    people_viewed: toFirstAt(people),
    profile_viewed: toFirstAt(profiles),
    like_sent: toFirstAt(likes),
    request_sent: toFirstAt(requests),
    chat_started: toFirstAt(chats),
    workout_saved: toFirstAt(workouts),
    progress_opened: toFirstAt(progress),
    ai_used: ai,
    gym_selected: toFirstAt(gymSelected),
  } satisfies Record<AhaAction | 'gym_selected', FirstAt>
}

async function loadCounts(from: Date, to: Date): Promise<{
  workouts: CountMap
  checkIns: CountMap
  activeDays: CountMap
}> {
  const [workouts, checkIns, days] = await Promise.all([
    prisma.$queryRaw<{ userId: string; n: bigint }[]>`
      SELECT w."userId" AS "userId", COUNT(*)::bigint AS n
      FROM "WorkoutSession" w
      INNER JOIN "User" u ON u.id = w."userId"
      WHERE u."deletedAt" IS NULL AND u."registeredAt" >= ${from} AND u."registeredAt" < ${to}
        AND w."performedAt" >= u."registeredAt"
      GROUP BY w."userId"
    `,
    prisma.$queryRaw<{ userId: string; n: bigint }[]>`
      SELECT k."userId" AS "userId", COUNT(*)::bigint AS n
      FROM "CheckIn" k
      INNER JOIN "User" u ON u.id = k."userId"
      WHERE u."deletedAt" IS NULL AND u."registeredAt" >= ${from} AND u."registeredAt" < ${to}
        AND k."checkedInAt" >= u."registeredAt"
      GROUP BY k."userId"
    `,
    prisma.$queryRaw<{ userId: string; n: bigint }[]>`
      SELECT x."userId" AS "userId", COUNT(DISTINCT x.d)::bigint AS n
      FROM (
        SELECT k."userId" AS "userId", (timezone('Europe/Moscow', k."checkedInAt"))::date AS d
        FROM "CheckIn" k
        INNER JOIN "User" u ON u.id = k."userId"
        WHERE u."deletedAt" IS NULL AND u."registeredAt" >= ${from} AND u."registeredAt" < ${to}
          AND k."checkedInAt" >= u."registeredAt"
        UNION
        SELECT w."userId", (timezone('Europe/Moscow', w."performedAt"))::date
        FROM "WorkoutSession" w
        INNER JOIN "User" u ON u.id = w."userId"
        WHERE u."deletedAt" IS NULL AND u."registeredAt" >= ${from} AND u."registeredAt" < ${to}
          AND w."performedAt" >= u."registeredAt"
        UNION
        SELECT l."fromUserId", (timezone('Europe/Moscow', l."createdAt"))::date
        FROM "Like" l
        INNER JOIN "User" u ON u.id = l."fromUserId"
        WHERE u."deletedAt" IS NULL AND u."registeredAt" >= ${from} AND u."registeredAt" < ${to}
          AND l."createdAt" >= u."registeredAt"
        UNION
        SELECT m."senderId", (timezone('Europe/Moscow', m."createdAt"))::date
        FROM "ChatMessage" m
        INNER JOIN "User" u ON u.id = m."senderId"
        WHERE u."deletedAt" IS NULL AND u."registeredAt" >= ${from} AND u."registeredAt" < ${to}
          AND m."createdAt" >= u."registeredAt"
      ) x
      GROUP BY x."userId"
    `,
  ])
  return {
    workouts: new Map(workouts.map((row) => [row.userId, n(row.n)])),
    checkIns: new Map(checkIns.map((row) => [row.userId, n(row.n)])),
    activeDays: new Map(days.map((row) => [row.userId, n(row.n)])),
  }
}

function meanCount(users: CohortUser[], counts: CountMap): number | null {
  if (!users.length) return null
  let sum = 0
  for (const user of users) sum += counts.get(user.id) || 0
  return Math.round((sum / users.length) * 10) / 10
}

function filterUsers(
  users: CohortUser[],
  touches: Map<string, TouchRow>,
  invitees: Set<string>,
  actions: Awaited<ReturnType<typeof loadActionFirsts>>,
  filters: CohortFilters,
): CohortUser[] {
  return users.filter((user) => {
    const touch = touches.get(user.id)
    if (
      !matchesAcquisition(
        touch
          ? {
              source: touch.source,
              medium: touch.medium,
              campaign: touch.campaign,
              searchEngine: touch.searchEngine,
              searchPaid: touch.searchPaid,
            }
          : undefined,
        invitees.has(user.id),
        filters.acq,
        filters.acqValue,
      )
    ) {
      return false
    }
    return matchesProductDimension(
      {
        gymSelected: !!user.homeGymId || actions.gym_selected.has(user.id),
        social: actions.like_sent.has(user.id) || actions.request_sent.has(user.id),
        workout: actions.workout_saved.has(user.id),
        ai: actions.ai_used.has(user.id),
      },
      filters.product,
    )
  })
}

export async function buildAdminCohorts(
  range: OverviewRange,
  filters: CohortFilters,
): Promise<AdminCohortsPayload> {
  const now = new Date()
  const todayKey = moscowDayKey(now)
  const { from, to } = range
  const [users, touches, invitees, actions] = await Promise.all([
    loadUsers(from, to),
    loadTouches(from, to),
    loadInvitees(from, to),
    loadActionFirsts(from, to),
  ])
  const scoped = filterUsers(users, touches, invitees, actions, filters)
  const buckets = new Map<string, CohortUser[]>()
  for (const user of scoped) {
    const key = cohortBucketKey(user.registeredAt, filters.grain)
    const list = buckets.get(key) || []
    list.push(user)
    buckets.set(key, list)
  }
  const rows: CohortRow[] = [...buckets.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, list]) => ({
      key,
      label: filters.grain === 'month' ? monthLabel(key) : weekLabel(key),
      users: list.length,
      retention: COHORT_RETENTION_DAYS.map((day) => pooledDayN(list, day, todayKey, MIN_AHA_SAMPLE)),
    }))

  const sources = new Set<string>()
  const mediums = new Set<string>()
  const campaigns = new Set<string>()
  for (const touch of touches.values()) {
    if (touch.source.trim()) sources.add(touch.source.trim())
    if (touch.medium.trim()) mediums.add(touch.medium.trim())
    if (touch.campaign.trim()) campaigns.add(touch.campaign.trim())
  }

  return {
    timezone: 'Europe/Moscow',
    generatedAt: now.toISOString(),
    formula: 'exact_day_n_msk',
    range: { preset: range.preset, fromKey: range.fromKey, toKey: range.toKey },
    applied: filters,
    options: {
      sources: [...sources].slice(0, 20),
      mediums: [...mediums].slice(0, 20),
      campaigns: [...campaigns].slice(0, 20),
    },
    rows,
  }
}

function compareGroup(
  users: CohortUser[],
  todayKey: string,
  counts: Awaited<ReturnType<typeof loadCounts>>,
): AhaCompareGroup {
  const retention = AHA_COMPARE_DAYS.map((day) => pooledDayN(users, day, todayKey, MIN_AHA_SAMPLE))
  return {
    users: users.length,
    retention,
    activeDaysAvg: meanCount(users, counts.activeDays),
    workoutsAvg: meanCount(users, counts.workouts),
    checkInsAvg: meanCount(users, counts.checkIns),
  }
}

export async function buildAdminAha(
  range: OverviewRange,
  action: AhaAction,
): Promise<AdminAhaPayload> {
  const now = new Date()
  const todayKey = moscowDayKey(now)
  const { from, to } = range
  const [users, actions, counts] = await Promise.all([
    loadUsers(from, to),
    loadActionFirsts(from, to),
    loadCounts(from, to),
  ])

  const split = (id: AhaAction) => {
    const withAction: CohortUser[] = []
    const withoutAction: CohortUser[] = []
    const firsts = actions[id]
    for (const user of users) {
      if (performedInAhaWindow(user.registeredAt, firsts.get(user.id), AHA_WINDOW_DAYS)) {
        withAction.push(user)
      } else {
        withoutAction.push(user)
      }
    }
    return { withAction, withoutAction }
  }

  const { withAction, withoutAction } = split(action)
  const candidates = rankAhaCandidates(
    AHA_ACTIONS.map((id) => {
      const parts = split(id)
      const withCell = pooledDayN(parts.withAction, 7, todayKey, 1)
      const withoutCell = pooledDayN(parts.withoutAction, 7, todayKey, 1)
      return {
        action: id,
        usersWith: withCell.eligible,
        usersWithout: withoutCell.eligible,
        r7With: withCell.rate,
        r7Without: withoutCell.rate,
      }
    }),
  )

  const withR7 = pooledDayN(withAction, 7, todayKey, MIN_AHA_SAMPLE)
  const withoutR7 = pooledDayN(withoutAction, 7, todayKey, MIN_AHA_SAMPLE)
  const difference =
    !withR7.thin && !withoutR7.thin && withR7.rate != null && withoutR7.rate != null
      ? withR7.rate - withoutR7.rate
      : null

  return {
    timezone: 'Europe/Moscow',
    generatedAt: now.toISOString(),
    formula: 'exact_day_n_msk',
    range: { preset: range.preset, fromKey: range.fromKey, toKey: range.toKey },
    action,
    actionLabel: ACTION_LABEL[action],
    caption: correlationCaption(ACTION_LABEL[action], difference),
    disclaimer: 'Корреляция, не причинно-следственная связь.',
    windowDays: AHA_WINDOW_DAYS,
    minSample: MIN_AHA_SAMPLE,
    withAction: compareGroup(withAction, todayKey, counts),
    withoutAction: compareGroup(withoutAction, todayKey, counts),
    candidates,
  }
}

export function parseAhaAction(raw: string | null | undefined): AhaAction {
  return isAhaAction(raw) ? raw : 'like_sent'
}
