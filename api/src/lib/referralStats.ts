import { prisma } from '../db.js'
import {
  nextReferralTier,
  referralTierFromCount,
  referralsToNext,
  type ReferralTierDef,
  type ReferralTierId,
} from './referralTiers.js'

export type ReferralPublicStats = {
  referralCreditedCount: number
  referralTier: ReferralTierId
  referralTitle: string
  referralBadge: string
  referralChrome: ReferralTierDef['chrome']
}

export function statsFromCount(creditedCount: number): ReferralPublicStats {
  const tier = referralTierFromCount(creditedCount)
  return {
    referralCreditedCount: creditedCount,
    referralTier: tier.id,
    referralTitle: tier.title,
    referralBadge: tier.badge,
    referralChrome: tier.chrome,
  }
}

const EMPTY = statsFromCount(0)

/** Credited = invitee exists, not deleted, onboardingDone */
export async function countCreditedInvites(inviterId: string): Promise<number> {
  const invites = await prisma.invite.findMany({
    where: { inviterId },
    select: { inviteeId: true },
  })
  if (!invites.length) return 0
  return prisma.user.count({
    where: {
      id: { in: invites.map((i) => i.inviteeId) },
      deletedAt: null,
      onboardingDone: true,
    },
  })
}

export async function getReferralStatsForUser(userId: string): Promise<ReferralPublicStats> {
  const count = await countCreditedInvites(userId)
  return statsFromCount(count)
}

/** Batch map userId → credited stats for feed cards */
export async function getReferralStatsMap(
  userIds: string[],
): Promise<Map<string, ReferralPublicStats>> {
  const map = new Map<string, ReferralPublicStats>()
  const ids = [...new Set(userIds.filter(Boolean))]
  for (const id of ids) map.set(id, EMPTY)
  if (!ids.length) return map

  const invites = await prisma.invite.findMany({
    where: { inviterId: { in: ids } },
    select: { inviterId: true, inviteeId: true },
  })
  if (!invites.length) return map

  const inviteeIds = [...new Set(invites.map((i) => i.inviteeId))]
  const creditedInvitees = await prisma.user.findMany({
    where: {
      id: { in: inviteeIds },
      deletedAt: null,
      onboardingDone: true,
    },
    select: { id: true },
  })
  const ok = new Set(creditedInvitees.map((u) => u.id))
  const counts = new Map<string, number>()
  for (const row of invites) {
    if (!ok.has(row.inviteeId)) continue
    counts.set(row.inviterId, (counts.get(row.inviterId) || 0) + 1)
  }
  for (const id of ids) {
    map.set(id, statsFromCount(counts.get(id) || 0))
  }
  return map
}

export type InviteCircleFriend = {
  id: string
  name: string
  username: string | null
  city: string
  createdAt: string
  creditedAt: string
}

export type InviteCirclePayload = {
  creditedCount: number
  pendingCount: number
  tier: ReferralTierId
  title: string
  badge: string
  chrome: ReferralTierDef['chrome']
  nextTitle: string | null
  nextMin: number | null
  toNext: number | null
  friends: InviteCircleFriend[]
  pending: InviteCircleFriend[]
}

export async function buildInviteCircle(inviterId: string): Promise<InviteCirclePayload> {
  const invites = await prisma.invite.findMany({
    where: { inviterId },
    orderBy: { createdAt: 'desc' },
    select: { inviteeId: true, createdAt: true },
  })

  const inviteeIds = invites.map((i) => i.inviteeId)
  const users = inviteeIds.length
    ? await prisma.user.findMany({
        where: { id: { in: inviteeIds }, deletedAt: null },
        select: {
          id: true,
          name: true,
          username: true,
          city: true,
          createdAt: true,
          onboardingDone: true,
          updatedAt: true,
        },
      })
    : []
  const byId = new Map(users.map((u) => [u.id, u]))

  const friends: InviteCircleFriend[] = []
  const pending: InviteCircleFriend[] = []

  for (const inv of invites) {
    const u = byId.get(inv.inviteeId)
    if (!u) continue
    const row: InviteCircleFriend = {
      id: u.id,
      name: u.name,
      username: u.username,
      city: u.city || '',
      createdAt: inv.createdAt.toISOString(),
      creditedAt: u.onboardingDone ? u.updatedAt.toISOString() : inv.createdAt.toISOString(),
    }
    if (u.onboardingDone) friends.push(row)
    else pending.push(row)
  }

  const creditedCount = friends.length
  const tier = referralTierFromCount(creditedCount)
  const next = nextReferralTier(creditedCount)

  return {
    creditedCount,
    pendingCount: pending.length,
    tier: tier.id,
    title: tier.title,
    badge: tier.badge,
    chrome: tier.chrome,
    nextTitle: next?.title ?? null,
    nextMin: next?.minCredited ?? null,
    toNext: referralsToNext(creditedCount),
    friends,
    pending,
  }
}
