import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import { moscowDayKey } from './adminAnalytics.js'
import { type OverviewRange } from './adminOverview.js'
import { pooledDayN } from './adminCohortsMath.js'
import { LANDING_EVENT_NAMES } from './landingAnalytics.js'
import {
  attributeRegistration,
  classifyChannel,
  growthFunnelRates,
  isActivated,
  isSearchTouch,
  realKeyword,
  sourceKey,
  type GrowthView,
  type RawTouch,
} from './adminGrowthMath.js'

const LANDING_NAMES = [...LANDING_EVENT_NAMES]
const MIN_CELL = 8

type VisitorRow = {
  visitorId: string
  createdAt: Date
  utmSource: string
  utmMedium: string
  utmCampaign: string
  utmContent: string
  utmTerm: string
  referrer: string
  searchEngine: string
  searchKeyword: string
  searchPaid: boolean
  fromParam: string
}

type LinkedRow = { visitorId: string; userId: string }

type UserRow = {
  id: string
  registeredAt: Date
  lastSeenAt: Date
  homeGymId: string | null
}

export type GrowthFunnelStep = {
  id: string
  label: string
  users: number
  conversion: number | null
}

export type SourceQualityRow = {
  source: string
  channel: string
  visitors: number
  registrations: number
  activation: number
  activationRate: number | null
  r7: number | null
  r30: number | null
  r7Eligible: number
  r30Eligible: number
  thin: boolean
}

export type AdminGrowthPayload = {
  view: GrowthView
  timezone: 'Europe/Moscow'
  generatedAt: string
  range: { preset: OverviewRange['preset']; fromKey: string; toKey: string }
  funnel: GrowthFunnelStep[]
  sources: SourceQualityRow[]
  landing?: {
    views: number
    uniqueVisitors: number
    ctaRegister: number
    registerSuccess: number
    byCampaign: { key: string; visitors: number; registrations: number }[]
    byContent: { key: string; visitors: number }[]
    byTerm: { key: string; visitors: number }[]
    byReferrer: { key: string; visitors: number }[]
  }
  seo?: {
    visits: number
    registrations: number
    activation: number
    r7: number | null
    r30: number | null
    engines: { engine: string; paid: boolean; visitors: number; registrations: number }[]
    keywords: { keyword: string; engine: string; visitors: number; registrations: number }[]
    unknownKeywords: number
  }
  referral?: {
    invites: number
    opens: number
    opensAvailable: false
    registrations: number
    activation: number
    r7: number | null
    r30: number | null
    quality: { invited: number; activated: number; retainedR7: number; retainedR30: number }
  }
  cross?: { source: string; gym: string; registrations: number; activation: number; r7: number | null }[]
}

function rate(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null
}

function touchOf(row: VisitorRow): RawTouch {
  return {
    utmSource: row.utmSource,
    utmMedium: row.utmMedium,
    utmCampaign: row.utmCampaign,
    utmContent: row.utmContent,
    utmTerm: row.utmTerm,
    referrer: row.referrer,
    searchEngine: row.searchEngine,
    searchKeyword: row.searchKeyword,
    searchPaid: row.searchPaid,
    fromParam: row.fromParam,
  }
}

async function loadMeaningful(ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set()
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT DISTINCT x.id
    FROM (
      SELECT l."fromUserId" AS id FROM "Like" l WHERE l."fromUserId" IN (${Prisma.join(ids)})
      UNION
      SELECT c."initiatedById" FROM "Conversation" c WHERE c."initiatedById" IN (${Prisma.join(ids)})
      UNION
      SELECT m."senderId" FROM "ChatMessage" m WHERE m."senderId" IN (${Prisma.join(ids)})
      UNION
      SELECT w."userId" FROM "WorkoutSession" w WHERE w."userId" IN (${Prisma.join(ids)})
      UNION
      SELECT k."userId" FROM "CheckIn" k WHERE k."userId" IN (${Prisma.join(ids)})
      UNION
      SELECT e."userId" FROM "LandingEvent" e
      WHERE e."userId" IN (${Prisma.join(ids)})
        AND e.name IN ('people_list_viewed', 'profile_viewed')
    ) x
  `
  return new Set(rows.map((row) => row.id))
}

function userFlags(
  user: UserRow,
  meaningful: Set<string>,
  todayKey: string,
) {
  const acted = meaningful.has(user.id)
  const activated = isActivated({
    registeredAt: user.registeredAt,
    lastSeenAt: user.lastSeenAt,
    meaningful: acted,
  })
  const r7 = pooledDayN([user], 7, todayKey, 1)
  const r30 = pooledDayN([user], 30, todayKey, 1)
  return { acted, activated, r7, r30 }
}

function buildFunnel(
  visitors: number,
  users: UserRow[],
  meaningful: Set<string>,
  todayKey: string,
): GrowthFunnelStep[] {
  let activation = 0
  let acted = 0
  for (const user of users) {
    const flags = userFlags(user, meaningful, todayKey)
    if (flags.activated) activation += 1
    if (flags.acted) acted += 1
  }
  const r7 = pooledDayN(users, 7, todayKey, 1)
  const r30 = pooledDayN(users, 30, todayKey, 1)
  const counts = {
    visitors,
    registrations: users.length,
    activation,
    meaningful: acted,
    r7: r7.retained,
    r30: r30.retained,
  }
  const rates = growthFunnelRates(counts)
  return [
    { id: 'visitors', label: 'Landing visitor', users: visitors, conversion: visitors > 0 ? 1 : null },
    { id: 'registration', label: 'Registration', users: users.length, conversion: rates.visitorToReg },
    { id: 'activation', label: 'Activation', users: activation, conversion: rates.regToActivation },
    { id: 'meaningful', label: 'Meaningful action', users: acted, conversion: rates.activationToMeaningful },
    {
      id: 'r7',
      label: 'R7',
      users: r7.retained,
      conversion: r7.eligible > 0 ? r7.retained / r7.eligible : null,
    },
    {
      id: 'r30',
      label: 'R30',
      users: r30.retained,
      conversion: r30.eligible > 0 ? r30.retained / r30.eligible : null,
    },
  ]
}

function sourceRows(
  visitors: VisitorRow[],
  attributed: Map<string, UserRow>,
  invitees: Set<string>,
  meaningful: Set<string>,
  todayKey: string,
): SourceQualityRow[] {
  const buckets = new Map<
    string,
    { channel: string; visitorIds: string[]; users: UserRow[] }
  >()
  for (const visitor of visitors) {
    const user = attributed.get(visitor.visitorId)
    const invitee = !!(user && invitees.has(user.id))
    const key = sourceKey(touchOf(visitor), invitee)
    const channel = classifyChannel(touchOf(visitor), invitee)
    const bucket = buckets.get(key) || { channel, visitorIds: [], users: [] }
    bucket.visitorIds.push(visitor.visitorId)
    if (user) bucket.users.push(user)
    buckets.set(key, bucket)
  }
  return [...buckets.entries()]
    .map(([source, bucket]) => {
      let activation = 0
      for (const user of bucket.users) {
        if (userFlags(user, meaningful, todayKey).activated) activation += 1
      }
      const r7 = pooledDayN(bucket.users, 7, todayKey, MIN_CELL)
      const r30 = pooledDayN(bucket.users, 30, todayKey, MIN_CELL)
      return {
        source,
        channel: bucket.channel,
        visitors: new Set(bucket.visitorIds).size,
        registrations: bucket.users.length,
        activation,
        activationRate: rate(activation, bucket.users.length),
        r7: r7.thin ? null : r7.rate,
        r30: r30.thin ? null : r30.rate,
        r7Eligible: r7.eligible,
        r30Eligible: r30.eligible,
        thin: r7.thin || r30.thin,
      }
    })
    .sort((a, b) => b.visitors - a.visitors || b.registrations - a.registrations)
    .slice(0, 40)
}

export async function buildAdminGrowth(
  view: GrowthView,
  range: OverviewRange,
): Promise<AdminGrowthPayload> {
  const now = new Date()
  const todayKey = moscowDayKey(now)
  const { from, to } = range

  const [visitors, linked, inviteRows, gyms, landingNames] = await Promise.all([
    prisma.$queryRaw<VisitorRow[]>`
      SELECT DISTINCT ON (e."visitorId")
        e."visitorId" AS "visitorId",
        e."createdAt" AS "createdAt",
        e."utmSource" AS "utmSource",
        e."utmMedium" AS "utmMedium",
        e."utmCampaign" AS "utmCampaign",
        e."utmContent" AS "utmContent",
        e."utmTerm" AS "utmTerm",
        e."referrer" AS referrer,
        e."searchEngine" AS "searchEngine",
        e."searchKeyword" AS "searchKeyword",
        e."searchPaid" AS "searchPaid",
        e."fromParam" AS "fromParam"
      FROM "LandingEvent" e
      WHERE e.name = 'view'
        AND e."createdAt" >= ${from}
        AND e."createdAt" < ${to}
      ORDER BY e."visitorId", e."createdAt"
    `,
    prisma.$queryRaw<LinkedRow[]>`
      SELECT DISTINCT ON (e."visitorId") e."visitorId" AS "visitorId", e."userId" AS "userId"
      FROM "LandingEvent" e
      WHERE e."userId" IS NOT NULL
        AND e.name IN (${Prisma.join(LANDING_NAMES)})
        AND EXISTS (
          SELECT 1 FROM "LandingEvent" v
          WHERE v."visitorId" = e."visitorId"
            AND v.name = 'view'
            AND v."createdAt" >= ${from}
            AND v."createdAt" < ${to}
        )
      ORDER BY e."visitorId", e."createdAt"
    `,
    prisma.invite.findMany({
      select: { inviteeId: true, createdAt: true },
    }),
    prisma.gym.findMany({ select: { id: true, name: true, network: true } }),
    prisma.$queryRaw<{ name: string; events: bigint; visitors: bigint }[]>`
      SELECT e.name AS name, COUNT(*)::bigint AS events, COUNT(DISTINCT e."visitorId")::bigint AS visitors
      FROM "LandingEvent" e
      WHERE e.name IN (${Prisma.join(LANDING_NAMES)})
        AND e."createdAt" >= ${from}
        AND e."createdAt" < ${to}
      GROUP BY e.name
    `,
  ])

  const invitees = new Set(inviteRows.map((row) => row.inviteeId))
  const userIds = [...new Set(linked.map((row) => row.userId))]
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds }, deletedAt: null },
        select: { id: true, registeredAt: true, lastSeenAt: true, homeGymId: true },
      })
    : []
  const userById = new Map(users.map((user) => [user.id, user]))
  const firstView = new Map(visitors.map((row) => [row.visitorId, row.createdAt.getTime()]))
  const attributed = new Map<string, UserRow>()
  for (const row of linked) {
    const user = userById.get(row.userId)
    const viewAt = firstView.get(row.visitorId)
    if (!user || viewAt == null) continue
    if (!attributeRegistration(viewAt, user.registeredAt.getTime())) continue
    attributed.set(row.visitorId, user)
  }
  const attributedUsers = [...new Map([...attributed.values()].map((user) => [user.id, user])).values()]
  const meaningful = await loadMeaningful(attributedUsers.map((user) => user.id))
  const funnel = buildFunnel(visitors.length, attributedUsers, meaningful, todayKey)
  const sources = sourceRows(visitors, attributed, invitees, meaningful, todayKey)

  const base: AdminGrowthPayload = {
    view,
    timezone: 'Europe/Moscow',
    generatedAt: now.toISOString(),
    range: { preset: range.preset, fromKey: range.fromKey, toKey: range.toKey },
    funnel,
    sources,
  }

  if (view === 'acquisition' || view === 'landing') {
    const gymLabel = new Map(
      gyms.map((g) => [g.id, `${g.network} · ${g.name}`]),
    )
    const byCampaign = new Map<string, { visitors: number; registrations: number }>()
    const byContent = new Map<string, number>()
    const byTerm = new Map<string, number>()
    const byReferrer = new Map<string, number>()
    const crossMap = new Map<string, UserRow[]>()
    for (const visitor of visitors) {
      const user = attributed.get(visitor.visitorId)
      const campaign = visitor.utmCampaign.trim()
      if (campaign) {
        const cur = byCampaign.get(campaign) || { visitors: 0, registrations: 0 }
        cur.visitors += 1
        if (user) cur.registrations += 1
        byCampaign.set(campaign, cur)
      }
      if (visitor.utmContent.trim()) {
        byContent.set(visitor.utmContent.trim(), (byContent.get(visitor.utmContent.trim()) || 0) + 1)
      }
      if (visitor.utmTerm.trim()) {
        byTerm.set(visitor.utmTerm.trim(), (byTerm.get(visitor.utmTerm.trim()) || 0) + 1)
      }
      if (visitor.referrer.trim()) {
        const host = visitor.referrer.trim().slice(0, 80)
        byReferrer.set(host, (byReferrer.get(host) || 0) + 1)
      }
      if (user) {
        const src = sourceKey(touchOf(visitor), invitees.has(user.id))
        const gym = user.homeGymId ? gymLabel.get(user.homeGymId) || user.homeGymId : 'без зала'
        const key = `${src}\0${gym}`
        const list = crossMap.get(key) || []
        list.push(user)
        crossMap.set(key, list)
      }
    }
    const nameMap = new Map(landingNames.map((row) => [row.name, row]))
    base.landing = {
      views: Number(nameMap.get('view')?.events || 0),
      uniqueVisitors: visitors.length,
      ctaRegister: Number(nameMap.get('cta_register')?.events || 0),
      registerSuccess: Number(nameMap.get('register_success')?.events || 0),
      byCampaign: [...byCampaign.entries()]
        .map(([key, v]) => ({ key, ...v }))
        .sort((a, b) => b.visitors - a.visitors)
        .slice(0, 20),
      byContent: [...byContent.entries()]
        .map(([key, visitorsN]) => ({ key, visitors: visitorsN }))
        .sort((a, b) => b.visitors - a.visitors)
        .slice(0, 15),
      byTerm: [...byTerm.entries()]
        .map(([key, visitorsN]) => ({ key, visitors: visitorsN }))
        .sort((a, b) => b.visitors - a.visitors)
        .slice(0, 15),
      byReferrer: [...byReferrer.entries()]
        .map(([key, visitorsN]) => ({ key, visitors: visitorsN }))
        .sort((a, b) => b.visitors - a.visitors)
        .slice(0, 15),
    }
    base.cross = [...crossMap.entries()]
      .map(([key, list]) => {
        const [source, gym] = key.split('\0')
        let activation = 0
        for (const user of list) {
          if (userFlags(user, meaningful, todayKey).activated) activation += 1
        }
        const r7 = pooledDayN(list, 7, todayKey, MIN_CELL)
        return {
          source,
          gym,
          registrations: list.length,
          activation,
          r7: r7.thin ? null : r7.rate,
        }
      })
      .sort((a, b) => b.registrations - a.registrations)
      .slice(0, 20)
  }

  if (view === 'seo') {
    const searchVisitors = visitors.filter((row) => isSearchTouch(touchOf(row)))
    const searchUsers: UserRow[] = []
    const engines = new Map<string, { engine: string; paid: boolean; visitors: number; registrations: number }>()
    const keywords = new Map<string, { keyword: string; engine: string; visitors: number; registrations: number }>()
    let unknownKeywords = 0
    for (const visitor of searchVisitors) {
      const user = attributed.get(visitor.visitorId)
      if (user) searchUsers.push(user)
      const paid = !!visitor.searchPaid
      const engineKey = `${visitor.searchEngine}:${paid ? 'paid' : 'org'}`
      const eng = engines.get(engineKey) || {
        engine: visitor.searchEngine,
        paid,
        visitors: 0,
        registrations: 0,
      }
      eng.visitors += 1
      if (user) eng.registrations += 1
      engines.set(engineKey, eng)
      const keyword = realKeyword(touchOf(visitor))
      if (!keyword) {
        unknownKeywords += 1
        continue
      }
      const kwKey = `${visitor.searchEngine}\0${keyword}`
      const kw = keywords.get(kwKey) || {
        keyword,
        engine: visitor.searchEngine,
        visitors: 0,
        registrations: 0,
      }
      kw.visitors += 1
      if (user) kw.registrations += 1
      keywords.set(kwKey, kw)
    }
    const uniqueSearchUsers = [...new Map(searchUsers.map((user) => [user.id, user])).values()]
    const searchMeaningful = await loadMeaningful(uniqueSearchUsers.map((user) => user.id))
    let activation = 0
    for (const user of uniqueSearchUsers) {
      if (userFlags(user, searchMeaningful, todayKey).activated) activation += 1
    }
    const r7 = pooledDayN(uniqueSearchUsers, 7, todayKey, MIN_CELL)
    const r30 = pooledDayN(uniqueSearchUsers, 30, todayKey, MIN_CELL)
    base.funnel = buildFunnel(searchVisitors.length, uniqueSearchUsers, searchMeaningful, todayKey)
    base.seo = {
      visits: searchVisitors.length,
      registrations: uniqueSearchUsers.length,
      activation,
      r7: r7.thin ? null : r7.rate,
      r30: r30.thin ? null : r30.rate,
      engines: [...engines.values()].sort((a, b) => b.visitors - a.visitors),
      keywords: [...keywords.values()].sort((a, b) => b.visitors - a.visitors).slice(0, 30),
      unknownKeywords,
    }
  }

  if (view === 'referral') {
    const periodInvites = inviteRows.filter((row) => row.createdAt >= from && row.createdAt < to)
    const inviteeIds = [...new Set(periodInvites.map((row) => row.inviteeId))]
    const inviteeUsers = inviteeIds.length
      ? await prisma.user.findMany({
          where: { id: { in: inviteeIds }, deletedAt: null },
          select: { id: true, registeredAt: true, lastSeenAt: true, homeGymId: true },
        })
      : []
    const refMeaningful = await loadMeaningful(inviteeUsers.map((user) => user.id))
    let activation = 0
    for (const user of inviteeUsers) {
      if (userFlags(user, refMeaningful, todayKey).activated) activation += 1
    }
    const r7 = pooledDayN(inviteeUsers, 7, todayKey, MIN_CELL)
    const r30 = pooledDayN(inviteeUsers, 30, todayKey, MIN_CELL)
    base.funnel = [
      { id: 'invite_sent', label: 'Invite sent', users: periodInvites.length, conversion: periodInvites.length ? 1 : null },
      { id: 'invite_opened', label: 'Invite opened', users: 0, conversion: null },
      { id: 'registration', label: 'Registration', users: inviteeUsers.length, conversion: rate(inviteeUsers.length, periodInvites.length) },
      { id: 'activation', label: 'Activation', users: activation, conversion: rate(activation, inviteeUsers.length) },
      { id: 'r7', label: 'R7', users: r7.retained, conversion: r7.eligible > 0 ? r7.retained / r7.eligible : null },
      { id: 'r30', label: 'R30', users: r30.retained, conversion: r30.eligible > 0 ? r30.retained / r30.eligible : null },
    ]
    base.referral = {
      invites: periodInvites.length,
      opens: 0,
      opensAvailable: false,
      registrations: inviteeUsers.length,
      activation,
      r7: r7.thin ? null : r7.rate,
      r30: r30.thin ? null : r30.rate,
      quality: {
        invited: inviteeUsers.length,
        activated: activation,
        retainedR7: r7.retained,
        retainedR30: r30.retained,
      },
    }
  }

  return base
}
