import { prisma } from '../db.js'
import { listHiddenUserIds } from './blocks.js'
import { createNotification } from './notify.js'

/** Notify gym members (bounded) about a new member / check-in / coach */
export async function notifyGymMembers(input: {
  actorId: string
  gymId: string
  type: 'gym_new_member' | 'checkin' | 'coach'
  title: string
  body: string
}) {
  const hidden = new Set(await listHiddenUserIds(input.actorId))
  const members = await prisma.userGym.findMany({
    where: {
      gymId: input.gymId,
      userId: { not: input.actorId },
    },
    select: { userId: true },
    take: 80,
  })

  await Promise.all(
    members
      .filter((m) => !hidden.has(m.userId))
      .map((m) =>
        createNotification({
          userId: m.userId,
          type: input.type,
          title: input.title,
          body: input.body,
          href: `/app/gym/${input.gymId}`,
          gymId: input.gymId,
          actorId: input.actorId,
        }),
      ),
  )
}
