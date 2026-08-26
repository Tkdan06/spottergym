import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { z } from 'zod'
import { prisma } from '../db.js'
import { isMasterAdminEmail, normalizeEmail } from '../env.js'
import { FULL_PERMISSIONS, resolveAdminFlags } from '../lib/admin.js'
import { signSession, verifySession } from '../lib/jwt.js'
import { hashPassword, verifyPassword } from '../lib/password.js'
import { serializeUser } from '../lib/serialize.js'
import { allocateUsername, ensureUserHasUsername } from '../lib/username.js'
import {
  EMAIL_MAX,
  NAME_MAX,
  NAME_MIN,
  PASSWORD_MAX,
  PASSWORD_MIN,
} from '../lib/fieldLimits.js'
import {
  authedUserJson,
  requireAuth,
  sessionCookieName,
  type AuthedEnv,
} from '../middleware/auth.js'
import { attachInvite } from '../lib/attachInvite.js'
import { isEmailBlocked, isIpBlocked } from '../lib/blocks.js'
import { notifyRegistrationAdmins } from '../lib/registrationNotify.js'
import {
  consumePasswordResetToken,
  issuePasswordResetForUser,
} from '../lib/passwordReset.js'
import { logPasswordResetEvent } from '../lib/passwordResetAnalytics.js'
import { clientIp, rateLimit } from '../middleware/rateLimit.js'

const registerSchema = z.object({
  name: z.string().trim().min(NAME_MIN).max(NAME_MAX),
  email: z.string().email().max(EMAIL_MAX),
  password: z.string().min(PASSWORD_MIN).max(PASSWORD_MAX),
  gender: z.enum(['female', 'male']).default('male'),
  inviteFrom: z.string().max(64).optional(),
})

const loginSchema = z.object({
  email: z.string().email().max(EMAIL_MAX),
  password: z.string().min(1).max(PASSWORD_MAX),
})

const LOGIN_FAIL = 'Неверный email или пароль'

export const authRoutes = new Hono<AuthedEnv>()

function setSessionCookie(c: Parameters<typeof setCookie>[0], token: string) {
  setCookie(c, sessionCookieName(), token, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === 'production',
  })
}

authRoutes.post(
  '/register',
  // Per IP: stop fake-inbox spam. Keep a little headroom for shared Wi‑Fi (gym/café NAT).
  rateLimit({ windowMs: 60 * 60_000, max: 6, route: 'auth-register' }),
  async (c) => {
    const body = registerSchema.safeParse(await c.req.json().catch(() => null))
    if (!body.success) {
      return c.json({ error: 'Некорректные данные регистрации' }, 400)
    }
    const email = normalizeEmail(body.data.email)
    if (await isIpBlocked(clientIp(c))) {
      return c.json({ error: 'Доступ с этой сети ограничен' }, 403)
    }
    if (await isEmailBlocked(email)) {
      return c.json({ error: 'Этот email заблокирован' }, 403)
    }
    if (await prisma.user.findUnique({ where: { email } })) {
      return c.json({ error: 'Аккаунт с таким email уже есть — войди' }, 409)
    }

    // Обычная регистрация никогда не выдаёт админку.
    // Master email (server env only) gets flags via resolveAdminFlags / isMasterAdminEmail.
    const master = isMasterAdminEmail(email)
    const passwordHash = await hashPassword(body.data.password)
    const displayName = master ? 'Bogdan' : body.data.name
    const username = await allocateUsername(displayName)
    const signupIp = clientIp(c)
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        username,
        name: displayName,
        gender: body.data.gender,
        isAdmin: master,
        isMasterAdmin: master,
        adminPermissions: master ? FULL_PERMISSIONS : undefined,
        // Всегда онбординг — даже для главного админа
        onboardingDone: false,
        signupIp,
      },
      include: { gyms: true, checkIns: { where: { checkedOutAt: null }, take: 1 } },
    })

    await attachInvite(user.id, body.data.inviteFrom)

    void notifyRegistrationAdmins({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
    }).catch((err) => console.warn('[notify] registration admins', err))

    const token = await signSession({
      sub: user.id,
      email: user.email,
      tv: user.tokenVersion,
    })
    setSessionCookie(c, token)
    // Cookie is the session; token omitted from body (XSS-safe). Kept empty for old clients.
    return c.json({ user: serializeUser(user) }, 201)
  },
)

authRoutes.post(
  '/login',
  rateLimit({ windowMs: 60_000, max: 20, route: 'auth-login' }),
  async (c) => {
    const body = loginSchema.safeParse(await c.req.json().catch(() => null))
    if (!body.success) {
      return c.json({ error: 'Некорректные данные входа' }, 400)
    }
    const email = normalizeEmail(body.data.email)
    if (await isIpBlocked(clientIp(c))) {
      return c.json({ error: 'Доступ с этой сети ограничен' }, 403)
    }
    if (await isEmailBlocked(email)) {
      return c.json({ error: 'Этот email заблокирован' }, 403)
    }
    let user = await prisma.user.findUnique({
      where: { email },
      include: { gyms: true, checkIns: { where: { checkedOutAt: null }, take: 1 } },
    })

    // No auto-create on login — register (or controlled seed) must create the account first
    if (!user) {
      return c.json({ error: LOGIN_FAIL }, 401)
    }
    if (user.deletedAt) {
      return c.json({ error: LOGIN_FAIL }, 401)
    }

    const ok = await verifyPassword(user.passwordHash, body.data.password)
    if (!ok) {
      return c.json({ error: LOGIN_FAIL }, 401)
    }

    if (!user.username) {
      await ensureUserHasUsername(user.id, user.name)
      user = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        include: { gyms: true, checkIns: { where: { checkedOutAt: null }, take: 1 } },
      })
    }

    const flags = resolveAdminFlags(user)
    if (flags.isAdmin !== user.isAdmin || flags.isMasterAdmin !== user.isMasterAdmin) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          isAdmin: flags.isAdmin,
          isMasterAdmin: flags.isMasterAdmin,
          adminPermissions: flags.adminPermissions,
          lastSeenAt: new Date(),
        },
        include: { gyms: true, checkIns: { where: { checkedOutAt: null }, take: 1 } },
      })
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastSeenAt: new Date() },
      })
    }

    const token = await signSession({
      sub: user.id,
      email: user.email,
      tv: user.tokenVersion,
    })
    setSessionCookie(c, token)
    return c.json({ user: serializeUser(user) })
  },
)

authRoutes.post('/logout', async (c) => {
  const header = c.req.header('authorization')
  const bearer = header?.startsWith('Bearer ') ? header.slice(7) : ''
  const custom = c.req.header('x-spotter-token') || ''
  const token = custom || bearer || getCookie(c, sessionCookieName()) || ''
  if (token) {
    const session = await verifySession(token)
    if (session?.sub) {
      await prisma.checkIn.updateMany({
        where: { userId: session.sub, checkedOutAt: null },
        data: { checkedOutAt: new Date() },
      })
    }
  }
  deleteCookie(c, sessionCookieName(), { path: '/' })
  return c.json({ ok: true })
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(PASSWORD_MAX),
  newPassword: z.string().min(PASSWORD_MIN).max(PASSWORD_MAX),
})

authRoutes.post(
  '/change-password',
  requireAuth,
  rateLimit({ windowMs: 60_000, max: 8, route: 'auth-change-password' }),
  async (c) => {
    const body = changePasswordSchema.safeParse(await c.req.json().catch(() => null))
    if (!body.success) {
      return c.json(
        { error: `Новый пароль: от ${PASSWORD_MIN} до ${PASSWORD_MAX} символов` },
        400,
      )
    }

    const { currentPassword, newPassword } = body.data
    if (currentPassword === newPassword) {
      return c.json({ error: 'Новый пароль должен отличаться от текущего' }, 400)
    }

    const userId = c.get('userId')
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true, deletedAt: true },
    })
    if (!user || user.deletedAt) {
      return c.json({ error: 'Аккаунт не найден' }, 404)
    }

    const ok = await verifyPassword(user.passwordHash, currentPassword)
    if (!ok) {
      return c.json({ error: 'Неверный текущий пароль' }, 401)
    }

    const passwordHash = await hashPassword(newPassword)
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, tokenVersion: { increment: 1 } },
      select: { id: true, email: true, tokenVersion: true },
    })
    const token = await signSession({
      sub: updated.id,
      email: updated.email,
      tv: updated.tokenVersion,
    })
    setSessionCookie(c, token)

    return c.json({ ok: true })
  },
)

const forgotSchema = z.object({
  email: z.string().email().max(EMAIL_MAX),
})

const FORGOT_OK = {
  ok: true as const,
  message: 'Если аккаунт с таким email есть — мы отправили ссылку для сброса пароля',
}

authRoutes.post(
  '/forgot-password',
  rateLimit({ windowMs: 60 * 60_000, max: 5, route: 'auth-forgot-password' }),
  async (c) => {
    const body = forgotSchema.safeParse(await c.req.json().catch(() => null))
    if (!body.success) {
      return c.json({ error: 'Укажи корректный email' }, 400)
    }

    const email = normalizeEmail(body.data.email)
    const ip = clientIp(c)
    if (await isIpBlocked(ip)) {
      return c.json({ error: 'Доступ с этой сети ограничен' }, 403)
    }
    // Same response whether or not the account exists (anti-enumeration)
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, deletedAt: true },
    })

    if (!user || user.deletedAt) {
      await logPasswordResetEvent({ email, ip, status: 'no_account' })
    } else if (await isEmailBlocked(email)) {
      await logPasswordResetEvent({
        email,
        userId: user.id,
        ip,
        status: 'blocked',
      })
    } else {
      try {
        const result = await issuePasswordResetForUser(user)
        await logPasswordResetEvent({
          email,
          userId: user.id,
          ip,
          status: result.sent ? 'sent' : 'send_failed',
        })
      } catch (err) {
        console.warn('[password-reset] send failed', err)
        await logPasswordResetEvent({
          email,
          userId: user.id,
          ip,
          status: 'send_failed',
        })
        // Still return OK to the client — do not leak mail infra status
      }
    }

    return c.json(FORGOT_OK)
  },
)

const resetSchema = z.object({
  token: z.string().min(20).max(200),
  newPassword: z.string().min(PASSWORD_MIN).max(PASSWORD_MAX),
})

authRoutes.post(
  '/reset-password',
  rateLimit({ windowMs: 60_000, max: 10, route: 'auth-reset-password' }),
  async (c) => {
    const body = resetSchema.safeParse(await c.req.json().catch(() => null))
    if (!body.success) {
      return c.json(
        { error: `Новый пароль: от ${PASSWORD_MIN} до ${PASSWORD_MAX} символов` },
        400,
      )
    }

    const consumed = await consumePasswordResetToken(body.data.token.trim())
    if (!consumed.ok) {
      return c.json({ error: consumed.error }, 400)
    }

    const passwordHash = await hashPassword(body.data.newPassword)
    const user = await prisma.user.findUnique({
      where: { id: consumed.userId },
      select: { email: true },
    })
    await prisma.$transaction([
      prisma.user.update({
        where: { id: consumed.userId },
        data: { passwordHash, tokenVersion: { increment: 1 } },
      }),
      prisma.passwordResetToken.update({
        where: { id: consumed.tokenId },
        data: { usedAt: new Date() },
      }),
      prisma.passwordResetToken.updateMany({
        where: { userId: consumed.userId, usedAt: null, id: { not: consumed.tokenId } },
        data: { usedAt: new Date() },
      }),
    ])
    // Intentionally do not set a new session cookie — user must log in again.

    if (user?.email) {
      await logPasswordResetEvent({
        email: user.email,
        userId: consumed.userId,
        ip: clientIp(c),
        status: 'completed',
      })
    }

    return c.json({ ok: true, message: 'Пароль обновлён — войди с новым паролем' })
  },
)

authRoutes.get('/me', requireAuth, async (c) => {
  const user = await authedUserJson(c.get('userId'))
  if (!user) return c.json({ error: 'Аккаунт не найден' }, 404)
  return c.json({ user })
})
