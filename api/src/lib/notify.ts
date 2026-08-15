import type { NotificationPrefs as PrefsRow } from '@prisma/client'
import { prisma } from '../db.js'
import { sendPushToUser, shouldSendPush } from './push.js'

export type NotifType =
  | 'gym_new_member'
  | 'like'
  | 'chat_request'
  | 'checkin'
  | 'coach'
  | 'system'
  | 'admin'
  | 'workout_reminder'
  | 'new_registration'

const TYPE_PREF: Record<NotifType, keyof Omit<PrefsRow, 'userId' | 'enabled'> | null> = {
  gym_new_member: 'gymNewMembers',
  like: 'likes',
  chat_request: 'chatRequests',
  checkin: 'checkins',
  coach: 'coaches',
  system: 'system',
  admin: 'system',
  workout_reminder: 'workoutReminders',
  new_registration: 'newRegistrations',
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
  /** Skip user prefs (e.g. critical admin ticket alerts). */
  force?: boolean
}) {
  if (!input.force) {
    const prefs = await getOrCreatePrefs(input.userId)
    if (!prefs.enabled) return null
    const key = TYPE_PREF[input.type]
    if (key && !prefs[key]) return null
  }

  const row = await prisma.notification.create({
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

  if (shouldSendPush(input.type) || input.force) {
    void sendPushToUser(input.userId, {
      title: row.title,
      body: row.body,
      href: row.href || undefined,
      type: row.type,
    }).catch((err) => console.warn('[push] after notify', err))
  }

  return row
}

/** OS push + badge for a new chat message — does not create a bell feed item. */
export async function pushChatMessage(input: {
  userId: string
  senderName: string
  text: string
  conversationId: string
}) {
  const prefs = await getOrCreatePrefs(input.userId)
  // chatRequests gates OS pushes for chat traffic (requests + messages)
  if (!prefs.enabled || !prefs.chatRequests) return 0

  const title = (input.senderName || 'Новое сообщение').slice(0, 80)
  const body = input.text.slice(0, 160)
  return sendPushToUser(input.userId, {
    title,
    body,
    href: `/app/messages/${input.conversationId}`,
    type: 'chat_message',
    conversationId: input.conversationId,
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
    workoutReminders: p.workoutReminders,
    newRegistrations: p.newRegistrations,
  }
}
