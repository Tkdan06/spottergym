import { prisma } from '../db.js'
import { isEmergencyShutdown } from './emergency.js'
import { createNotification } from './notify.js'

export type BroadcastStatus = 'pending' | 'sending' | 'sent' | 'failed'

export type BroadcastSummary = {
  id: string
  title: string
  body: string
  createdAt: string
  finishedAt: string | null
  createdById: string
  createdByName: string
  status: BroadcastStatus
  recipientCount: number
  deliveredCount: number
  failedCount: number
  readCount: number
  unreadCount: number
}

const CHUNK = 40

async function statsForBroadcast(id: string, deliveredCount: number) {
  const readCount = await prisma.notification.count({
    where: { broadcastId: id, read: true },
  })
  const delivered = await prisma.notification.count({
    where: { broadcastId: id },
  })
  const reached = Math.max(deliveredCount, delivered)
  return {
    deliveredCount: reached,
    readCount,
    unreadCount: Math.max(0, reached - readCount),
  }
}

function asStatus(raw: string): BroadcastStatus {
  if (raw === 'pending' || raw === 'sending' || raw === 'sent' || raw === 'failed') return raw
  return 'sent'
}

export function serializeBroadcast(
  row: {
    id: string
    title: string
    body: string
    createdAt: Date
    finishedAt?: Date | null
    createdById: string
    recipientCount: number
    deliveredCount: number
    failedCount: number
    status: string
    createdBy?: { name: string } | null
  },
  stats: { deliveredCount: number; readCount: number; unreadCount: number },
): BroadcastSummary {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
    createdById: row.createdById,
    createdByName: row.createdBy?.name || 'Админ',
    status: asStatus(row.status),
    recipientCount: row.recipientCount,
    deliveredCount: stats.deliveredCount,
    failedCount: row.failedCount,
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
    const stats = await statsForBroadcast(row.id, row.deliveredCount)
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
  const stats = await statsForBroadcast(row.id, row.deliveredCount)
  return serializeBroadcast(row, stats)
}

/**
 * Enqueue fan-out. Actual delivery runs in startBroadcastLoop (chunked, durable cursor).
 */
export async function createBroadcast(input: {
  adminId: string
  title: string
  body: string
}): Promise<BroadcastSummary> {
  const title = input.title.trim().slice(0, 120)
  const body = input.body.trim().slice(0, 500)
  if (!title || !body) throw new Error('Укажи заголовок и текст')

  const recipientCount = await prisma.user.count({ where: { deletedAt: null } })

  const broadcast = await prisma.adminBroadcast.create({
    data: {
      title,
      body,
      createdById: input.adminId,
      recipientCount,
      status: 'pending',
      deliveredCount: 0,
      failedCount: 0,
      cursorOffset: 0,
      lastError: '',
    },
    include: { createdBy: { select: { name: true } } },
  })

  return serializeBroadcast(broadcast, {
    deliveredCount: 0,
    readCount: 0,
    unreadCount: 0,
  })
}

/** @deprecated alias — enqueue only */
export const createAndSendBroadcast = createBroadcast

async function processOneBroadcast(id: string) {
  const row = await prisma.adminBroadcast.findUnique({ where: { id } })
  if (!row) return
  if (row.status === 'sent' || row.status === 'failed') return

  if (row.status === 'pending') {
    await prisma.adminBroadcast.update({
      where: { id },
      data: { status: 'sending' },
    })
  }

  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: { id: true },
    orderBy: { id: 'asc' },
    skip: row.cursorOffset,
    take: CHUNK,
  })

  if (!users.length) {
    const delivered = await prisma.notification.count({ where: { broadcastId: id } })
    await prisma.adminBroadcast.update({
      where: { id },
      data: {
        status: 'sent',
        deliveredCount: delivered,
        recipientCount: Math.max(row.recipientCount, delivered),
        finishedAt: new Date(),
        lastError: '',
      },
    })
    return
  }

  let deliveredDelta = 0
  let failedDelta = 0
  await Promise.all(
    users.map(async (u) => {
      try {
        const n = await createNotification({
          userId: u.id,
          type: 'admin',
          title: row.title,
          body: row.body,
          href: '/app/notifications',
          actorId: row.createdById,
          broadcastId: row.id,
          force: true,
        })
        if (n) deliveredDelta += 1
        else failedDelta += 1
      } catch (err) {
        failedDelta += 1
        console.warn('[broadcast] notify failed', u.id, err)
      }
    }),
  )

  const nextOffset = row.cursorOffset + users.length
  const done = users.length < CHUNK

  await prisma.adminBroadcast.update({
    where: { id },
    data: {
      cursorOffset: nextOffset,
      deliveredCount: { increment: deliveredDelta },
      failedCount: { increment: failedDelta },
      ...(done
        ? {
            status: 'sent' as const,
            finishedAt: new Date(),
            lastError: '',
          }
        : { status: 'sending' as const }),
    },
  })

  if (done) {
    const delivered = await prisma.notification.count({ where: { broadcastId: id } })
    await prisma.adminBroadcast.update({
      where: { id },
      data: {
        deliveredCount: delivered,
        recipientCount: Math.max(row.recipientCount, delivered),
      },
    })
  }
}

/** Process pending/sending broadcasts one chunk at a time. */
export async function runBroadcastQueueTick() {
  if (await isEmergencyShutdown()) return 0

  const job = await prisma.adminBroadcast.findFirst({
    where: { status: { in: ['pending', 'sending'] } },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (!job) return 0

  try {
    await processOneBroadcast(job.id)
    return 1
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка рассылки'
    await prisma.adminBroadcast.update({
      where: { id: job.id },
      data: {
        status: 'failed',
        lastError: message.slice(0, 500),
        finishedAt: new Date(),
      },
    })
    console.warn('[broadcast] job failed', job.id, err)
    return 1
  }
}

export function startBroadcastLoop() {
  const tick = () => {
    void runBroadcastQueueTick().catch((err) => console.warn('[broadcast]', err))
  }
  tick()
  setInterval(tick, 2_000)
  console.log('[broadcast] queue loop every 2s')
}
