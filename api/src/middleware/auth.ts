import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'
import { isIpBlocked } from '../lib/blocks.js'
import { expireStaleCheckIns } from '../lib/checkInExpiry.js'
import { prisma } from '../db.js'
import { verifySession } from '../lib/jwt.js'
import { serializeUser } from '../lib/serialize.js'
import { clientIp } from './rateLimit.js'

export type AuthedEnv = {
  Variables: {
    userId: string
    userEmail: string
  }
}

const COOKIE = 'spotter_session'

export function sessionCookieName() {
  return COOKIE
}

export const requireAuth = createMiddleware<AuthedEnv>(async (c, next) => {
  const header = c.req.header('authorization')
  const bearer = header?.startsWith('Bearer ') ? header.slice(7) : ''
  // Prefer custom header — leaves Authorization free for nginx Basic Auth
  const custom = c.req.header('x-spotter-token') || ''
  const token = custom || bearer || getCookie(c, COOKIE) || ''
  if (!token) {
    return c.json({ error: 'Требуется вход' }, 401)
  }
  const session = await verifySession(token)
  if (!session) {
    return c.json({ error: 'Сессия недействительна' }, 401)
  }

  if (await isIpBlocked(clientIp(c))) {
    return c.json({ error: 'Доступ с этой сети ограничен' }, 403)
  }

  const row = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, deletedAt: true, tokenVersion: true },
  })
  if (!row || row.deletedAt) {
    return c.json({ error: 'Сессия недействительна' }, 401)
  }
  if (row.tokenVersion !== session.tv) {
    return c.json({ error: 'Сессия устарела — войди снова' }, 401)
  }

  c.set('userId', row.id)
  c.set('userEmail', row.email)
  await next()
})

export async function loadAuthedUser(userId: string) {
  await expireStaleCheckIns()
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      gyms: true,
      checkIns: { where: { checkedOutAt: null }, take: 1 },
    },
  })
  if (user?.deletedAt) return null
  return user
}

export async function authedUserJson(userId: string) {
  const user = await loadAuthedUser(userId)
  if (!user) return null
  return serializeUser(user)
}

/** Invalidate all existing JWTs for this user. */
export async function bumpTokenVersion(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  })
}
