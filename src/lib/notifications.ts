import { DEMO_GYM_ID } from '../data/mock'
import type { AppNotification, NotificationPrefs, NotificationType } from '../types'

export const STORAGE_NOTIFICATIONS = 'spotter.notifications'
export const STORAGE_NOTIF_PREFS = 'spotter.notificationPrefs'

export const DEFAULT_NOTIF_PREFS: NotificationPrefs = {
  enabled: true,
  gymNewMembers: true,
  likes: true,
  chatRequests: true,
  checkins: false,
  coaches: true,
  system: true,
}

export const NOTIF_PREF_LABELS: {
  key: keyof Omit<NotificationPrefs, 'enabled'>
  title: string
  hint: string
}[] = [
  {
    key: 'gymNewMembers',
    title: 'Новые в зале',
    hint: 'Кто-то зарегистрировался в твоём клубе',
  },
  {
    key: 'likes',
    title: 'Лайки',
    hint: 'Тебя отметили на карточке',
  },
  {
    key: 'chatRequests',
    title: 'Запросы в чат',
    hint: 'Новые сообщения и запросы на диалог',
  },
  {
    key: 'checkins',
    title: 'Кто пришёл в зал',
    hint: 'Знакомые отметились на тренировке',
  },
  {
    key: 'coaches',
    title: 'Тренеры',
    hint: 'Тренер появился или отметился в клубе',
  },
  {
    key: 'system',
    title: 'Системные',
    hint: 'Новости Spotter и ответы поддержки',
  },
]

export const SEED_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n-1',
    type: 'gym_new_member',
    title: 'Новый человек в зале',
    body: 'Лера присоединилась к World Class Тверская. Можно поздороваться на этаже.',
    createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    read: false,
    href: '/app/user/u-lera',
    gymId: DEMO_GYM_ID,
    actorId: 'u-lera',
  },
  {
    id: 'n-2',
    type: 'like',
    title: 'Новый лайк',
    body: 'Иван отметил твою карточку.',
    createdAt: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
    read: false,
    href: '/app/profile',
    actorId: 'u-ivan',
  },
  {
    id: 'n-3',
    type: 'chat_request',
    title: 'Запрос в чат',
    body: 'Маша ждёт ответа в переписке.',
    createdAt: new Date(Date.now() - 1000 * 60 * 80).toISOString(),
    read: false,
    href: '/app/messages/c-1',
    actorId: 'u-masha',
  },
  {
    id: 'n-4',
    type: 'coach',
    title: 'Тренер в клубе',
    body: 'Иван — тренер по силовым — сейчас в твоём зале.',
    createdAt: new Date(Date.now() - 1000 * 60 * 140).toISOString(),
    read: true,
    href: '/app/user/u-ivan',
    gymId: DEMO_GYM_ID,
    actorId: 'u-ivan',
  },
  {
    id: 'n-5',
    type: 'system',
    title: 'Spotter · безопасность',
    body: 'Не переходите в мессенджеры сразу и не делитесь адресом на первых сообщениях.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    read: true,
    href: '/app/settings',
  },
  {
    id: 'n-6',
    type: 'admin',
    title: 'Ответ поддержки',
    body: 'Спасибо за отзыв. Мы улучшаем фильтры на этаже — напиши ещё, если что-то мешает.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString(),
    read: true,
    href: '/app/notifications',
  },
]

export function normalizeNotificationPrefs(raw: Partial<NotificationPrefs> | null | undefined): NotificationPrefs {
  return {
    ...DEFAULT_NOTIF_PREFS,
    ...(raw && typeof raw === 'object' ? raw : {}),
  }
}

export function normalizeNotifications(raw: AppNotification[] | null | undefined): AppNotification[] {
  if (!Array.isArray(raw) || !raw.length) return SEED_NOTIFICATIONS.map((n) => ({ ...n }))
  return raw.filter((n) => n && typeof n.id === 'string' && typeof n.title === 'string')
}

export function prefKeyForType(type: NotificationType): keyof Omit<NotificationPrefs, 'enabled'> | null {
  switch (type) {
    case 'gym_new_member':
      return 'gymNewMembers'
    case 'like':
      return 'likes'
    case 'chat_request':
      return 'chatRequests'
    case 'checkin':
      return 'checkins'
    case 'coach':
      return 'coaches'
    case 'system':
    case 'admin':
      return 'system'
    default:
      return null
  }
}

export function isNotificationAllowed(prefs: NotificationPrefs, type: NotificationType) {
  if (!prefs.enabled) return false
  const key = prefKeyForType(type)
  if (!key) return prefs.enabled
  return Boolean(prefs[key])
}

export function unreadNotificationsCount(list: AppNotification[], prefs: NotificationPrefs) {
  if (!prefs.enabled) return 0
  return list.filter((n) => !n.read && isNotificationAllowed(prefs, n.type)).length
}

export function typeLabel(type: NotificationType) {
  switch (type) {
    case 'gym_new_member':
      return 'Зал'
    case 'like':
      return 'Лайк'
    case 'chat_request':
      return 'Чат'
    case 'checkin':
      return 'Check-in'
    case 'coach':
      return 'Тренер'
    case 'system':
      return 'Система'
    case 'admin':
      return 'Поддержка'
    default:
      return 'Spotter'
  }
}
