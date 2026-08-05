import { Hono } from 'hono'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../db.js'
import {
  AVATAR_MAX_CHARS,
  BIO_MAX,
  BREAK_UNTIL_MAX,
  CITY_MAX,
  GYM_IDS_MAX,
  GYM_ID_MAX,
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
import { notifyGymMembers } from '../lib/gymNotify.js'
import { isAllowedAvatarDataUrl, isAllowedPhotoDataUrl } from '../lib/photos.js'
import { serializeUser } from '../lib/serialize.js'
import { isValidUsername, normalizeUsername } from '../lib/username.js'
import {
  loadAuthedUser,
  requireAuth,
  type AuthedEnv,
} from '../middleware/auth.js'

const tagList = z.array(z.string().trim().min(1).max(TAG_ITEM_MAX)).max(TAGS_MAX)

const patchSchema = z
  .object({
    name: z.string().trim().min(NAME_MIN).max(NAME_MAX).optional(),
    username: z.string().trim().min(USERNAME_MIN).max(USERNAME_MAX).optional(),
    age: z.number().int().min(18).max(80).optional(),
    gender: z.enum(['female', 'male']).optional(),
    bio: z.string().max(BIO_MAX).optional(),
    photos: z.array(z.string().max(PHOTO_DATA_URL_MAX_CHARS)).max(PHOTO_MAX_COUNT).optional(),
    avatar: z.string().max(AVATAR_MAX_CHARS).optional(),
    city: z.string().max(CITY_MAX).optional(),
    homeGymId: z.string().max(GYM_ID_MAX).nullable().optional(),
    gymIds: z.array(z.string().max(GYM_ID_MAX)).max(GYM_IDS_MAX).optional(),
    intent: z.enum(['dating', 'buddy', 'both']).optional(),
    experienceLevel: z.enum(['newbie', 'confident', 'experienced', 'pro']).optional(),
    interests: tagList.optional(),
    sports: tagList.optional(),
    isCoach: z.boolean().optional(),
    coachSports: tagList.optional(),
    visitSlots: z.array(z.unknown()).max(VISIT_SLOTS_MAX).optional(),
    breakUntil: z.string().max(BREAK_UNTIL_MAX).nullable().optional(),
    privacy: z.enum(['open', 'anonymous']).optional(),
    lookingToMeet: z.boolean().optional(),
    onboardingDone: z.boolean().optional(),
  })
  .strict()

export const meRoutes = new Hono<AuthedEnv>()

meRoutes.use('*', requireAuth)

meRoutes.get('/', async (c) => {
  const user = await loadAuthedUser(c.get('userId'))
  if (!user) return c.json({ error: 'Аккаунт не найден' }, 404)
  return c.json({ user: serializeUser(user) })
})

meRoutes.patch('/', async (c) => {
  const body = patchSchema.safeParse(await c.req.json().catch(() => null))
  if (!body.success) {
    return c.json({ error: 'Некорректные данные профиля' }, 400)
  }
  const userId = c.get('userId')
  const data = { ...body.data }

  if (data.photos) {
    if (!data.photos.every((p) => isAllowedPhotoDataUrl(p))) {
      return c.json({ error: 'Фото: только JPEG, PNG или WebP (data URL)' }, 400)
    }
  }
  if (data.avatar !== undefined && data.avatar !== '') {
    if (!isAllowedAvatarDataUrl(data.avatar)) {
      return c.json({ error: 'Аватар: только JPEG, PNG или WebP (data URL)' }, 400)
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

  if (data.gymIds) {
    const unique = [...new Set(data.gymIds)]
    const existing = await prisma.gym.findMany({
      where: { id: { in: unique } },
      select: { id: true },
    })
    const okIds = new Set(existing.map((g) => g.id))
    const gymIds = unique.filter((id) => okIds.has(id))

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
        : gymIds[0] || null

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

  return c.json({ user: serializeUser(user) })
})

meRoutes.post('/check-in', async (c) => {
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
    await notifyGymMembers({
      actorId: userId,
      gymId: body.data.gymId,
      type: 'checkin',
      title: 'Кто-то в зале',
      body: `${user.name} отметился в ${gymLabel}`,
    })
    if (user.isCoach) {
      await notifyGymMembers({
        actorId: userId,
        gymId: body.data.gymId,
        type: 'coach',
        title: 'Тренер в зале',
        body: `${user.name} сейчас в ${gymLabel}`,
      })
    }
  }
  return c.json({ user: user ? serializeUser(user) : null })
})

meRoutes.post('/check-out', async (c) => {
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
  return c.json({ user: user ? serializeUser(user) : null })
})

/** Still at the gym — push expiry +1h (max 2 extends). */
meRoutes.post('/check-in/extend', async (c) => {
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
  return c.json({ user: user ? serializeUser(user) : null })
})

meRoutes.post('/gyms/:gymId', async (c) => {
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
    await notifyGymMembers({
      actorId: userId,
      gymId,
      type: 'gym_new_member',
      title: 'Новый человек в зале',
      body: `${user.name} присоединился к ${gym.name}`,
    })
  }

  const next = await loadAuthedUser(userId)
  return c.json({ user: next ? serializeUser(next) : null })
})

meRoutes.delete('/gyms/:gymId', async (c) => {
  const userId = c.get('userId')
  const gymId = c.req.param('gymId')
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
  return c.json({ user: next ? serializeUser(next) : null })
})
