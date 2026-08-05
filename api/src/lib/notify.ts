import type { NotificationPrefs as PrefsRow } from '@prisma/client'
import { prisma } from '../db.js'

export type NotifType =
  | 'gym_new_member'
  | 'like'
  | 'chat_request'
  | 'checkin'
  | 'coach'
  | 'system'
  | 'admin'

const TYPE_PREF: Record<NotifType, keyof Omit<PrefsRow, 'userId' | 'enabled'> | null> = {
  gym_new_member: 'gymNewMembers',
  like: 'likes',
  chat_request: 'chatRequests',
  checkin: 'checkins',
  coach: 'coaches',
  system: 'system',
  admin: 'system',
}

export async function getOrCreatePrefs(userId: string) {
  return prisma.notificationPrefs.upsert({
    where: { userId },
    create: { userId },
    update: {},
  })
}

export async function createNotification(input: {
  userId: string
  type: NotifType
  title: string
  body: string
  href?: string
  gymId?: string
  actorId?: string
}) {
  const prefs = await getOrCreatePrefs(input.userId)
  if (!prefs.enabled) return null
  const key = TYPE_PREF[input.type]
  if (key && !prefs[key]) return null

  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title.slice(0, 120),
      body: input.body.slice(0, 500),
      href: input.href?.slice(0, 200),
      gymId: input.gymId?.slice(0, 64),
      actorId: input.actorId?.slice(0, 64),
    },
  })
}

export function serializeNotification(n: {
  id: string
  type: string
  title: string
  body: string
  href: string | null
  gymId: string | null
  actorId: string | null
  read: boolean
  createdAt: Date
}) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    href: n.href || undefined,
    gymId: n.gymId || undefined,
    actorId: n.actorId || undefined,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  }
}

export function serializePrefs(p: PrefsRow) {
  return {
    enabled: p.enabled,
    gymNewMembers: p.gymNewMembers,
    likes: p.likes,
    chatRequests: p.chatRequests,
    checkins: p.checkins,
    coaches: p.coaches,
    system: p.system,
  }
}
