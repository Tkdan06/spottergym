import { prisma } from '../db.js'
import { createNotification } from './notify.js'

export type BroadcastSummary = {
  id: string
  title: string
  body: string
  createdAt: string
  createdById: string
  createdByName: string
  recipientCount: number
  readCount: number
  unreadCount: number
}

async function statsForBroadcast(id: string, recipientCount: number) {
  const readCount = await prisma.notification.count({
    where: { broadcastId: id, read: true },
  })
  const delivered = await prisma.notification.count({
    where: { broadcastId: id },
  })
  const reached = Math.max(recipientCount, delivered)
  return {
    recipientCount: reached,
    readCount,
    unreadCount: Math.max(0, reached - readCount),
  }
}

export function serializeBroadcast(
  row: {
    id: string
    title: string
    body: string
    createdAt: Date
    createdById: string
    recipientCount: number
    createdBy?: { name: string } | null
  },
  stats: { recipientCount: number; readCount: number; unreadCount: number },
): BroadcastSummary {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    createdById: row.createdById,
    createdByName: row.createdBy?.name || 'Админ',
    recipientCount: stats.recipientCount,
    readCount: stats.readCount,
    unreadCount: stats.unreadCount,
  }
}

export async function listBroadcasts(take = 50): Promise<BroadcastSummary[]> {
  const rows = await prisma.adminBroadcast.findMany({
    orderBy: { createdAt: 'desc' },
    take,
    include: { createdBy: { select: { name: true } } },
  })
  const out: BroadcastSummary[] = []
  for (const row of rows) {
    const stats = await statsForBroadcast(row.id, row.recipientCount)
    out.push(serializeBroadcast(row, stats))
  }
  return out
}

export async function getBroadcast(id: string): Promise<BroadcastSummary | null> {
  const row = await prisma.adminBroadcast.findUnique({
    where: { id },
    include: { createdBy: { select: { name: true } } },
  })
  if (!row) return null
  const stats = await statsForBroadcast(row.id, row.recipientCount)
  return serializeBroadcast(row, stats)
}

/** Fan-out system notification to every non-deleted user. */
export async function createAndSendBroadcast(input: {
  adminId: string
  title: string
  body: string
}): Promise<BroadcastSummary> {
  const title = input.title.trim().slice(0, 120)
  const body = input.body.trim().slice(0, 500)
  if (!title || !body) throw new Error('Укажи заголовок и текст')

  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: { id: true },
  })

  const broadcast = await prisma.adminBroadcast.create({
    data: {
      title,
      body,
      createdById: input.adminId,
      recipientCount: users.length,
    },
    include: { createdBy: { select: { name: true } } },
  })

  // Sequential createNotification so prefs/push path stays consistent; force = always deliver
  const chunkSize = 40
  for (let i = 0; i < users.length; i += chunkSize) {
    const chunk = users.slice(i, i + chunkSize)
    await Promise.all(
      chunk.map((u) =>
        createNotification({
          userId: u.id,
          type: 'admin',
          title,
          body,
          href: '/app/notifications',
          actorId: input.adminId,
          broadcastId: broadcast.id,
          force: true,
        }),
      ),
    )
  }

  const stats = await statsForBroadcast(broadcast.id, broadcast.recipientCount)
  return serializeBroadcast(broadcast, stats)
}
