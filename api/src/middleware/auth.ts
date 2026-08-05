import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'
import { prisma } from '../db.js'
import { verifySession } from '../lib/jwt.js'
import { serializeUser } from '../lib/serialize.js'

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
  c.set('userId', session.sub)
  c.set('userEmail', session.email)
  await next()
})

export async function loadAuthedUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      gyms: true,
      checkIns: { where: { checkedOutAt: null }, take: 1 },
    },
  })
}

export async function authedUserJson(userId: string) {
  const user = await loadAuthedUser(userId)
  if (!user) return null
  return serializeUser(user)
}
