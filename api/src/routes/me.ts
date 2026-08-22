import { Hono } from 'hono'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../db.js'
import {
  AVATAR_MAX_CHARS,
  BIO_MAX,
  BIO_MIN,
  BREAK_UNTIL_MAX,
  CITY_MAX,
  GYM_IDS_MAX,
  GYM_ID_MAX,
  INSTAGRAM_MAX,
  NAME_MAX,
  NAME_MIN,
  PHOTO_DATA_URL_MAX_CHARS,
  PHOTO_MAX_COUNT,
  TAG_ITEM_MAX,
  TAGS_MAX,
  USERNAME_MAX,
  USERNAME_MIN,
  VISIT_SLOTS_MAX,
} from '../lib/fieldLimits.js'
import {
  CHECK_IN_EXTEND_MS,
  CHECK_IN_MAX_EXTENDS,
  canExtendCheckIn,
  defaultExpiresAt,
  expireStaleCheckIns,
  resolveExpiresAt,
} from '../lib/checkInExpiry.js'
import { moscowDayKey, moscowDayStartUtc } from '../lib/adminAnalytics.js'
import { buildMyActivityStats, type ActivityRange } from '../lib/activityStats.js'
import { notifyGymMembers } from '../lib/gymNotify.js'
import {
  deleteRemovedMedia,
  persistAvatar,
  persistPhotoList,
} from '../lib/mediaStore.js'
import { isAllowedAvatarRef, isAllowedPhotoRef } from '../lib/photos.js'
import { isValidInstagram, normalizeInstagram } from '../lib/instagram.js'
import { serializeUser } from '../lib/serialize.js'
import {
  buildInviteCircle,
  getReferralStatsForUser,
} from '../lib/referralStats.js'
import { SoftDeleteError, softDeleteUser } from '../lib/softDeleteUser.js'
import { isValidUsername, normalizeUsername } from '../lib/username.js'
import { ensureWelcomeInstallNotification } from '../lib/welcomeInstall.js'
import { createNotification } from '../lib/notify.js'
import { referralTierFromCount } from '../lib/referralTiers.js'
import {
  loadAuthedUser,
  requireAuth,
  type AuthedEnv,
} from '../middleware/auth.js'
import { rateLimit } from '../middleware/rateLimit.js'
import { workoutRoutes } from './meWorkouts.js'

const tagList = z.array(z.string().trim().min(1).max(TAG_ITEM_MAX)).max(TAGS_MAX)

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const
const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/

function normalizeTime(value: string) {
  const m = TIME_RE.exec(value.trim())
  if (!m) return null
  const [h, min] = value.trim().split(':')
  return `${h.padStart(2, '0')}:${min}`
}

const visitSlotSchema = z
  .object({
    day: z.enum(WEEKDAYS),
    from: z.string().trim(),
    to: z.string().trim(),
  })
  .transform((slot, ctx) => {
    const from = normalizeTime(slot.from)
    const to = normalizeTime(slot.to)
    if (!from || !to) {
      ctx.addIssue({ code: 'custom', message: 'bad_time' })
      return z.NEVER
    }
    return { day: slot.day, from, to }
  })

const patchSchema = z
  .object({
    name: z.string().trim().min(NAME_MIN).max(NAME_MAX).optional(),
    username: z.string().trim().min(USERNAME_MIN).max(USERNAME_MAX).optional(),
    /** Empty string clears the link */
    instagram: z.string().max(INSTAGRAM_MAX + 64).optional(),
    age: z.number().int().min(18).max(80).optional(),
    gender: z.enum(['female', 'male']).optional(),
    bio: z.string().min(BIO_MIN).max(BIO_MAX).optional(),
    photos: z.array(z.string().max(PHOTO_DATA_URL_MAX_CHARS)).max(PHOTO_MAX_COUNT).optional(),
    avatar: z.string().max(AVATAR_MAX_CHARS).optional(),
    city: z.string().max(CITY_MAX).optional(),
    homeGymId: z.string().max(GYM_ID_MAX).nullable().optional(),
    gymIds: z.array(z.string().max(GYM_ID_MAX)).min(1).max(GYM_IDS_MAX).optional(),
    intent: z.enum(['dating', 'buddy', 'both']).optional(),
    experienceLevel: z.enum(['newbie', 'confident', 'experienced', 'pro']).optional(),
    interests: tagList.optional(),
    sports: tagList.optional(),
    isCoach: z.boolean().optional(),
    coachSports: tagList.optional(),
    visitSlots: z.array(visitSlotSchema).max(VISIT_SLOTS_MAX).optional(),
    breakUntil: z.string().max(BREAK_UNTIL_MAX).nullable().optional(),
    privacy: z.enum(['open', 'anonymous']).optional(),
    lookingToMeet: z.boolean().optional(),
    onboardingDone: z.boolean().optional(),
  })
  .strict()

function publicActorName(user: { name: string; privacy: string }) {
  return user.privacy === 'anonymous' ? 'Аноним' : user.name
}

async function serializeMe(
  user: NonNullable<Awaited<ReturnType<typeof loadAuthedUser>>>,
) {
  const referral = await getReferralStatsForUser(user.id)
  return serializeUser(user, { referral })
}

export const meRoutes = new Hono<AuthedEnv>()

meRoutes.use('*', requireAuth)
meRoutes.route('/', workoutRoutes)

meRoutes.get('/', async (c) => {
  const user = await loadAuthedUser(c.get('userId'))
  if (!user) return c.json({ error: 'Аккаунт не найден' }, 404)
  const referral = await getReferralStatsForUser(user.id)
  return c.json({ user: serializeUser(user, { referral }) })
})

/** Invite circle: credited friends, pending, tier progress */
meRoutes.get(
  '/referrals',
  rateLimit({ windowMs: 60_000, max: 60, route: 'me-referrals' }),
  async (c) => {
    const circle = await buildInviteCircle(c.get('userId'))
    return c.json({ circle })
  },
)

/** Personal check-in history / gym time stats (MSK days). */
meRoutes.get(
  '/activity',
  rateLimit({ windowMs: 60_000, max: 60, route: 'me-activity' }),
  async (c) => {
    const raw = c.req.query('range') || '30'
    const rangeNum = Number(raw)
    const range: ActivityRange =
      rangeNum === 7 || rangeNum === 90 || rangeNum === 30 ? (rangeNum as ActivityRange) : 30

    void expireStaleCheckIns()
    const stats = await buildMyActivityStats(c.get('userId'), range)
    return c.json({ activity: stats })
  },
)

/**
 * Clear personal gym activity history used for the stats chart.
 * Keeps the current open check-in so the user stays on the floor.
 */
meRoutes.delete(
  '/activity',
  rateLimit({ windowMs: 60_000, max: 6, route: 'me-activity-reset' }),
  async (c) => {
    const userId = c.get('userId')
    await expireStaleCheckIns()
    const result = await prisma.checkIn.deleteMany({
      where: {
        userId,
        checkedOutAt: { not: null },
      },
    })
    return c.json({ ok: true, deleted: result.count })
  },
)

const MSK_DAY_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Remove check-ins that started on one MSK day (including an open “Я в зале”).
 * Separate path so an older server cannot treat this as a full history wipe.
 */
meRoutes.delete(
  '/activity/day/:date',
  rateLimit({ windowMs: 60_000, max: 12, route: 'me-activity-day' }),
  async (c) => {
    const raw = (c.req.param('date') || '').trim()
    if (!MSK_DAY_RE.test(raw)) {
      return c.json({ error: 'Некорректная дата' }, 400)
    }
    const start = moscowDayStartUtc(raw)
    if (Number.isNaN(start.getTime()) || moscowDayKey(start) !== raw) {
      return c.json({ error: 'Некорректная дата' }, 400)
    }
    const todayKey = moscowDayKey(new Date())
    if (raw > todayKey) {
      return c.json({ error: 'Нельзя удалить будущий день' }, 400)
    }

    const userId = c.get('userId')
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
    await expireStaleCheckIns()

    const dayFilter = {
      userId,
      checkedInAt: { gte: start, lt: end },
    }
    const openCount = await prisma.checkIn.count({
      where: { ...dayFilter, checkedOutAt: null },
    })
    const result = await prisma.checkIn.deleteMany({ where: dayFilter })
    if (result.count === 0) {
      return c.json({ error: 'В этот день отметок не было' }, 404)
    }

    return c.json({
      ok: true,
      deleted: result.count,
      date: raw,
      clearedPresence: openCount > 0,
    })
  },
)

/** Throttled presence bump — counts as app activity without check-in. */
meRoutes.post(
  '/heartbeat',
  rateLimit({ windowMs: 60_000, max: 8, route: 'me-heartbeat' }),
  async (c) => {
    const userId = c.get('userId')
    const now = new Date()
    await prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: now },
    })
    return c.json({ ok: true, lastSeenAt: now.toISOString() })
  },
)

meRoutes.patch(
  '/',
  rateLimit({ windowMs: 60_000, max: 30, route: 'me-patch' }),
  async (c) => {
  const body = patchSchema.safeParse(await c.req.json().catch(() => null))
  if (!body.success) {
    return c.json({ error: 'Некорректные данные профиля' }, 400)
  }
  const userId = c.get('userId')
  const data = { ...body.data }

  if (data.photos) {
    if (!data.photos.every((p) => isAllowedPhotoRef(p))) {
      return c.json({ error: 'Фото: JPEG, PNG, WebP или сохранённый файл' }, 400)
    }
    try {
      const prevRow = await prisma.user.findUnique({
        where: { id: userId },
        select: { photos: true },
      })
      const prevPhotos = Array.isArray(prevRow?.photos)
        ? (prevRow.photos as string[])
        : []
      data.photos = await persistPhotoList(userId, data.photos)
      await deleteRemovedMedia(userId, prevPhotos, data.photos)
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: unknown }).code) : ''
      if (code === 'ENOSPC' || /no space|ENOSPC/i.test(String(err))) {
        return c.json({ error: 'На сервере закончилось место для фото. Попробуй позже' }, 507)
      }
      console.error('[me] photo persist failed', err)
      return c.json({ error: 'Не удалось сохранить фото' }, 400)
    }
  }
  if (data.avatar !== undefined && data.avatar !== '') {
    if (!isAllowedAvatarRef(data.avatar)) {
      return c.json({ error: 'Аватар: JPEG, PNG, WebP или сохранённый файл' }, 400)
    }
    try {
      data.avatar = await persistAvatar(userId, data.avatar)
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: unknown }).code) : ''
      if (code === 'ENOSPC' || /no space|ENOSPC/i.test(String(err))) {
        return c.json({ error: 'На сервере закончилось место для фото. Попробуй позже' }, 507)
      }
      console.error('[me] avatar persist failed', err)
      return c.json({ error: 'Не удалось сохранить аватар' }, 400)
    }
  }

  if (data.username !== undefined) {
    const username = normalizeUsername(data.username)
    if (!isValidUsername(username)) {
      return c.json(
        {
          error:
            'Ник: 3–20 символов, латиница, цифры и _. Без пробелов и спецсимволов',
        },
        400,
      )
    }
    const taken = await prisma.user.findFirst({
      where: { username, NOT: { id: userId } },
      select: { id: true },
    })
    if (taken) {
      return c.json({ error: 'Этот @ник уже занят' }, 409)
    }
    data.username = username
  }

  if (data.instagram !== undefined) {
    const instagram = normalizeInstagram(data.instagram)
    if (!isValidInstagram(instagram)) {
      return c.json(
        {
          error:
            'Instagram: до 30 символов, латиница, цифры, точка и _. Или оставь пустым',
        },
        400,
      )
    }
    data.instagram = instagram
  }

  if (data.gymIds) {
    const unique = [...new Set(data.gymIds)]
    const existing = await prisma.gym.findMany({
      where: { id: { in: unique } },
      select: { id: true },
    })
    const okIds = new Set(existing.map((g) => g.id))
    const gymIds = unique.filter((id) => okIds.has(id))
    if (gymIds.length < 1) {
      return c.json({ error: 'Нужен хотя бы один зал' }, 400)
    }

    await prisma.$transaction([
      prisma.userGym.deleteMany({
        where: { userId, gymId: { notIn: gymIds } },
      }),
      ...gymIds.map((gymId) =>
        prisma.userGym.upsert({
          where: { userId_gymId: { userId, gymId } },
          create: { userId, gymId },
          update: {},
        }),
      ),
    ])

    const homeGymId =
      data.homeGymId && gymIds.includes(data.homeGymId)
        ? data.homeGymId
        : gymIds[0]

    await prisma.user.update({
      where: { id: userId },
      data: { homeGymId },
    })
  }

  const {
    gymIds: _g,
    homeGymId: homeFromBody,
    visitSlots: visitSlotsRaw,
    ...rest
  } = data

  // Setting an active break clears any open check-in (XOR presence)
  if (rest.breakUntil) {
    const now = new Date()
    await prisma.checkIn.updateMany({
      where: { userId, checkedOutAt: null },
      data: { checkedOutAt: now },
    })
  }

  const finishingOnboarding = data.onboardingDone === true
  const wasOnboarded = finishingOnboarding
    ? Boolean(
        (
          await prisma.user.findUnique({
            where: { id: userId },
            select: { onboardingDone: true },
          })
        )?.onboardingDone,
      )
    : true

  const dataUpdate: Prisma.UserUpdateInput = {
    ...rest,
    lastSeenAt: new Date(),
  }
  if (homeFromBody !== undefined && !data.gymIds) {
    dataUpdate.homeGymId = homeFromBody
  }
  if (visitSlotsRaw !== undefined) {
    dataUpdate.visitSlots = visitSlotsRaw as Prisma.InputJsonValue
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: dataUpdate,
    include: {
      gyms: true,
      checkIns: { where: { checkedOutAt: null }, take: 1 },
    },
  })

  // После онбординга — welcome в колокольчик со soft ask поставить ярлык (без OS push).
  if (finishingOnboarding && !wasOnboarded) {
    await ensureWelcomeInstallNotification(userId).catch((err) =>
      console.warn('[welcome-install] notify failed', err),
    )
    // Credit inviter: friend finished onboarding → +1 to circle / maybe new tier
    const invite = await prisma.invite.findUnique({
      where: { inviteeId: userId },
      select: { inviterId: true },
    })
    if (invite?.inviterId) {
      const credited = await prisma.user.count({
        where: {
          deletedAt: null,
          onboardingDone: true,
          id: {
            in: (
              await prisma.invite.findMany({
                where: { inviterId: invite.inviterId },
                select: { inviteeId: true },
              })
            ).map((i) => i.inviteeId),
          },
        },
      })
      const tier = referralTierFromCount(credited)
      const prevTier = referralTierFromCount(Math.max(0, credited - 1))
      const leveledUp = tier.id > prevTier.id && tier.title
      await createNotification({
        userId: invite.inviterId,
        type: 'system',
        title: leveledUp ? `Новый статус: ${tier.title}` : 'Друг в круге Spotter',
        body: leveledUp
          ? `${user.name} завершил онбординг — ты ${tier.title} (${credited})`
          : `${user.name} завершил онбординг по твоей ссылке · ${credited} в круге`,
        href: '/app/invite',
        actorId: userId,
      }).catch((err) => console.warn('[referral] credit notify failed', err))
    }
  }

  const referral = await getReferralStatsForUser(user.id)
  return c.json({ user: serializeUser(user, { referral }) })
  },
)

meRoutes.post(
  '/check-in',
  rateLimit({ windowMs: 60_000, max: 12, route: 'me-check-in' }),
  async (c) => {
  const body = z
    .object({ gymId: z.string().min(1).max(GYM_ID_MAX) })
    .safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'Укажи зал' }, 400)

  const userId = c.get('userId')
  const membership = await prisma.userGym.findUnique({
    where: { userId_gymId: { userId, gymId: body.data.gymId } },
  })
  if (!membership) {
    return c.json({ error: 'Сначала добавь этот зал в профиль' }, 400)
  }

  const now = new Date()
  await prisma.checkIn.updateMany({
    where: { userId, checkedOutAt: null },
    data: { checkedOutAt: now },
  })

  await prisma.checkIn.create({
    data: {
      userId,
      gymId: body.data.gymId,
      checkedInAt: now,
      expiresAt: defaultExpiresAt(now),
      extendCount: 0,
    },
  })

  await prisma.user.update({
    where: { id: userId },
    data: { homeGymId: body.data.gymId, lastSeenAt: now, breakUntil: null },
  })

  const user = await loadAuthedUser(userId)
  if (user) {
    const gym = await prisma.gym.findUnique({ where: { id: body.data.gymId } })
    const gymLabel = gym?.name || 'зале'
    const who = publicActorName(user)
    await notifyGymMembers({
      actorId: userId,
      gymId: body.data.gymId,
      type: 'checkin',
      title: 'Кто-то в зале',
      body: `${who} отметился в ${gymLabel}`,
    })
    if (user.isCoach) {
      await notifyGymMembers({
        actorId: userId,
        gymId: body.data.gymId,
        type: 'coach',
        title: 'Тренер в зале',
        body: `${who} сейчас в ${gymLabel}`,
      })
    }
  }
  return c.json({ user: user ? await serializeMe(user) : null })
  },
)

meRoutes.post(
  '/check-out',
  rateLimit({ windowMs: 60_000, max: 20, route: 'me-check-out' }),
  async (c) => {
  const userId = c.get('userId')
  await prisma.checkIn.updateMany({
    where: { userId, checkedOutAt: null },
    data: { checkedOutAt: new Date() },
  })
  await prisma.user.update({
    where: { id: userId },
    data: { lastSeenAt: new Date() },
  })
  const user = await loadAuthedUser(userId)
  return c.json({ user: user ? await serializeMe(user) : null })
  },
)

/** Still at the gym — push expiry +1h (max 2 extends). */
meRoutes.post(
  '/check-in/extend',
  rateLimit({ windowMs: 60_000, max: 20, route: 'me-check-extend' }),
  async (c) => {
  const userId = c.get('userId')
  await expireStaleCheckIns()
  const open = await prisma.checkIn.findFirst({
    where: { userId, checkedOutAt: null },
    orderBy: { checkedInAt: 'desc' },
  })
  if (!open) return c.json({ error: 'Сейчас ты не в зале' }, 400)

  const now = new Date()
  const expiresAt = resolveExpiresAt(open.checkedInAt, open.expiresAt)
  if (!canExtendCheckIn(open.extendCount, expiresAt, now)) {
    return c.json(
      {
        error:
          open.extendCount >= CHECK_IN_MAX_EXTENDS
            ? 'Лимит продлений исчерпан — отметься заново'
            : 'Сессия уже закончилась',
      },
      400,
    )
  }

  const nextExpires = new Date(Math.max(expiresAt.getTime(), now.getTime()) + CHECK_IN_EXTEND_MS)
  await prisma.checkIn.update({
    where: { id: open.id },
    data: {
      expiresAt: nextExpires,
      extendCount: open.extendCount + 1,
    },
  })
  await prisma.user.update({
    where: { id: userId },
    data: { lastSeenAt: now },
  })

  const user = await loadAuthedUser(userId)
  return c.json({ user: user ? await serializeMe(user) : null })
  },
)

meRoutes.post(
  '/gyms/:gymId',
  rateLimit({ windowMs: 60_000, max: 30, route: 'me-gym-join' }),
  async (c) => {
  const userId = c.get('userId')
  const gymId = c.req.param('gymId')
  const gym = await prisma.gym.findUnique({ where: { id: gymId } })
  if (!gym) return c.json({ error: 'Зал не найден' }, 404)

  const makeHome = c.req.query('home') === '1'
  const existing = await prisma.userGym.findUnique({
    where: { userId_gymId: { userId, gymId } },
  })
  await prisma.userGym.upsert({
    where: { userId_gymId: { userId, gymId } },
    create: { userId, gymId },
    update: {},
  })

  const user = await prisma.user.findUnique({ where: { id: userId } })
  await prisma.user.update({
    where: { id: userId },
    data: {
      homeGymId: makeHome || !user?.homeGymId ? gymId : user.homeGymId,
      city: user?.city || gym.city,
      lastSeenAt: new Date(),
    },
  })

  if (!existing && user) {
    const who = publicActorName(user)
    await notifyGymMembers({
      actorId: userId,
      gymId,
      type: 'gym_new_member',
      title: 'Новый человек в зале',
      body: `${who} присоединился к ${gym.name}`,
    })
  }

  const next = await loadAuthedUser(userId)
  return c.json({ user: next ? await serializeMe(next) : null })
  },
)

meRoutes.delete(
  '/gyms/:gymId',
  rateLimit({ windowMs: 60_000, max: 30, route: 'me-gym-leave' }),
  async (c) => {
  const userId = c.get('userId')
  const gymId = c.req.param('gymId')

  const membershipCount = await prisma.userGym.count({ where: { userId } })
  const isMember = await prisma.userGym.findUnique({
    where: { userId_gymId: { userId, gymId } },
  })
  if (isMember && membershipCount <= 1) {
    return c.json({ error: 'Нельзя убрать последний зал. Сначала добавь другой.' }, 400)
  }

  await prisma.userGym.deleteMany({ where: { userId, gymId } })
  await prisma.checkIn.updateMany({
    where: { userId, gymId, checkedOutAt: null },
    data: { checkedOutAt: new Date() },
  })

  const remaining = await prisma.userGym.findMany({ where: { userId } })
  const user = await prisma.user.findUnique({ where: { id: userId } })
  const homeGymId =
    user?.homeGymId && remaining.some((g) => g.gymId === user.homeGymId)
      ? user.homeGymId
      : remaining[0]?.gymId || null

  await prisma.user.update({
    where: { id: userId },
    data: { homeGymId, lastSeenAt: new Date() },
  })

  const next = await loadAuthedUser(userId)
  return c.json({ user: next ? await serializeMe(next) : null })
  },
)

meRoutes.post(
  '/delete-account',
  rateLimit({ windowMs: 60 * 60_000, max: 3, route: 'me-delete-account' }),
  async (c) => {
    const body = z
      .object({ confirm: z.literal('DELETE') })
      .safeParse(await c.req.json().catch(() => null))
    if (!body.success) {
      return c.json({ error: 'Подтверди удаление: confirm = DELETE' }, 400)
    }
    const userId = c.get('userId')
    try {
      await softDeleteUser(userId, { actorId: userId, allowSelf: true })
      return c.json({ ok: true })
    } catch (err) {
      if (err instanceof SoftDeleteError) {
        return c.json({ error: err.message }, err.status)
      }
      throw err
    }
  },
)
