import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import { isMasterAdminEmail, normalizeEmail } from '../env.js'
import { deleteRemovedMedia, tryDeleteMediaPath } from './mediaStore.js'
import { hashPassword } from './password.js'

export class SoftDeleteError extends Error {
  status: 400 | 403 | 404
  constructor(message: string, status: 400 | 403 | 404) {
    super(message)
    this.status = status
  }
}

/**
 * Анонимизирует пользователя, но оставляет id — переписка сохраняется.
 * В чатах сериализуется как «Удалённый пользователь».
 */
export async function softDeleteUser(
  userId: string,
  options: { actorId: string; alsoBlockEmail?: boolean; allowSelf?: boolean },
) {
  const target = await prisma.user.findUnique({ where: { id: userId } })
  if (!target) throw new SoftDeleteError('Пользователь не найден', 404)
  if (target.deletedAt) return { ok: true as const, email: target.email }
  if (isMasterAdminEmail(target.email)) {
    throw new SoftDeleteError('Нельзя удалить главного админа', 400)
  }
  if (target.id === options.actorId && !options.allowSelf) {
    throw new SoftDeleteError('Нельзя удалить себя', 400)
  }

  const originalEmail = normalizeEmail(target.email)
  const deadHash = await hashPassword(`${randomUUID()}${randomUUID()}`)
  const tombstoneEmail = `deleted+${userId}@spotter.invalid`
  const tombstoneUsername = `deleted_${userId.replace(/[^a-z0-9]/gi, '').slice(0, 16)}`

  const prevPhotos = Array.isArray(target.photos) ? (target.photos as string[]) : []
  const prevAvatar = typeof target.avatar === 'string' ? target.avatar : ''

  await prisma.$transaction(async (tx) => {
    await tx.userGym.deleteMany({ where: { userId } })
    await tx.checkIn.deleteMany({ where: { userId } })
    await tx.like.deleteMany({
      where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
    })
    await tx.notification.deleteMany({ where: { userId } })
    await tx.pushSubscription.deleteMany({ where: { userId } })
    await tx.notificationPrefs.deleteMany({ where: { userId } })
    await tx.userBlock.deleteMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    })
    await tx.invite.deleteMany({
      where: { OR: [{ inviterId: userId }, { inviteeId: userId }] },
    })
    await tx.workoutReminderLog.deleteMany({ where: { userId } })

    await tx.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        email: tombstoneEmail,
        username: tombstoneUsername,
        passwordHash: deadHash,
        name: 'Удалённый пользователь',
        bio: '',
        photos: [],
        avatar: '',
        city: '',
        homeGymId: null,
        interests: [],
        sports: [],
        coachSports: [],
        isCoach: false,
        visitSlots: [],
        breakUntil: null,
        lookingToMeet: false,
        onboardingDone: true,
        isAdmin: false,
        isMasterAdmin: false,
        adminPermissions: Prisma.DbNull,
        privacy: 'open',
        tokenVersion: { increment: 1 },
        lastSeenAt: new Date(),
      },
    })

    if (options.alsoBlockEmail && originalEmail && !originalEmail.endsWith('@spotter.invalid')) {
      await tx.blockedEmail.upsert({
        where: { email: originalEmail },
        create: {
          email: originalEmail,
          reason: 'Удалён администратором',
          blockedById: options.actorId,
        },
        update: {
          reason: 'Удалён администратором',
          blockedById: options.actorId,
        },
      })
    }
  })

  // After DB tombstone — drop media files so old URLs 404
  await deleteRemovedMedia(userId, prevPhotos, []).catch(() => undefined)
  if (prevAvatar) await tryDeleteMediaPath(prevAvatar).catch(() => undefined)

  return { ok: true as const, email: originalEmail }
}
