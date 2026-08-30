import { prisma } from '../db.js'
import { moscowDayKey } from './adminAnalytics.js'
import { type OverviewRange } from './adminOverview.js'
import {
  assembleGymRows,
  currentGymTotals,
  densityReport,
  networkCorrelations,
  networkScatter,
  parseGymSort,
  peopleSurface,
  uniqueCount,
  type GymSortKey,
  type GymRow,
} from './adminGymsMath.js'

export type AdminGymsPayload = {
  timezone: 'Europe/Moscow'
  generatedAt: string
  range: {
    preset: OverviewRange['preset']
    from: string
    to: string
    fromKey: string
    toKey: string
  }
  sort: GymSortKey
  current: ReturnType<typeof currentGymTotals> & {
    noHomeUsers: number
    missingCatalogUsers: number
  }
  density: ReturnType<typeof densityReport> & { note: 'observed_distribution' }
  gyms: GymRow[]
  lowDensity: GymRow[]
  empty: GymRow[]
  network: {
    points: ReturnType<typeof networkScatter>
    correlations: ReturnType<typeof networkCorrelations>
    disclaimer: 'correlation_not_causation'
  }
  viewed: {
    checkInUsers: number
    checkInOtherGymUsers: number
    peopleListHome: number
    peopleListGymCard: number
    gymCardHasGymId: false
    rows: {
      id: string
      name: string
      homeUsers: number
      viewedUsers: number
      viewedOtherUsers: number
      checkIns: number
    }[]
  }
  notes: {
    socialAttributedToActorHomeGym: true
    workoutsAttributedToHomeGym: true
    checkInsAreViewedGym: true
    peopleListGymHasNoGymId: true
    viewingAnyGymIsProduct: true
    lowDensityIsOpportunity: true
    lastSeenSnapshot: true
    retentionFormula: 'exact_day_n_msk'
    gymHistoryUnavailable: true
  }
}

export async function buildAdminGyms(
  range: OverviewRange,
  sortRaw?: string,
  now = new Date(),
): Promise<AdminGymsPayload> {
  const sort = parseGymSort(sortRaw)
  const { from, to, fromKey, toKey } = range
  const todayKey = moscowDayKey(now)

  const [catalog, users, memberships, likes, conversations, messages, workouts, checkIns, peopleEvents] =
    await Promise.all([
      prisma.gym.findMany({
        select: { id: true, name: true, network: true, city: true },
        orderBy: { name: 'asc' },
      }),
      prisma.user.findMany({
        where: { deletedAt: null },
        select: { id: true, homeGymId: true, registeredAt: true, lastSeenAt: true },
      }),
      prisma.userGym.findMany({
        where: { user: { deletedAt: null } },
        select: { userId: true, gymId: true },
      }),
      prisma.like.findMany({
        where: { createdAt: { gte: from, lt: to } },
        select: { fromUserId: true },
      }),
      prisma.conversation.findMany({
        where: { createdAt: { gte: from, lt: to } },
        select: { id: true, initiatedById: true },
      }),
      prisma.chatMessage.findMany({
        where: { createdAt: { gte: from, lt: to } },
        select: { senderId: true },
      }),
      prisma.workoutSession.findMany({
        where: { performedAt: { gte: from, lt: to } },
        select: { userId: true },
      }),
      prisma.checkIn.findMany({
        where: { checkedInAt: { gte: from, lt: to } },
        select: { userId: true, gymId: true },
      }),
      prisma.landingEvent.findMany({
        where: {
          name: 'people_list_viewed',
          createdAt: { gte: from, lt: to },
          userId: { not: null },
        },
        select: { userId: true, placement: true },
      }),
    ])

  const assembled = assembleGymRows(
    {
      catalog,
      users,
      memberships,
      likes,
      conversations,
      messages,
      workouts,
      checkIns,
    },
    { from, to, toKey },
    todayKey,
    sort,
  )

  const catalogRows = assembled.gyms.filter((row) => row.catalog)
  const current = currentGymTotals(assembled.gyms)
  const points = networkScatter(catalogRows)

  const peopleHome: string[] = []
  const peopleGym: string[] = []
  for (const event of peopleEvents) {
    if (!event.userId) continue
    const surface = peopleSurface(event.placement)
    if (surface === 'home') peopleHome.push(event.userId)
    if (surface === 'gym') peopleGym.push(event.userId)
  }

  return {
    timezone: 'Europe/Moscow',
    generatedAt: now.toISOString(),
    range: {
      preset: range.preset,
      from: from.toISOString(),
      to: to.toISOString(),
      fromKey,
      toKey,
    },
    sort,
    current: {
      ...current,
      noHomeUsers: assembled.noHomeUsers,
      missingCatalogUsers: assembled.missingCatalogUsers,
    },
    density: { ...densityReport(catalogRows), note: 'observed_distribution' },
    gyms: assembled.gyms,
    lowDensity: catalogRows.filter((row) => row.lowDensity),
    empty: catalogRows.filter((row) => row.empty),
    network: {
      points,
      correlations: networkCorrelations(points),
      disclaimer: 'correlation_not_causation',
    },
    viewed: {
      checkInUsers: assembled.viewedUsers,
      checkInOtherGymUsers: assembled.viewedOtherUsers,
      peopleListHome: uniqueCount(peopleHome),
      peopleListGymCard: uniqueCount(peopleGym),
      gymCardHasGymId: false,
      rows: catalogRows
        .filter((row) => row.totalUsers > 0 || row.viewedUsers > 0)
        .map((row) => ({
          id: row.id,
          name: row.name,
          homeUsers: row.totalUsers,
          viewedUsers: row.viewedUsers,
          viewedOtherUsers: row.viewedOtherUsers,
          checkIns: row.checkIns,
        })),
    },
    notes: {
      socialAttributedToActorHomeGym: true,
      workoutsAttributedToHomeGym: true,
      checkInsAreViewedGym: true,
      peopleListGymHasNoGymId: true,
      viewingAnyGymIsProduct: true,
      lowDensityIsOpportunity: true,
      lastSeenSnapshot: true,
      retentionFormula: 'exact_day_n_msk',
      gymHistoryUnavailable: true,
    },
  }
}

export { parseGymSort }
export type { GymSortKey, GymRow }
