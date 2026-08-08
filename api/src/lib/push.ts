import webpush from 'web-push'
import { env } from '../env.js'
import { prisma } from '../db.js'
import type { NotifType } from './notify.js'

/** Types that also fire an OS push (not every in-app bell ping). */
const PUSH_TYPES = new Set<NotifType>(['like', 'chat_request', 'admin', 'workout_reminder'])

let configured = false

export function isPushConfigured() {
  return Boolean(env.vapidPublicKey && env.vapidPrivateKey)
}

function ensureVapid() {
  if (configured) return isPushConfigured()
  configured = true
  if (!isPushConfigured()) {
    console.warn('[push] VAPID keys missing — Web Push disabled')
    return false
  }
  webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey)
  return true
}

export function getVapidPublicKey() {
  return isPushConfigured() ? env.vapidPublicKey : ''
}

export function shouldSendPush(type: NotifType) {
  return PUSH_TYPES.has(type)
}

/** Icon badge = unread bell items + unread chat messages. */
export async function countUnreadBadge(userId: string) {
  const [notifCount, lowAgg, highAgg] = await Promise.all([
    prisma.notification.count({
      where: {
        userId,
        read: false,
        NOT: { title: 'Новое сообщение' },
      },
    }),
    prisma.conversation.aggregate({
      where: { userLowId: userId },
      _sum: { unreadLow: true },
    }),
    prisma.conversation.aggregate({
      where: { userHighId: userId },
      _sum: { unreadHigh: true },
    }),
  ])
  const chatUnread = (lowAgg._sum.unreadLow || 0) + (highAgg._sum.unreadHigh || 0)
  return notifCount + chatUnread
}

export async function sendPushToUser(
  userId: string,
  payload: {
    title: string
    body: string
    href?: string
    type?: string
  },
) {
  if (!ensureVapid()) return 0

  const subs = await prisma.pushSubscription.findMany({ where: { userId } })
  if (!subs.length) {
    console.warn('[push] no subscriptions for user', userId, 'type', payload.type)
    return 0
  }

  const unreadCount = await countUnreadBadge(userId)
  const data = JSON.stringify({
    title: payload.title,
    body: payload.body,
    href: payload.href || '/app/notifications',
    type: payload.type || 'system',
    unreadCount,
  })

  // High urgency for chat/likes so locked-screen devices deliver sooner when possible.
  const urgency =
    payload.type === 'chat_message' || payload.type === 'like' ? 'high' : 'normal'

  let sent = 0
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          data,
          { TTL: 60 * 60 * 12, urgency },
        )
        sent += 1
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.deleteMany({ where: { id: sub.id } })
          console.warn('[push] dropped stale subscription', sub.id)
        } else {
          console.warn('[push] send failed', status || err)
        }
      }
    }),
  )
  if (!sent && subs.length) {
    console.warn('[push] 0 delivered for user', userId, 'type', payload.type)
  }
  return sent
}
