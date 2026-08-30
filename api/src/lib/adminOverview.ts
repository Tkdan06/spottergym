import { prisma } from '../db.js'
import {
  addMoscowDays,
  moscowDayKey,
  moscowDayStartUtc,
  type AdminRetentionPoint,
} from './adminAnalytics.js'

export const OVERVIEW_PRESETS = ['today', '7d', '30d', '90d', '12m', 'custom'] as const
export type OverviewPreset = (typeof OVERVIEW_PRESETS)[number]

export const OVERVIEW_TIMEZONE = 'Europe/Moscow' as const
const MSK_DAY_MS = 24 * 60 * 60 * 1000
const MAX_RANGE_DAYS = 366
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

export type OverviewRangeQuery = {
  preset?: string | null
  from?: string | null
  to?: string | null
}

export type OverviewRange = {
  preset: OverviewPreset
  from: Date
  to: Date
  fromKey: string
  toKey: string
  timezone: typeof OVERVIEW_TIMEZONE
}

export type OverviewRangeError = { error: string }

export type OverviewFunnelStepId = 'registered' | 'entered' | 'meaningful' | 'returned'

export type OverviewFunnelStep = {
  id: OverviewFunnelStepId
  label: string
  users: number
  conversion: number | null
  dropOff: number
  dropOffRate: number | null
  worst: boolean
}

export type OverviewSignals = {
  social: {
    profilesViewed: number
    likes: number
    requests: number
    acceptedRequests: number
    chats: number
  }
  training: {
    workouts: number
    checkIns: number
    activeTrainingDays: number
  }
  ai: {
    users: number
    analysesRequested: number
    analysesGenerated: number
  }
}

export type AdminOverview = {
  timezone: typeof OVERVIEW_TIMEZONE
  generatedAt: string
  range: {
    preset: OverviewPreset
    from: string
    to: string
    fromKey: string
    toKey: string
  }
  kpi: {
    registrations: number
    activeUsers: number
    dau: number
    wau: number
    mau: number
    activationRate: number | null
    r7: AdminRetentionPoint
    r30: AdminRetentionPoint
    workouts: number
    checkIns: number
    socialActions: number
    aiUsers: number
  }
  funnel: OverviewFunnelStep[]
  signals: OverviewSignals
  retention: {
    r1: AdminRetentionPoint
    r7: AdminRetentionPoint
    r30: AdminRetentionPoint
  }
  notes: {
    gymNotRequired: true
    lastSeenSnapshot: true
    retentionFormula: 'exact_day_n_msk'
  }
}

const FUNNEL_LABELS: Record<OverviewFunnelStepId, string> = {
  registered: 'Регистрация',
  entered: 'Вход в продукт',
  meaningful: 'Meaningful action',
  returned: 'Возврат',
}

export function isOverviewPreset(value: string | null | undefined): value is OverviewPreset {
  return !!value && (OVERVIEW_PRESETS as readonly string[]).includes(value)
}

export function isMoscowDayKey(value: string): boolean {
  if (!DAY_RE.test(value)) return false
  const t = Date.parse(`${value}T00:00:00+03:00`)
  return Number.isFinite(t) && moscowDayKey(new Date(t)) === value
}

function inclusiveDayCount(fromKey: string, toKey: string): number {
  const from = moscowDayStartUtc(fromKey).getTime()
  const to = moscowDayStartUtc(toKey).getTime()
  return Math.floor((to - from) / MSK_DAY_MS) + 1
}

function clampRangeEnd(toKey: string, now: Date): Date {
  const tomorrow = moscowDayStartUtc(addMoscowDays(toKey, 1))
  return tomorrow.getTime() <= now.getTime() ? tomorrow : now
}

export function parseOverviewRange(
  query: OverviewRangeQuery,
  now = new Date(),
): OverviewRange | OverviewRangeError {
  const todayKey = moscowDayKey(now)
  const rawPreset = (query.preset || '').trim() || '7d'
  if (!isOverviewPreset(rawPreset)) {
    return { error: 'Неизвестный период' }
  }

  let fromKey: string
  let toKey: string

  if (rawPreset === 'custom') {
    const fromRaw = (query.from || '').trim()
    const toRaw = (query.to || '').trim()
    if (!fromRaw || !toRaw) return { error: 'Укажи даты «с» и «по»' }
    if (!isMoscowDayKey(fromRaw) || !isMoscowDayKey(toRaw)) {
      return { error: 'Даты должны быть в формате ГГГГ-ММ-ДД' }
    }
    fromKey = fromRaw
    toKey = toRaw
  } else if (rawPreset === 'today') {
    fromKey = todayKey
    toKey = todayKey
  } else {
    const days =
      rawPreset === '7d' ? 7 : rawPreset === '30d' ? 30 : rawPreset === '90d' ? 90 : 365
    toKey = todayKey
    fromKey = addMoscowDays(todayKey, -(days - 1))
  }

  if (fromKey > toKey) return { error: 'Дата «с» позже даты «по»' }
  if (fromKey > todayKey) return { error: 'Период не может начинаться в будущем' }
  if (toKey > todayKey) toKey = todayKey
  if (inclusiveDayCount(fromKey, toKey) > MAX_RANGE_DAYS) {
    return { error: 'Период не длиннее 12 месяцев' }
  }

  const from = moscowDayStartUtc(fromKey)
  const to = clampRangeEnd(toKey, now)
  if (from.getTime() >= to.getTime()) {
    return { error: 'Пустой период' }
  }

  return {
    preset: rawPreset,
    from,
    to,
    fromKey,
    toKey,
    timezone: OVERVIEW_TIMEZONE,
  }
}

function n(value: bigint | number | null | undefined): number {
  if (value == null) return 0
  const raw = typeof value === 'bigint' ? Number(value) : value
  if (!Number.isFinite(raw) || raw < 0) return 0
  return Math.round(raw)
}

function rate(part: number, whole: number): number | null {
  if (whole <= 0) return null
  return part / whole
}

export function clampFunnelCounts(input: {
  registered: number
  entered: number
  meaningful: number
  returned: number
}) {
  const registered = Math.max(0, n(input.registered))
  const entered = Math.min(registered, Math.max(0, n(input.entered)))
  const meaningful = Math.min(entered, Math.max(0, n(input.meaningful)))
  const returned = Math.min(meaningful, Math.max(0, n(input.returned)))
  return { registered, entered, meaningful, returned }
}

export function buildFunnelSteps(input: {
  registered: number
  entered: number
  meaningful: number
  returned: number
}): OverviewFunnelStep[] {
  const counts = clampFunnelCounts(input)
  const ordered: OverviewFunnelStepId[] = ['registered', 'entered', 'meaningful', 'returned']
  const values = [counts.registered, counts.entered, counts.meaningful, counts.returned]

  const steps: OverviewFunnelStep[] = ordered.map((id, i) => {
    const users = values[i]
    const prev = i === 0 ? users : values[i - 1]
    const dropOff = i === 0 ? 0 : Math.max(0, prev - users)
    return {
      id,
      label: FUNNEL_LABELS[id],
      users,
      conversion: i === 0 ? (users > 0 ? 1 : null) : rate(users, prev),
      dropOff,
      dropOffRate: i === 0 ? null : rate(dropOff, prev),
      worst: false,
    }
  })

  let worstIndex = -1
  let worstDrop = 0
  let worstRate = -1
  for (let i = 1; i < steps.length; i++) {
    const step = steps[i]
    if (step.dropOff > worstDrop || (step.dropOff === worstDrop && step.dropOff > 0 && (step.dropOffRate ?? 0) > worstRate)) {
      worstDrop = step.dropOff
      worstRate = step.dropOffRate ?? 0
      worstIndex = i
    }
  }
  if (worstIndex >= 0 && worstDrop > 0) steps[worstIndex].worst = true
  return steps
}

export function averageCohortRates(
  day: number,
  buckets: { total: number; retained: number }[],
): AdminRetentionPoint {
  let cohortUsers = 0
  let retained = 0
  let cohorts = 0
  let rateSum = 0
  for (const bucket of buckets) {
    if (bucket.total <= 0) continue
    cohorts += 1
    cohortUsers += bucket.total
    retained += bucket.retained
    rateSum += bucket.retained / bucket.total
  }
  return {
    day,
    rate: cohorts > 0 ? rateSum / cohorts : null,
    cohorts,
    cohortUsers,
    retained,
  }
}

export function formatOverviewCount(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return Math.round(value).toLocaleString('ru-RU')
}

export async function buildAdminOverview(range: OverviewRange): Promise<AdminOverview> {
  const now = new Date()
  const todayKey = moscowDayKey(now)
  const { from, to, fromKey, toKey } = range
  const wauStart = new Date(Math.max(from.getTime(), to.getTime() - 7 * MSK_DAY_MS))
  const mauStart = new Date(Math.max(from.getTime(), to.getTime() - 30 * MSK_DAY_MS))
  const dauStart = moscowDayStartUtc(toKey)

  const [kpiRows, funnelRows, signalRows, r1Buckets, r7Buckets, r30Buckets] = await Promise.all([
    prisma.$queryRaw<
      [{ registrations: bigint; activeUsers: bigint; dau: bigint; wau: bigint; mau: bigint }]
    >`
      SELECT
        COUNT(*) FILTER (
          WHERE u."registeredAt" >= ${from} AND u."registeredAt" < ${to}
        )::bigint AS registrations,
        COUNT(*) FILTER (
          WHERE u."lastSeenAt" >= ${from} AND u."lastSeenAt" < ${to}
        )::bigint AS "activeUsers",
        COUNT(*) FILTER (
          WHERE u."lastSeenAt" >= ${dauStart} AND u."lastSeenAt" < ${to}
        )::bigint AS dau,
        COUNT(*) FILTER (
          WHERE u."lastSeenAt" >= ${wauStart} AND u."lastSeenAt" < ${to}
        )::bigint AS wau,
        COUNT(*) FILTER (
          WHERE u."lastSeenAt" >= ${mauStart} AND u."lastSeenAt" < ${to}
        )::bigint AS mau
      FROM "User" u
      WHERE u."deletedAt" IS NULL
    `,
    prisma.$queryRaw<
      [{ registered: bigint; entered: bigint; meaningful: bigint; returned: bigint }]
    >`
      WITH regs AS (
        SELECT u.id, u."registeredAt", u."lastSeenAt"
        FROM "User" u
        WHERE u."deletedAt" IS NULL
          AND u."registeredAt" >= ${from}
          AND u."registeredAt" < ${to}
      ),
      acted AS (
        SELECT DISTINCT x.uid AS id
        FROM (
          SELECT l."fromUserId" AS uid
          FROM "Like" l
          INNER JOIN regs r ON r.id = l."fromUserId"
          WHERE l."createdAt" >= r."registeredAt" AND l."createdAt" < ${to}
          UNION
          SELECT c."initiatedById"
          FROM "Conversation" c
          INNER JOIN regs r ON r.id = c."initiatedById"
          WHERE c."createdAt" >= r."registeredAt" AND c."createdAt" < ${to}
          UNION
          SELECT m."senderId"
          FROM "ChatMessage" m
          INNER JOIN regs r ON r.id = m."senderId"
          WHERE m."createdAt" >= r."registeredAt" AND m."createdAt" < ${to}
          UNION
          SELECT w."userId"
          FROM "WorkoutSession" w
          INNER JOIN regs r ON r.id = w."userId"
          WHERE w."performedAt" >= r."registeredAt" AND w."performedAt" < ${to}
          UNION
          SELECT k."userId"
          FROM "CheckIn" k
          INNER JOIN regs r ON r.id = k."userId"
          WHERE k."checkedInAt" >= r."registeredAt" AND k."checkedInAt" < ${to}
          UNION
          SELECT e."userId"
          FROM "LandingEvent" e
          INNER JOIN regs r ON r.id = e."userId"
          WHERE e."userId" IS NOT NULL
            AND e.name IN ('people_list_viewed', 'profile_viewed')
            AND e."createdAt" >= r."registeredAt"
            AND e."createdAt" < ${to}
        ) x
      ),
      entered AS (
        SELECT id FROM regs
        WHERE "lastSeenAt" > "registeredAt" + interval '2 minutes'
        UNION
        SELECT id FROM acted
      ),
      returned AS (
        SELECT r.id
        FROM regs r
        INNER JOIN acted a ON a.id = r.id
        WHERE (timezone('Europe/Moscow', r."lastSeenAt"))::date
            > (timezone('Europe/Moscow', r."registeredAt"))::date
      )
      SELECT
        (SELECT COUNT(*) FROM regs)::bigint AS registered,
        (SELECT COUNT(*) FROM entered)::bigint AS entered,
        (SELECT COUNT(*) FROM acted)::bigint AS meaningful,
        (SELECT COUNT(*) FROM returned)::bigint AS returned
    `,
    prisma.$queryRaw<
      [
        {
          profilesViewed: bigint
          likes: bigint
          requests: bigint
          acceptedRequests: bigint
          chats: bigint
          workouts: bigint
          checkIns: bigint
          activeTrainingDays: bigint
          aiUsers: bigint
          analysesRequested: bigint
          analysesGenerated: bigint
        },
      ]
    >`
      SELECT
        (
          SELECT COUNT(*)::bigint
          FROM "LandingEvent" e
          WHERE e.name = 'profile_viewed'
            AND e."createdAt" >= ${from}
            AND e."createdAt" < ${to}
        ) AS "profilesViewed",
        (
          SELECT COUNT(*)::bigint
          FROM "Like" l
          INNER JOIN "User" u ON u.id = l."fromUserId" AND u."deletedAt" IS NULL
          WHERE l."createdAt" >= ${from} AND l."createdAt" < ${to}
        ) AS likes,
        (
          SELECT COUNT(*)::bigint
          FROM "Conversation" c
          INNER JOIN "User" u ON u.id = c."initiatedById" AND u."deletedAt" IS NULL
          WHERE c."createdAt" >= ${from} AND c."createdAt" < ${to}
        ) AS requests,
        (
          SELECT COUNT(*)::bigint
          FROM "LandingEvent" e
          WHERE e.name = 'chat_request_accepted'
            AND e."createdAt" >= ${from}
            AND e."createdAt" < ${to}
        ) AS "acceptedRequests",
        (
          SELECT COUNT(DISTINCT m."conversationId")::bigint
          FROM "ChatMessage" m
          INNER JOIN "User" u ON u.id = m."senderId" AND u."deletedAt" IS NULL
          WHERE m."createdAt" >= ${from} AND m."createdAt" < ${to}
        ) AS chats,
        (
          SELECT COUNT(*)::bigint
          FROM "WorkoutSession" w
          INNER JOIN "User" u ON u.id = w."userId" AND u."deletedAt" IS NULL
          WHERE w."performedAt" >= ${from} AND w."performedAt" < ${to}
        ) AS workouts,
        (
          SELECT COUNT(*)::bigint
          FROM "CheckIn" k
          INNER JOIN "User" u ON u.id = k."userId" AND u."deletedAt" IS NULL
          WHERE k."checkedInAt" >= ${from} AND k."checkedInAt" < ${to}
        ) AS "checkIns",
        (
          SELECT COUNT(*)::bigint
          FROM (
            SELECT DISTINCT w."userId", (timezone('Europe/Moscow', w."performedAt"))::date AS d
            FROM "WorkoutSession" w
            INNER JOIN "User" u ON u.id = w."userId" AND u."deletedAt" IS NULL
            WHERE w."performedAt" >= ${from} AND w."performedAt" < ${to}
          ) t
        ) AS "activeTrainingDays",
        (
          SELECT COUNT(*)::bigint
          FROM (
            SELECT w."userId"
            FROM "WorkoutAiInsight" w
            INNER JOIN "User" u ON u.id = w."userId" AND u."deletedAt" IS NULL
            WHERE w."createdAt" >= ${from} AND w."createdAt" < ${to}
            UNION
            SELECT e."userId"
            FROM "LandingEvent" e
            INNER JOIN "User" u ON u.id = e."userId" AND u."deletedAt" IS NULL
            WHERE e."userId" IS NOT NULL
              AND e.name IN ('ai_analysis_requested', 'ai_analysis_completed')
              AND e."createdAt" >= ${from}
              AND e."createdAt" < ${to}
          ) a
        ) AS "aiUsers",
        (
          SELECT COUNT(*)::bigint
          FROM "LandingEvent" e
          WHERE e.name = 'ai_analysis_requested'
            AND e."createdAt" >= ${from}
            AND e."createdAt" < ${to}
        ) AS "analysesRequested",
        (
          SELECT COUNT(*)::bigint
          FROM "WorkoutAiInsight" w
          INNER JOIN "User" u ON u.id = w."userId" AND u."deletedAt" IS NULL
          WHERE w."createdAt" >= ${from} AND w."createdAt" < ${to}
        ) AS "analysesGenerated"
    `,
    retentionBuckets(1, from, to, todayKey),
    retentionBuckets(7, from, to, todayKey),
    retentionBuckets(30, from, to, todayKey),
  ])

  const kpi = kpiRows[0]
  const funnelRaw = funnelRows[0]
  const signalsRaw = signalRows[0]
  const funnelCounts = clampFunnelCounts({
    registered: n(funnelRaw?.registered),
    entered: n(funnelRaw?.entered),
    meaningful: n(funnelRaw?.meaningful),
    returned: n(funnelRaw?.returned),
  })
  const funnel = buildFunnelSteps(funnelCounts)
  const r1 = averageCohortRates(1, r1Buckets)
  const r7 = averageCohortRates(7, r7Buckets)
  const r30 = averageCohortRates(30, r30Buckets)
  const workouts = n(signalsRaw?.workouts)
  const checkIns = n(signalsRaw?.checkIns)
  const likes = n(signalsRaw?.likes)
  const requests = n(signalsRaw?.requests)
  const acceptedRequests = n(signalsRaw?.acceptedRequests)
  const chats = n(signalsRaw?.chats)
  const aiUsers = n(signalsRaw?.aiUsers)

  return {
    timezone: OVERVIEW_TIMEZONE,
    generatedAt: now.toISOString(),
    range: {
      preset: range.preset,
      from: from.toISOString(),
      to: to.toISOString(),
      fromKey,
      toKey,
    },
    kpi: {
      registrations: n(kpi?.registrations),
      activeUsers: n(kpi?.activeUsers),
      dau: n(kpi?.dau),
      wau: n(kpi?.wau),
      mau: n(kpi?.mau),
      activationRate: rate(funnelCounts.meaningful, funnelCounts.registered),
      r7,
      r30,
      workouts,
      checkIns,
      socialActions: likes + requests + acceptedRequests + chats,
      aiUsers,
    },
    funnel,
    signals: {
      social: {
        profilesViewed: n(signalsRaw?.profilesViewed),
        likes,
        requests,
        acceptedRequests,
        chats,
      },
      training: {
        workouts,
        checkIns,
        activeTrainingDays: n(signalsRaw?.activeTrainingDays),
      },
      ai: {
        users: aiUsers,
        analysesRequested: n(signalsRaw?.analysesRequested),
        analysesGenerated: n(signalsRaw?.analysesGenerated),
      },
    },
    retention: { r1, r7, r30 },
    notes: {
      gymNotRequired: true,
      lastSeenSnapshot: true,
      retentionFormula: 'exact_day_n_msk',
    },
  }
}

async function retentionBuckets(
  nDays: number,
  from: Date,
  to: Date,
  todayKey: string,
): Promise<{ total: number; retained: number }[]> {
  const latestObservable = addMoscowDays(todayKey, -(nDays + 1))
  const rows = await prisma.$queryRaw<{ total: bigint; retained: bigint }[]>`
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (
        WHERE (timezone('Europe/Moscow', u."lastSeenAt"))::date
            = (timezone('Europe/Moscow', u."registeredAt"))::date + ${nDays}
      )::bigint AS retained
    FROM "User" u
    WHERE u."deletedAt" IS NULL
      AND u."registeredAt" >= ${from}
      AND u."registeredAt" < ${to}
      AND (timezone('Europe/Moscow', u."registeredAt"))::date <= ${latestObservable}::date
    GROUP BY (timezone('Europe/Moscow', u."registeredAt"))::date
  `
  return rows.map((row) => ({ total: n(row.total), retained: n(row.retained) }))
}
