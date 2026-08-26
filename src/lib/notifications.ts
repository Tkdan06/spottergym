import { DEMO_GYM_ID } from '../data/mock'
import { normalizeEmail } from './adminConfig'
import { isDemoAccount } from './demoAccount'
import { loadJson, saveJson } from './storage'
import type { AppNotification, NotificationPrefs, NotificationType } from '../types'

export const STORAGE_NOTIFICATIONS = 'spotter.notifications'
export const STORAGE_NOTIF_PREFS = 'spotter.notificationPrefs'

/** Ключ хранилища уведомлений конкретного аккаунта */
export function notificationsKeyFor(email: string) {
  return `${STORAGE_NOTIFICATIONS}:${normalizeEmail(email)}`
}

export function notificationPrefsKeyFor(email: string) {
  return `${STORAGE_NOTIF_PREFS}:${normalizeEmail(email)}`
}

export const DEFAULT_NOTIF_PREFS: NotificationPrefs = {
  enabled: true,
  gymNewMembers: true,
  likes: true,
  chatRequests: true,
  checkins: false,
  coaches: true,
  system: true,
  workoutReminders: true,
  newRegistrations: true,
}

export const NOTIF_PREF_LABELS: {
  key: keyof Omit<NotificationPrefs, 'enabled'>
  title: string
  hint: string
  /** Shown only to admins */
  adminOnly?: boolean
}[] = [
  {
    key: 'gymNewMembers',
    title: 'Новые в зале',
    hint: 'Кто-то зарегистрировался в твоём клубе',
  },
  {
    key: 'likes',
    title: 'Лайки',
    hint: 'Кто-то отметил твой профиль',
  },
  {
    key: 'chatRequests',
    title: 'Запросы в чат',
    hint: 'Кто-то хочет начать переписку',
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
  {
    key: 'workoutReminders',
    title: 'Напоминание о тренировке',
    hint: 'За час до слота: собраться и отметить статус в зале',
  },
  {
    key: 'newRegistrations',
    title: 'Новые регистрации',
    hint: 'Пуш, когда в приложении регистрируется новый пользователь',
    adminOnly: true,
  },
]

export const SEED_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n-1',
    type: 'gym_new_member',
    title: 'Новый человек в зале',
    body: 'Лера присоединилась к World Class Тверская. Можно поздороваться в зале.',
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
    body: 'Иван отметил твой профиль.',
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
    body: 'Спасибо за отзыв. Мы улучшаем фильтры в зале — напиши ещё, если что-то мешает.',
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

export function normalizeNotifications(
  raw: AppNotification[] | null | undefined,
  options?: { seedIfEmpty?: boolean },
): AppNotification[] {
  const seedIfEmpty = Boolean(options?.seedIfEmpty)
  if (!Array.isArray(raw)) {
    return seedIfEmpty ? SEED_NOTIFICATIONS.map((n) => ({ ...n })) : []
  }
  if (!raw.length) {
    return seedIfEmpty ? SEED_NOTIFICATIONS.map((n) => ({ ...n })) : []
  }
  return raw.filter((n) => n && typeof n.id === 'string' && typeof n.title === 'string')
}

const SEED_NOTIFICATION_IDS = new Set(SEED_NOTIFICATIONS.map((n) => n.id))

function looksLikeSeedNotifications(list: AppNotification[]) {
  return list.some((n) => n && SEED_NOTIFICATION_IDS.has(n.id))
}

/** Загрузить ленту аккаунта. Новые профили — пусто; демо-логин может запросить seed. */
export function loadNotificationsForUser(email: string, seedIfMissing = false): AppNotification[] {
  const key = notificationsKeyFor(email)
  const scoped = loadJson<AppNotification[] | null>(key, null)
  if (Array.isArray(scoped)) {
    // Реальные аккаунты не должны хранить демо-ленту из старых билдов
    if (!isDemoAccount(email) && looksLikeSeedNotifications(scoped)) {
      saveJson(key, [])
      return []
    }
    return normalizeNotifications(scoped, { seedIfEmpty: false })
  }
  // Старый общий ключ больше не используем — иначе чужие уведомления «липли» к новым профилям
  try {
    localStorage.removeItem(STORAGE_NOTIFICATIONS)
  } catch {
    /* ignore */
  }
  if (seedIfMissing) {
    const seeded = normalizeNotifications(null, { seedIfEmpty: true })
    saveJson(key, seeded)
    return seeded
  }
  saveJson(key, [])
  return []
}

export function saveNotificationsForUser(email: string, list: AppNotification[]) {
  saveJson(notificationsKeyFor(email), list)
}

/** Записать уведомление в ленту другого email (админ → пользователь) */
export function appendNotificationForEmail(
  email: string,
  item: Omit<AppNotification, 'id' | 'createdAt' | 'read'> & { id?: string },
) {
  const key = normalizeEmail(email)
  if (!key) return null
  const prefs = loadNotificationPrefsForUser(key)
  if (!isNotificationAllowed(prefs, item.type)) return null
  const prev = loadNotificationsForUser(key, false)
  const next: AppNotification[] = [
    {
      id: item.id || `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      read: false,
      title: item.title,
      body: item.body,
      type: item.type,
      href: item.href,
      gymId: item.gymId,
      actorId: item.actorId,
    },
    ...prev,
  ]
  saveNotificationsForUser(key, next)
  return next[0]
}

export function loadNotificationPrefsForUser(email: string): NotificationPrefs {
  const key = notificationPrefsKeyFor(email)
  const scoped = loadJson<Partial<NotificationPrefs> | null>(key, null)
  if (scoped && typeof scoped === 'object') {
    return normalizeNotificationPrefs(scoped)
  }
  const legacy = loadJson<Partial<NotificationPrefs> | null>(STORAGE_NOTIF_PREFS, null)
  const prefs = normalizeNotificationPrefs(legacy)
  saveJson(key, prefs)
  return prefs
}

export function saveNotificationPrefsForUser(email: string, prefs: NotificationPrefs) {
  saveJson(notificationPrefsKeyFor(email), prefs)
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
    case 'workout_reminder':
      return 'workoutReminders'
    case 'new_registration':
      return 'newRegistrations'
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

/** Message pings belong on the Chats badge, not in the notification feed */
export function isMessagePingNotification(n: Pick<AppNotification, 'title'>) {
  return n.title === 'Новое сообщение'
}

export function feedNotifications(list: AppNotification[]) {
  return list.filter((n) => !isMessagePingNotification(n))
}

export function unreadNotificationsCount(list: AppNotification[], prefs: NotificationPrefs) {
  if (!prefs.enabled) return 0
  return feedNotifications(list).filter((n) => !n.read && isNotificationAllowed(prefs, n.type))
    .length
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
    case 'workout_reminder':
      return 'Тренировка'
    case 'new_registration':
      return 'Регистрация'
    default:
      return 'Spotter'
  }
}
