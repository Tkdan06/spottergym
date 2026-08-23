import { prisma } from '../db.js'
import { createNotification } from './notify.js'
import { countCreditedInvites, incrementReferralCredit } from './referralStats.js'
import { referralTierFromCount } from './referralTiers.js'

export type AttachInviteResult = {
  attached: boolean
  already: boolean
  credited: boolean
}

export async function notifyInviteCredited(opts: {
  inviterId: string
  invitee: { id: string; name: string }
}): Promise<void> {
  const credited = await countCreditedInvites(opts.inviterId)
  const tier = referralTierFromCount(credited)
  const prevTier = referralTierFromCount(Math.max(0, credited - 1))
  const leveledUp = tier.id > prevTier.id && Boolean(tier.title)
  await createNotification({
    userId: opts.inviterId,
    type: 'system',
    title: leveledUp ? `Новый статус: ${tier.title}` : 'Друг в круге Spotter',
    body: leveledUp
      ? `${opts.invitee.name} завершил онбординг — ты ${tier.title} (${credited})`
      : `${opts.invitee.name} завершил онбординг по твоей ссылке · ${credited} в круге`,
    href: '/app/invite',
    actorId: opts.invitee.id,
  }).catch((err) => console.warn('[referral] credit notify failed', err))
}

/** Idempotent: one invitee can belong to only one inviter. */
export async function attachInvite(
  inviteeId: string,
  inviteFrom: string | null | undefined,
): Promise<AttachInviteResult> {
  const inviterId = inviteFrom?.trim()
  if (!inviterId || inviterId === inviteeId) {
    return { attached: false, already: false, credited: false }
  }

  const existing = await prisma.invite.findUnique({
    where: { inviteeId },
    select: { inviterId: true },
  })
  if (existing) {
    return { attached: false, already: true, credited: false }
  }

  const [inviter, invitee] = await Promise.all([
    prisma.user.findUnique({
      where: { id: inviterId },
      select: { id: true, deletedAt: true },
    }),
    prisma.user.findUnique({
      where: { id: inviteeId },
      select: { id: true, name: true, onboardingDone: true, deletedAt: true },
    }),
  ])

  if (!inviter || inviter.deletedAt || !invitee || invitee.deletedAt) {
    return { attached: false, already: false, credited: false }
  }

  try {
    await prisma.invite.create({
      data: { inviterId: inviter.id, inviteeId: invitee.id },
    })
  } catch (err) {
    console.warn('[invite] create failed', err)
    return { attached: false, already: false, credited: false }
  }

  if (invitee.onboardingDone) {
    await incrementReferralCredit(inviter.id)
    await notifyInviteCredited({ inviterId: inviter.id, invitee })
    return { attached: true, already: false, credited: true }
  }

  await createNotification({
    userId: inviter.id,
    type: 'system',
    title: 'Друг зарегистрировался',
    body: `${invitee.name} присоединился по твоей ссылке`,
    href: `/app/user/${invitee.id}`,
    actorId: invitee.id,
  }).catch((err) => console.warn('[invite] register notify failed', err))

  return { attached: true, already: false, credited: false }
}
