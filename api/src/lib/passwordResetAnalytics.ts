import { prisma } from '../db.js'

export type PasswordResetEventStatus =
  | 'sent'
  | 'no_account'
  | 'blocked'
  | 'send_failed'
  | 'completed'
  | 'rate_limited'

export async function logPasswordResetEvent(input: {
  email: string
  userId?: string | null
  ip?: string
  status: PasswordResetEventStatus
}) {
  try {
    await prisma.passwordResetEvent.create({
      data: {
        email: input.email.slice(0, 254),
        userId: input.userId || null,
        ip: (input.ip || '').slice(0, 64),
        status: input.status,
      },
    })
  } catch (err) {
    console.warn('[password-reset] log event failed', err)
  }
}

export type PasswordResetSummary = {
  last24h: number
  last7d: number
  last30d: number
  completed7d: number
  uniqueEmails7d: number
  noAccount7d: number
}

export async function buildPasswordResetSummary(): Promise<PasswordResetSummary> {
  const now = Date.now()
  const t24 = new Date(now - 24 * 60 * 60 * 1000)
  const t7 = new Date(now - 7 * 24 * 60 * 60 * 1000)
  const t30 = new Date(now - 30 * 24 * 60 * 60 * 1000)

  const [last24h, last7d, last30d, completed7d, unique7d, noAccount7d] = await Promise.all([
    prisma.passwordResetEvent.count({ where: { createdAt: { gte: t24 } } }),
    prisma.passwordResetEvent.count({ where: { createdAt: { gte: t7 } } }),
    prisma.passwordResetEvent.count({ where: { createdAt: { gte: t30 } } }),
    prisma.passwordResetEvent.count({
      where: { createdAt: { gte: t7 }, status: 'completed' },
    }),
    prisma.passwordResetEvent
      .groupBy({
        by: ['email'],
        where: { createdAt: { gte: t7 } },
      })
      .then((rows) => rows.length),
    prisma.passwordResetEvent.count({
      where: { createdAt: { gte: t7 }, status: 'no_account' },
    }),
  ])

  return {
    last24h,
    last7d,
    last30d,
    completed7d,
    uniqueEmails7d: unique7d,
    noAccount7d,
  }
}

export async function buildPasswordResetAnalytics() {
  const summary = await buildPasswordResetSummary()
  const t7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const t30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [topRows, recent, byStatus7d] = await Promise.all([
    prisma.passwordResetEvent.groupBy({
      by: ['email'],
      where: { createdAt: { gte: t30 } },
      _count: { _all: true },
      _max: { createdAt: true },
      orderBy: { _count: { email: 'desc' } },
      take: 25,
    }),
    prisma.passwordResetEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 60,
      select: {
        id: true,
        email: true,
        userId: true,
        ip: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.passwordResetEvent.groupBy({
      by: ['status'],
      where: { createdAt: { gte: t7 } },
      _count: { _all: true },
    }),
  ])

  const emails = [...new Set([...topRows.map((r) => r.email), ...recent.map((r) => r.email)])]
  const users = emails.length
    ? await prisma.user.findMany({
        where: { email: { in: emails } },
        select: { id: true, email: true, name: true, username: true },
      })
    : []
  const byEmail = new Map(users.map((u) => [u.email, u]))

  return {
    summary,
    status7d: Object.fromEntries(
      byStatus7d.map((s) => [s.status, s._count._all]),
    ) as Record<string, number>,
    topEmails: topRows.map((r) => {
      const u = byEmail.get(r.email)
      return {
        email: r.email,
        count: r._count._all,
        lastAt: r._max.createdAt?.toISOString() || null,
        userId: u?.id || null,
        name: u?.name || null,
        username: u?.username || null,
      }
    }),
    recent: recent.map((e) => {
      const u = byEmail.get(e.email)
      return {
        id: e.id,
        email: e.email,
        userId: e.userId || u?.id || null,
        name: u?.name || null,
        username: u?.username || null,
        ip: e.ip,
        status: e.status,
        createdAt: e.createdAt.toISOString(),
      }
    }),
  }
}
