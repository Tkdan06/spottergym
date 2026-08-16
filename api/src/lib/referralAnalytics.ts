import { prisma } from '../db.js'
import { referralTierFromCount } from './referralTiers.js'

export type ReferralUserBrief = {
  id: string
  name: string
  username: string | null
  email: string
  city: string
  deleted: boolean
  createdAt: string | null
}

export type ReferralLeader = ReferralUserBrief & {
  inviteCount: number
  creditedCount: number
  pendingCount: number
  tier: number
  tierTitle: string
  lastInviteAt: string | null
}

export type ReferralEvent = {
  id: string
  createdAt: string
  credited: boolean
  inviter: ReferralUserBrief
  invitee: ReferralUserBrief & { onboardingDone: boolean }
}

export type ReferralAnalytics = {
  generatedAt: string
  summary: {
    totalInvites: number
    creditedInvites: number
    pendingInvites: number
    uniqueInviters: number
    invites24h: number
    invites7d: number
    invites30d: number
    credited7d: number
    activeUsers: number
    referredUsers: number
    organicUsers: number
    referredSharePct: number | null
  }
  leaders: ReferralLeader[]
  recent: ReferralEvent[]
}

function brief(user: {
  id: string
  name: string
  username: string | null
  email: string
  city: string
  deletedAt: Date | null
  createdAt?: Date
} | null | undefined): ReferralUserBrief {
  if (!user) {
    return {
      id: '',
      name: 'Удалён',
      username: null,
      email: '',
      city: '',
      deleted: true,
      createdAt: null,
    }
  }
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    city: user.city || '',
    deleted: Boolean(user.deletedAt),
    createdAt: user.createdAt ? user.createdAt.toISOString() : null,
  }
}

export async function buildReferralAnalytics(): Promise<ReferralAnalytics> {
  const now = Date.now()
  const t24 = new Date(now - 24 * 60 * 60 * 1000)
  const t7 = new Date(now - 7 * 24 * 60 * 60 * 1000)
  const t30 = new Date(now - 30 * 24 * 60 * 60 * 1000)

  const [totalInvites, invites24h, invites7d, invites30d, activeUsers, allInvites, recentRows] =
    await Promise.all([
      prisma.invite.count(),
      prisma.invite.count({ where: { createdAt: { gte: t24 } } }),
      prisma.invite.count({ where: { createdAt: { gte: t7 } } }),
      prisma.invite.count({ where: { createdAt: { gte: t30 } } }),
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.invite.findMany({
        select: { inviterId: true, inviteeId: true, createdAt: true },
      }),
      prisma.invite.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: {
          inviter: {
            select: {
              id: true,
              name: true,
              username: true,
              email: true,
              city: true,
              deletedAt: true,
              createdAt: true,
            },
          },
        },
      }),
    ])

  const allInviteeIds = [...new Set(allInvites.map((i) => i.inviteeId))]
  const inviteeUsers = allInviteeIds.length
    ? await prisma.user.findMany({
        where: { id: { in: allInviteeIds } },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          city: true,
          deletedAt: true,
          createdAt: true,
          onboardingDone: true,
        },
      })
    : []
  const inviteeById = new Map(inviteeUsers.map((u) => [u.id, u]))

  const creditedInviteeIds = new Set(
    inviteeUsers.filter((u) => !u.deletedAt && u.onboardingDone).map((u) => u.id),
  )

  const creditedInvites = allInvites.filter((i) => creditedInviteeIds.has(i.inviteeId)).length
  const pendingInvites = allInvites.filter((i) => {
    const u = inviteeById.get(i.inviteeId)
    return u && !u.deletedAt && !u.onboardingDone
  }).length

  const credited7d = allInvites.filter(
    (i) => i.createdAt >= t7 && creditedInviteeIds.has(i.inviteeId),
  ).length

  type Agg = {
    inviteCount: number
    creditedCount: number
    pendingCount: number
    lastInviteAt: Date | null
  }
  const byInviter = new Map<string, Agg>()
  for (const row of allInvites) {
    let agg = byInviter.get(row.inviterId)
    if (!agg) {
      agg = { inviteCount: 0, creditedCount: 0, pendingCount: 0, lastInviteAt: null }
      byInviter.set(row.inviterId, agg)
    }
    agg.inviteCount += 1
    if (!agg.lastInviteAt || row.createdAt > agg.lastInviteAt) agg.lastInviteAt = row.createdAt
    const u = inviteeById.get(row.inviteeId)
    if (u && !u.deletedAt && u.onboardingDone) agg.creditedCount += 1
    else if (u && !u.deletedAt && !u.onboardingDone) agg.pendingCount += 1
  }

  const leaderIds = [...byInviter.keys()]
  const leadersUsers = leaderIds.length
    ? await prisma.user.findMany({
        where: { id: { in: leaderIds } },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          city: true,
          deletedAt: true,
          createdAt: true,
        },
      })
    : []
  const leaderById = new Map(leadersUsers.map((u) => [u.id, u]))

  const leaders: ReferralLeader[] = [...byInviter.entries()]
    .map(([inviterId, agg]) => {
      const u = leaderById.get(inviterId)
      const tier = referralTierFromCount(agg.creditedCount)
      return {
        ...brief(
          u ?? {
            id: inviterId,
            name: 'Удалён',
            username: null,
            email: '',
            city: '',
            deletedAt: new Date(),
          },
        ),
        id: inviterId,
        inviteCount: agg.inviteCount,
        creditedCount: agg.creditedCount,
        pendingCount: agg.pendingCount,
        tier: tier.id,
        tierTitle: tier.title,
        lastInviteAt: agg.lastInviteAt ? agg.lastInviteAt.toISOString() : null,
      }
    })
    .sort(
      (a, b) =>
        b.creditedCount - a.creditedCount ||
        b.inviteCount - a.inviteCount ||
        a.name.localeCompare(b.name, 'ru'),
    )
    .slice(0, 100)

  const recent: ReferralEvent[] = recentRows.map((row) => {
    const invitee = inviteeById.get(row.inviteeId)
    const credited = Boolean(invitee && !invitee.deletedAt && invitee.onboardingDone)
    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      credited,
      inviter: brief(row.inviter),
      invitee: {
        ...brief(invitee ?? null),
        onboardingDone: Boolean(invitee?.onboardingDone),
      },
    }
  })

  const referredUsers = creditedInvites
  const organicUsers = Math.max(0, activeUsers - referredUsers)
  const referredSharePct =
    activeUsers > 0 ? Math.round((referredUsers / activeUsers) * 1000) / 10 : null

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalInvites,
      creditedInvites,
      pendingInvites,
      uniqueInviters: byInviter.size,
      invites24h,
      invites7d,
      invites30d,
      credited7d,
      activeUsers,
      referredUsers,
      organicUsers,
      referredSharePct,
    },
    leaders,
    recent,
  }
}
