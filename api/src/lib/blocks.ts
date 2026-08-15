import { prisma } from '../db.js'
import { normalizeEmail } from '../env.js'

export function normalizeIp(ip: string) {
  return ip.trim().toLowerCase().slice(0, 64)
}

export async function isEmailBlocked(email: string) {
  const row = await prisma.blockedEmail.findUnique({
    where: { email: normalizeEmail(email) },
  })
  return Boolean(row)
}

export async function isIpBlocked(ip: string) {
  const key = normalizeIp(ip)
  if (!key || key === 'unknown') return false
  const row = await prisma.blockedIp.findUnique({ where: { ip: key } })
  return Boolean(row)
}

export async function areUsersBlocked(a: string, b: string) {
  if (!a || !b || a === b) return false
  const row = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
    select: { id: true },
  })
  return Boolean(row)
}

export async function listBlockedUserIds(blockerId: string) {
  const rows = await prisma.userBlock.findMany({
    where: { blockerId },
    select: { blockedId: true },
  })
  return rows.map((r) => r.blockedId)
}

/** Ids that blocked me or I blocked — hide from hall lists both ways */
export async function listHiddenUserIds(viewerId: string) {
  const rows = await prisma.userBlock.findMany({
    where: {
      OR: [{ blockerId: viewerId }, { blockedId: viewerId }],
    },
    select: { blockerId: true, blockedId: true },
  })
  const ids = new Set<string>()
  for (const r of rows) {
    if (r.blockerId !== viewerId) ids.add(r.blockerId)
    if (r.blockedId !== viewerId) ids.add(r.blockedId)
  }
  return [...ids]
}
