import { prisma } from '../db.js'

export const LANDING_EVENT_NAMES = [
  'view',
  'scroll_50',
  'scroll_90',
  'cta_register',
  'cta_login',
  'register_view',
  'register_success',
] as const

export type LandingEventName = (typeof LANDING_EVENT_NAMES)[number]

export function isLandingEventName(value: string): value is LandingEventName {
  return (LANDING_EVENT_NAMES as readonly string[]).includes(value)
}

function clip(value: string | undefined | null, max: number) {
  return (value || '').trim().slice(0, max)
}

export async function logLandingEvent(input: {
  name: LandingEventName
  visitorId: string
  sessionId?: string
  placement?: string
  path?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
  utmTerm?: string
  fromParam?: string
  referrer?: string
  searchEngine?: string
  searchKeyword?: string
  clickId?: string
  searchPaid?: boolean
  userAgent?: string
  ip?: string
  userId?: string | null
}) {
  const visitorId = clip(input.visitorId, 64)
  if (!visitorId) return { ok: false as const, reason: 'visitor' }

  // Dedupe noisy once-per-session events (refresh / double-mount)
  const sessionId = clip(input.sessionId, 64)
  if (
    sessionId &&
    (input.name === 'view' ||
      input.name === 'scroll_50' ||
      input.name === 'scroll_90' ||
      input.name === 'register_view')
  ) {
    const existing = await prisma.landingEvent.findFirst({
      where: { sessionId, name: input.name },
      select: { id: true },
    })
    if (existing) return { ok: true as const, deduped: true }
  }

  try {
    await prisma.landingEvent.create({
      data: {
        name: input.name,
        visitorId,
        sessionId,
        placement: clip(input.placement, 32),
        path: clip(input.path, 80) || '/lp',
        utmSource: clip(input.utmSource, 80),
        utmMedium: clip(input.utmMedium, 80),
        utmCampaign: clip(input.utmCampaign, 120),
        utmContent: clip(input.utmContent, 120),
        utmTerm: clip(input.utmTerm, 120),
        fromParam: clip(input.fromParam, 40),
        referrer: clip(input.referrer, 500),
        searchEngine: clip(input.searchEngine, 20),
        searchKeyword: clip(input.searchKeyword, 120),
        clickId: clip(input.clickId, 80),
        searchPaid: Boolean(input.searchPaid),
        userAgent: clip(input.userAgent, 240),
        ip: clip(input.ip, 64),
        userId: input.userId || null,
      },
    })
    return { ok: true as const, deduped: false }
  } catch (err) {
    console.warn('[landing] log event failed', err)
    return { ok: false as const, reason: 'db' }
  }
}

type WindowStats = {
  views: number
  uniqueVisitors: number
  scroll50: number
  scroll50Unique: number
  scroll90: number
  scroll90Unique: number
  ctaRegister: number
  ctaRegisterUnique: number
  ctaLogin: number
  ctaByPlacement: Record<string, number>
  registerView: number
  registerViewUnique: number
  registerSuccess: number
  registerSuccessUnique: number
  /** unique visitors who clicked register CTA / unique viewers */
  viewToCtaPct: number | null
  /** unique register success / unique cta register */
  ctaToRegisterPct: number | null
  /** unique register success / unique viewers */
  viewToRegisterPct: number | null
}

async function countName(since: Date, name: LandingEventName) {
  return prisma.landingEvent.count({ where: { createdAt: { gte: since }, name } })
}

async function uniqueVisitorsWhere(
  since: Date,
  extra: { name?: LandingEventName; searchEngine?: string; searchPaid?: boolean } = {},
) {
  const rows = await prisma.landingEvent.groupBy({
    by: ['visitorId'],
    where: {
      createdAt: { gte: since },
      ...(extra.name ? { name: extra.name } : { name: 'view' }),
      ...(extra.searchEngine != null ? { searchEngine: extra.searchEngine } : {}),
      ...(extra.searchPaid != null ? { searchPaid: extra.searchPaid } : {}),
    },
  })
  return rows.length
}

async function uniqueVisitors(since: Date, name?: LandingEventName) {
  return uniqueVisitorsWhere(since, name ? { name } : {})
}

type SearchEngineRow = {
  engine: string
  views: number
  uniqueVisitors: number
  registerSuccess: number
  registerUnique: number
  paidViews: number
  organicViews: number
}

type SearchKeywordRow = {
  keyword: string
  engine: string
  views: number
  registerSuccess: number
}

async function buildSearchWindow(since: Date) {
  const engines = ['google', 'yandex', 'bing', 'other'] as const
  const engineRows: SearchEngineRow[] = []
  for (const engine of engines) {
    const [views, unique, registerSuccess, registerUnique, paidViews, organicViews] = await Promise.all([
      prisma.landingEvent.count({
        where: { createdAt: { gte: since }, name: 'view', searchEngine: engine },
      }),
      uniqueVisitorsWhere(since, { name: 'view', searchEngine: engine }),
      prisma.landingEvent.count({
        where: { createdAt: { gte: since }, name: 'register_success', searchEngine: engine },
      }),
      uniqueVisitorsWhere(since, { name: 'register_success', searchEngine: engine }),
      prisma.landingEvent.count({
        where: { createdAt: { gte: since }, name: 'view', searchEngine: engine, searchPaid: true },
      }),
      prisma.landingEvent.count({
        where: { createdAt: { gte: since }, name: 'view', searchEngine: engine, searchPaid: false },
      }),
    ])
    if (views + registerSuccess === 0) continue
    engineRows.push({
      engine,
      views,
      uniqueVisitors: unique,
      registerSuccess,
      registerUnique,
      paidViews,
      organicViews,
    })
  }
  engineRows.sort((a, b) => b.views - a.views || b.registerSuccess - a.registerSuccess)

  const [viewKw, regKw] = await Promise.all([
    prisma.landingEvent.groupBy({
      by: ['searchKeyword', 'searchEngine'],
      where: {
        createdAt: { gte: since },
        name: 'view',
        searchKeyword: { not: '' },
      },
      _count: { _all: true },
    }),
    prisma.landingEvent.groupBy({
      by: ['searchKeyword', 'searchEngine'],
      where: {
        createdAt: { gte: since },
        name: 'register_success',
        searchKeyword: { not: '' },
      },
      _count: { _all: true },
    }),
  ])

  const kwMap = new Map<string, SearchKeywordRow>()
  for (const row of viewKw) {
    const key = `${row.searchEngine}\0${row.searchKeyword}`
    kwMap.set(key, {
      keyword: row.searchKeyword,
      engine: row.searchEngine,
      views: row._count._all,
      registerSuccess: 0,
    })
  }
  for (const row of regKw) {
    const key = `${row.searchEngine}\0${row.searchKeyword}`
    const cur = kwMap.get(key) || {
      keyword: row.searchKeyword,
      engine: row.searchEngine,
      views: 0,
      registerSuccess: 0,
    }
    cur.registerSuccess += row._count._all
    kwMap.set(key, cur)
  }

  const keywords = [...kwMap.values()]
    .sort((a, b) => b.registerSuccess - a.registerSuccess || b.views - a.views)
    .slice(0, 30)

  const [searchViews, searchRegisters, unknownKeywordViews] = await Promise.all([
    prisma.landingEvent.count({
      where: { createdAt: { gte: since }, name: 'view', searchEngine: { not: '' } },
    }),
    prisma.landingEvent.count({
      where: { createdAt: { gte: since }, name: 'register_success', searchEngine: { not: '' } },
    }),
    prisma.landingEvent.count({
      where: {
        createdAt: { gte: since },
        name: 'view',
        searchEngine: { not: '' },
        searchKeyword: '',
      },
    }),
  ])

  return {
    searchViews,
    searchRegisters,
    unknownKeywordViews,
    engines: engineRows,
    keywords,
  }
}

async function buildWindow(since: Date): Promise<WindowStats> {
  const [
    views,
    uniqueVisitorsCount,
    scroll50,
    scroll50Unique,
    scroll90,
    scroll90Unique,
    ctaRegister,
    ctaRegisterUnique,
    ctaLogin,
    registerView,
    registerViewUnique,
    registerSuccess,
    registerSuccessUnique,
    ctaPlacements,
  ] = await Promise.all([
    countName(since, 'view'),
    uniqueVisitors(since, 'view'),
    countName(since, 'scroll_50'),
    uniqueVisitors(since, 'scroll_50'),
    countName(since, 'scroll_90'),
    uniqueVisitors(since, 'scroll_90'),
    countName(since, 'cta_register'),
    uniqueVisitors(since, 'cta_register'),
    countName(since, 'cta_login'),
    countName(since, 'register_view'),
    uniqueVisitors(since, 'register_view'),
    countName(since, 'register_success'),
    uniqueVisitors(since, 'register_success'),
    prisma.landingEvent.groupBy({
      by: ['placement'],
      where: { createdAt: { gte: since }, name: 'cta_register' },
      _count: { _all: true },
    }),
  ])

  const ctaByPlacement: Record<string, number> = {}
  for (const row of ctaPlacements) {
    const key = row.placement || 'unknown'
    ctaByPlacement[key] = row._count._all
  }

  const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : null)

  return {
    views,
    uniqueVisitors: uniqueVisitorsCount,
    scroll50,
    scroll50Unique,
    scroll90,
    scroll90Unique,
    ctaRegister,
    ctaRegisterUnique,
    ctaLogin,
    ctaByPlacement,
    registerView,
    registerViewUnique,
    registerSuccess,
    registerSuccessUnique,
    viewToCtaPct: pct(ctaRegisterUnique, uniqueVisitorsCount),
    ctaToRegisterPct: pct(registerSuccessUnique, ctaRegisterUnique),
    viewToRegisterPct: pct(registerSuccessUnique, uniqueVisitorsCount),
  }
}

export async function buildLandingAnalytics() {
  const now = Date.now()
  const t24 = new Date(now - 24 * 60 * 60 * 1000)
  const t7 = new Date(now - 7 * 24 * 60 * 60 * 1000)
  const t30 = new Date(now - 30 * 24 * 60 * 60 * 1000)

  const [last24h, last7d, last30d, campaignRows, recent, search7d, search30d] = await Promise.all([
    buildWindow(t24),
    buildWindow(t7),
    buildWindow(t30),
    prisma.landingEvent.groupBy({
      by: ['utmCampaign', 'name'],
      where: { createdAt: { gte: t7 }, name: { in: [...LANDING_EVENT_NAMES] } },
      _count: { _all: true },
    }),
    prisma.landingEvent.findMany({
      where: { name: { in: [...LANDING_EVENT_NAMES] } },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        id: true,
        name: true,
        placement: true,
        utmSource: true,
        utmCampaign: true,
        utmContent: true,
        fromParam: true,
        searchEngine: true,
        searchKeyword: true,
        searchPaid: true,
        visitorId: true,
        createdAt: true,
      },
    }),
    buildSearchWindow(t7),
    buildSearchWindow(t30),
  ])

  type CampaignAgg = {
    campaign: string
    views: number
    ctaRegister: number
    registerSuccess: number
  }
  const byCampaign = new Map<string, CampaignAgg>()
  for (const row of campaignRows) {
    const campaign = row.utmCampaign || '(без utm_campaign)'
    const cur = byCampaign.get(campaign) || {
      campaign,
      views: 0,
      ctaRegister: 0,
      registerSuccess: 0,
    }
    if (row.name === 'view') cur.views += row._count._all
    if (row.name === 'cta_register') cur.ctaRegister += row._count._all
    if (row.name === 'register_success') cur.registerSuccess += row._count._all
    byCampaign.set(campaign, cur)
  }

  const campaigns7d = [...byCampaign.values()]
    .filter((c) => c.views + c.ctaRegister + c.registerSuccess > 0)
    .sort((a, b) => b.views - a.views || b.ctaRegister - a.ctaRegister)
    .slice(0, 20)

  return {
    generatedAt: new Date().toISOString(),
    last24h,
    last7d,
    last30d,
    campaigns7d,
    search7d,
    search30d,
    recent: recent.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      visitorId: r.visitorId.slice(0, 8),
    })),
  }
}
