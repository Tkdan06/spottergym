import { Hono } from 'hono'
import { deleteCookie, setCookie } from 'hono/cookie'
import { z } from 'zod'
import { prisma } from '../db.js'
import { isMasterAdminEmail, normalizeEmail } from '../env.js'
import { FULL_PERMISSIONS, resolveAdminFlags } from '../lib/admin.js'
import { signSession } from '../lib/jwt.js'
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
import { isEmailBlocked } from '../lib/blocks.js'
import { createNotification } from '../lib/notify.js'
import {
  consumePasswordResetToken,
  issuePasswordResetForUser,
} from '../lib/passwordReset.js'
import { rateLimit } from '../middleware/rateLimit.js'

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
  rateLimit({ windowMs: 60_000, max: 8, route: 'auth-register' }),
  async (c) => {
    const body = registerSchema.safeParse(await c.req.json().catch(() => null))
    if (!body.success) {
      return c.json({ error: 'Некорректные данные регистрации' }, 400)
    }
    const email = normalizeEmail(body.data.email)
    if (await isEmailBlocked(email)) {
      return c.json({ error: 'Этот email заблокирован' }, 403)
    }
    if (await prisma.user.findUnique({ where: { email } })) {
      return c.json({ error: 'Аккаунт с таким email уже есть — войди' }, 409)
    }

    // Обычная регистрация никогда не выдаёт админку.
    // Единственный админ — MASTER_ADMIN_EMAIL (tkdan@ya.ru): флаги выставляет resolveAdminFlags.
    const master = isMasterAdminEmail(email)
    const passwordHash = await hashPassword(body.data.password)
    const displayName = master ? 'Bogdan' : body.data.name
    const username = await allocateUsername(displayName)
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
      },
      include: { gyms: true, checkIns: { where: { checkedOutAt: null }, take: 1 } },
    })

    const inviteFrom = body.data.inviteFrom?.trim()
    if (inviteFrom && inviteFrom !== user.id) {
      const inviter = await prisma.user.findUnique({ where: { id: inviteFrom } })
      if (inviter) {
        await prisma.invite.create({
          data: { inviterId: inviter.id, inviteeId: user.id },
        }).catch(() => undefined)
        await createNotification({
          userId: inviter.id,
          type: 'system',
          title: 'Друг зарегистрировался',
          body: `${user.name} присоединился по твоей ссылке`,
          href: `/app/user/${user.id}`,
          actorId: user.id,
        })
      }
    }

    const token = await signSession({ sub: user.id, email: user.email })
    setSessionCookie(c, token)
    return c.json({ user: serializeUser(user), token }, 201)
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

    const token = await signSession({ sub: user.id, email: user.email })
    setSessionCookie(c, token)
    return c.json({ user: serializeUser(user), token })
  },
)

authRoutes.post('/logout', async (c) => {
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
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    })

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
    // Same response whether or not the account exists (anti-enumeration)
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, deletedAt: true },
    })

    if (user && !user.deletedAt && !(await isEmailBlocked(email))) {
      try {
        await issuePasswordResetForUser(user)
      } catch (err) {
        console.warn('[password-reset] send failed', err)
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
    await prisma.$transaction([
      prisma.user.update({
        where: { id: consumed.userId },
        data: { passwordHash },
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

    return c.json({ ok: true, message: 'Пароль обновлён — войди с новым паролем' })
  },
)

authRoutes.get('/me', requireAuth, async (c) => {
  const user = await authedUserJson(c.get('userId'))
  if (!user) return c.json({ error: 'Аккаунт не найден' }, 404)
  return c.json({ user })
})
