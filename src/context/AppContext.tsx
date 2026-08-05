import {
  createContext,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  DEMO_GYM_ID,
  SEED_CONVERSATIONS,
  SEED_MESSAGES,
  USERS,
  normalizeExperienceLevel,
} from '../data/mock'
import {
  adminFlagsForEmail,
  blockEmail,
  isEmailBlocked,
  loadBlockedEmails,
  loadDirectory,
  setCanGrantAdmin as dirSetCanGrant,
  setUserAdmin as dirSetUserAdmin,
  unblockEmail,
  upsertDirectoryUser,
} from '../lib/adminDirectory'
import { MASTER_ADMIN_NAME, normalizeEmail } from '../lib/adminConfig'
import { buildAvatarUrl, withSyncedAvatar } from '../lib/avatar'
import { clampPhotos } from '../lib/photos'
import {
  createTicket,
  replyToTicket,
  seedTicketsIfEmpty,
  setTicketStatus,
} from '../lib/feedback'
import {
  getLikeCount,
  hasLiked,
  normalizeLikesMap,
  resolveLikers,
  resolveOutgoingLikes,
  SEED_LIKES,
  toggleLikeInMap,
  type LikesMap,
} from '../lib/likes'
import { normalizeMessages } from '../lib/messages'
import {
  DEFAULT_NOTIF_PREFS,
  STORAGE_NOTIFICATIONS,
  STORAGE_NOTIF_PREFS,
  isNotificationAllowed,
  normalizeNotificationPrefs,
  normalizeNotifications,
  unreadNotificationsCount,
} from '../lib/notifications'
import { loadJson, saveJson } from '../lib/storage'
import { normalizeGymFields, withGymMembership } from '../lib/userGyms'
import type {
  AdminDirectoryUser,
  AppNotification,
  AppUser,
  Conversation,
  FeedbackCategoryId,
  FeedbackTicket,
  FeedbackTicketStatus,
  Gender,
  Intent,
  Message,
  MessageStatus,
  NotificationPrefs,
  PrivacyMode,
  UserProfile,
  VisitSlot,
} from '../types'

export interface AppContextValue {
  user: AppUser | null
  conversations: Conversation[]
  messages: Message[]
  likes: LikesMap
  notifications: AppNotification[]
  notificationPrefs: NotificationPrefs
  unreadNotifications: number
  directory: typeof USERS
  login: (email: string, password: string) => boolean
  register: (name: string, email: string, password: string, gender: Gender) => boolean
  logout: () => void
  completeOnboarding: (data: Partial<AppUser>) => void
  updateProfile: (data: Partial<AppUser>) => void
  /** Быстрый check-in/out; при нескольких залах лучше checkIn + picker */
  toggleActive: (gymId?: string) => void
  checkIn: (gymId: string) => void
  checkOut: () => void
  joinGym: (gymId: string, makeHome?: boolean) => void
  leaveGym: (gymId: string) => void
  setHomeGym: (gymId: string) => void
  toggleLike: (userId: string) => void
  getLikesFor: (userId: string) => { count: number; likedByMe: boolean; likers: UserProfile[] }
  /** Пользователи, которых лайкнул текущий аккаунт (любые залы) */
  getMyLikedUsers: () => UserProfile[]
  sendMessage: (conversationId: string, text: string) => void
  startConversation: (userId: string, text: string) => string
  acceptRequest: (conversationId: string) => void
  markRead: (conversationId: string) => void
  updateNotificationPrefs: (patch: Partial<NotificationPrefs>) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  /** Обратная связь / админка */
  tickets: FeedbackTicket[]
  adminDirectory: AdminDirectoryUser[]
  blockedEmails: string[]
  canManageAdmins: boolean
  refreshSupport: () => void
  createFeedbackTicket: (category: FeedbackCategoryId, message: string) => FeedbackTicket
  replyFeedbackTicket: (ticketId: string, message: string) => FeedbackTicket
  adminReplyTicket: (
    ticketId: string,
    message: string,
    closeAs?: 'resolved' | 'closed',
  ) => FeedbackTicket
  adminSetTicketStatus: (ticketId: string, status: FeedbackTicketStatus) => FeedbackTicket
  adminSetUserAdmin: (userId: string, isAdmin: boolean) => void
  adminSetCanGrant: (userId: string, canGrant: boolean) => void
  adminBlockEmail: (email: string) => void
  adminUnblockEmail: (email: string) => void
}

const STORAGE_USER = 'spotter.user'
const STORAGE_CHATS = 'spotter.conversations'
const STORAGE_MSGS = 'spotter.messages'
const STORAGE_LIKES = 'spotter.likes'

export const AppContext = createContext<AppContextValue | null>(null)

function withAdminFlags(user: AppUser): AppUser {
  const flags = adminFlagsForEmail(user.email)
  const next = { ...user, ...flags }
  upsertDirectoryUser({
    id: next.id,
    name: next.name,
    email: next.email,
    isAdmin: next.isAdmin,
    isMasterAdmin: next.isMasterAdmin,
    canGrantAdmin: next.canGrantAdmin,
  })
  return next
}

function normalizeGender(value: unknown): Gender {
  return value === 'female' ? 'female' : 'male'
}

function createDefaultUser(name: string, email: string, gender: Gender = 'male'): AppUser {
  const flags = adminFlagsForEmail(email)
  return withAdminFlags({
    id: 'me',
    name: flags.isMasterAdmin ? MASTER_ADMIN_NAME : name,
    email: normalizeEmail(email),
    age: 25,
    gender: normalizeGender(gender),
    bio: '',
    photos: [],
    avatar: buildAvatarUrl(
      flags.isMasterAdmin ? MASTER_ADMIN_NAME : name,
      normalizeGender(gender),
    ),
    gymIds: [],
    homeGymId: '',
    city: '',
    intent: 'both',
    experienceLevel: 'confident',
    interests: [],
    sports: [],
    isCoach: false,
    coachSports: [],
    visitSlots: [] as VisitSlot[],
    privacy: 'open' as PrivacyMode,
    lookingToMeet: true,
    isActive: false,
    checkedInGymId: '',
    lastSeenAt: new Date().toISOString(),
    onboardingDone: false,
    isAdmin: flags.isAdmin,
    isMasterAdmin: flags.isMasterAdmin,
    canGrantAdmin: flags.canGrantAdmin,
  })
}

function loadUser(): AppUser | null {
  const raw = loadJson<AppUser | null>(STORAGE_USER, null)
  if (!raw) return null
  const gender = normalizeGender(raw.gender)
  const coachSports = Array.isArray(raw.coachSports)
    ? raw.coachSports.filter((s): s is string => typeof s === 'string')
    : []
  const gymNormalized = normalizeGymFields({
    ...raw,
    gender,
    experienceLevel: normalizeExperienceLevel(raw.experienceLevel),
    isCoach: Boolean(raw.isCoach),
    coachSports,
    email: normalizeEmail(raw.email || ''),
  }) as AppUser
  const checkedInGymId =
    typeof raw.checkedInGymId === 'string' && gymNormalized.gymIds.includes(raw.checkedInGymId)
      ? raw.checkedInGymId
      : raw.isActive
        ? gymNormalized.homeGymId || ''
        : ''
  const normalized = withAdminFlags(
    withSyncedAvatar({
      ...gymNormalized,
      isActive: Boolean(raw.isActive) && Boolean(checkedInGymId),
      checkedInGymId: raw.isActive ? checkedInGymId : '',
      isAdmin: Boolean(raw.isAdmin),
      isMasterAdmin: Boolean(raw.isMasterAdmin),
      canGrantAdmin: Boolean(raw.canGrantAdmin),
    }),
  )
  saveJson(STORAGE_USER, normalized)
  return normalized
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(() => loadUser())
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    loadJson(STORAGE_CHATS, SEED_CONVERSATIONS),
  )
  const [messages, setMessages] = useState<Message[]>(() =>
    normalizeMessages(loadJson(STORAGE_MSGS, SEED_MESSAGES)),
  )
  const [likes, setLikes] = useState<LikesMap>(() =>
    normalizeLikesMap(loadJson(STORAGE_LIKES, SEED_LIKES)),
  )
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    normalizeNotifications(loadJson(STORAGE_NOTIFICATIONS, null)),
  )
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>(() =>
    normalizeNotificationPrefs(loadJson(STORAGE_NOTIF_PREFS, DEFAULT_NOTIF_PREFS)),
  )
  const [tickets, setTickets] = useState<FeedbackTicket[]>(() => seedTicketsIfEmpty())
  const [adminDirectory, setAdminDirectory] = useState<AdminDirectoryUser[]>(() => loadDirectory())
  const [blockedEmails, setBlockedEmails] = useState<string[]>(() => loadBlockedEmails())

  const pushNotification = useCallback(
    (item: Omit<AppNotification, 'id' | 'createdAt' | 'read'> & { id?: string }) => {
      setNotificationPrefs((prefs) => {
        if (!isNotificationAllowed(prefs, item.type)) return prefs
        setNotifications((prev) => {
          const next: AppNotification[] = [
            {
              id: item.id || `n-${Date.now()}`,
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
          saveJson(STORAGE_NOTIFICATIONS, next)
          return next
        })
        return prefs
      })
    },
    [],
  )

  const unreadNotifications = useMemo(
    () => unreadNotificationsCount(notifications, notificationPrefs),
    [notifications, notificationPrefs],
  )

  const patchMessageStatus = useCallback(
    (messageId: string, status: MessageStatus) => {
      setMessages((prev) => {
        const next = prev.map((m) => (m.id === messageId ? { ...m, status } : m))
        saveJson(STORAGE_MSGS, next)
        return next
      })
    },
    [],
  )

  const simulateDelivery = useCallback(
    (messageId: string, requestPending: boolean) => {
      window.setTimeout(() => patchMessageStatus(messageId, 'sent'), 250)
      window.setTimeout(() => patchMessageStatus(messageId, 'delivered'), 900)
      // В демо собеседник «читает» через пару секунд, если чат уже принят
      if (!requestPending) {
        window.setTimeout(() => patchMessageStatus(messageId, 'read'), 2600)
      }
    },
    [patchMessageStatus],
  )

  const persistUser = useCallback((next: AppUser | null) => {
    if (next) {
      const normalized = withAdminFlags(normalizeGymFields(next) as AppUser)
      setUser(normalized)
      saveJson(STORAGE_USER, normalized)
      setAdminDirectory(loadDirectory())
      return
    }
    setUser(null)
    localStorage.removeItem(STORAGE_USER)
  }, [])

  const refreshSupport = useCallback(() => {
    setTickets(seedTicketsIfEmpty())
    setAdminDirectory(loadDirectory())
    setBlockedEmails(loadBlockedEmails())
  }, [])

  const login = useCallback(
    (email: string, _password: string) => {
      const normalizedEmail = normalizeEmail(email)
      if (isEmailBlocked(normalizedEmail)) {
        throw new Error('Этот email заблокирован администратором')
      }
      const existing = loadUser()
      if (existing && normalizeEmail(existing.email) === normalizedEmail) {
        persistUser(existing)
        return true
      }
      const flags = adminFlagsForEmail(normalizedEmail)
      const demo = createDefaultUser(flags.isMasterAdmin ? MASTER_ADMIN_NAME : 'Алекс', normalizedEmail, 'male')
      demo.onboardingDone = true
      demo.city = 'Москва'
      demo.gymIds = [DEMO_GYM_ID]
      demo.homeGymId = DEMO_GYM_ID
      demo.bio = flags.isMasterAdmin
        ? 'Главный админ Spotter. Обратная связь и тикеты — через админку.'
        : 'В зале 4 раза в неделю. Открыт к знакомствам и совместным тренировкам.'
      demo.intent = 'both' as Intent
      demo.interests = ['Знакомства', 'Силовые', 'Вечерние тренировки']
      demo.sports = ['Силовые', 'Тренажёрный зал']
      demo.visitSlots = [
        { day: 'Пн', from: '19:00', to: '21:00' },
        { day: 'Ср', from: '19:00', to: '21:00' },
        { day: 'Пт', from: '19:00', to: '21:00' },
      ]
      demo.photos = []
      persistUser(demo)
      return true
    },
    [persistUser],
  )

  const register = useCallback(
    (name: string, email: string, _password: string, gender: Gender) => {
      const normalizedEmail = normalizeEmail(email)
      if (isEmailBlocked(normalizedEmail)) {
        throw new Error('Этот email заблокирован администратором')
      }
      persistUser(createDefaultUser(name, normalizedEmail, normalizeGender(gender)))
      return true
    },
    [persistUser],
  )

  const logout = useCallback(() => persistUser(null), [persistUser])

  const completeOnboarding = useCallback(
    (data: Partial<AppUser>) => {
      setUser((prev) => {
        if (!prev) return prev
        const next = withSyncedAvatar(
          normalizeGymFields({ ...prev, ...data, onboardingDone: true }) as AppUser,
        )
        saveJson(STORAGE_USER, next)
        return next
      })
      // Демо: «соседи» по залу узнают о новичке — тебе показываем зеркальный тип уведомления
      window.setTimeout(() => {
        pushNotification({
          type: 'system',
          title: 'Ты на этаже',
          body: 'Профиль готов. Соседи по залу могут увидеть тебя в списке клуба.',
          href: '/app',
        })
      }, 400)
    },
    [pushNotification],
  )

  const updateProfile = useCallback((data: Partial<AppUser>) => {
    setUser((prev) => {
      if (!prev) return prev
      const merged = normalizeGymFields({
        ...prev,
        ...data,
        ...(data.photos !== undefined ? { photos: clampPhotos(data.photos) } : {}),
        ...(data.gender !== undefined ? { gender: normalizeGender(data.gender) } : {}),
        lastSeenAt: new Date().toISOString(),
      }) as AppUser
      const nameOrGenderChanged =
        data.name !== undefined || data.gender !== undefined || data.photos !== undefined
      const next = nameOrGenderChanged ? withSyncedAvatar(merged) : merged
      saveJson(STORAGE_USER, next)
      return next
    })
  }, [])

  const checkIn = useCallback((gymId: string) => {
    setUser((prev) => {
      if (!prev || !prev.gymIds.includes(gymId)) return prev
      const next = {
        ...prev,
        isActive: true,
        checkedInGymId: gymId,
        lastSeenAt: new Date().toISOString(),
      }
      saveJson(STORAGE_USER, next)
      return next
    })
  }, [])

  const checkOut = useCallback(() => {
    setUser((prev) => {
      if (!prev) return prev
      const next = {
        ...prev,
        isActive: false,
        checkedInGymId: '',
        lastSeenAt: new Date().toISOString(),
      }
      saveJson(STORAGE_USER, next)
      return next
    })
  }, [])

  const toggleActive = useCallback(
    (gymId?: string) => {
      setUser((prev) => {
        if (!prev) return prev
        if (prev.isActive) {
          const next = {
            ...prev,
            isActive: false,
            checkedInGymId: '',
            lastSeenAt: new Date().toISOString(),
          }
          saveJson(STORAGE_USER, next)
          return next
        }
        const target =
          (gymId && prev.gymIds.includes(gymId) && gymId) ||
          prev.homeGymId ||
          prev.gymIds[0] ||
          ''
        if (!target) return prev
        const next = {
          ...prev,
          isActive: true,
          checkedInGymId: target,
          lastSeenAt: new Date().toISOString(),
        }
        saveJson(STORAGE_USER, next)
        return next
      })
    },
    [],
  )

  const joinGym = useCallback((gymId: string, makeHome = false) => {
    setUser((prev) => {
      if (!prev) return prev
      const next = withGymMembership(prev, gymId, true, { makeHome })
      saveJson(STORAGE_USER, next)
      return next
    })
  }, [])

  const leaveGym = useCallback((gymId: string) => {
    setUser((prev) => {
      if (!prev) return prev
      const next = withGymMembership(prev, gymId, false)
      saveJson(STORAGE_USER, next)
      return next
    })
  }, [])

  const setHomeGym = useCallback((gymId: string) => {
    setUser((prev) => {
      if (!prev) return prev
      const gymIds = prev.gymIds.includes(gymId) ? prev.gymIds : [...prev.gymIds, gymId]
      const next = {
        ...prev,
        gymIds,
        homeGymId: gymId,
        lastSeenAt: new Date().toISOString(),
      }
      saveJson(STORAGE_USER, next)
      return next
    })
  }, [])

  const toggleLike = useCallback(
    (userId: string) => {
      if (!user || user.id === userId) return
      setLikes((prev) => {
        const next = toggleLikeInMap(prev, userId, user.id)
        saveJson(STORAGE_LIKES, next)
        return next
      })
    },
    [user],
  )

  const getLikesFor = useCallback(
    (userId: string) => ({
      count: getLikeCount(likes, userId),
      likedByMe: user ? hasLiked(likes, userId, user.id) : false,
      likers: resolveLikers(likes, userId, user),
    }),
    [likes, user],
  )

  const getMyLikedUsers = useCallback(
    () => (user ? resolveOutgoingLikes(likes, user.id, user) : []),
    [likes, user],
  )

  const sendMessage = useCallback(
    (conversationId: string, text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      const conversation = conversations.find((c) => c.id === conversationId)
      const msg: Message = {
        id: `m-${Date.now()}`,
        conversationId,
        senderId: 'me',
        text: trimmed,
        createdAt: new Date().toISOString(),
        status: 'sending',
      }
      setMessages((prev) => {
        const next = [...prev, msg]
        saveJson(STORAGE_MSGS, next)
        return next
      })
      setConversations((prev) => {
        const next = prev.map((c) =>
          c.id === conversationId
            ? { ...c, lastMessage: msg.text, updatedAt: msg.createdAt, unreadCount: 0 }
            : c,
        )
        saveJson(STORAGE_CHATS, next)
        return next
      })
      simulateDelivery(msg.id, conversation?.requestStatus === 'pending')
    },
    [conversations, simulateDelivery],
  )

  const startConversation = useCallback(
    (userId: string, text: string) => {
      const trimmed = text.trim()
      const existing = conversations.find(
        (c) => c.participantIds.includes('me') && c.participantIds.includes(userId),
      )
      const conversationId = existing?.id ?? `c-${Date.now()}`
      const now = new Date().toISOString()

      if (existing) {
        if (trimmed) {
          const msgId = `m-${Date.now()}`
          setConversations((prev) => {
            const next = prev.map((c) =>
              c.id === existing.id
                ? { ...c, lastMessage: trimmed, updatedAt: now }
                : c,
            )
            saveJson(STORAGE_CHATS, next)
            return next
          })
          setMessages((prev) => {
            const next = [
              ...prev,
              {
                id: msgId,
                conversationId,
                senderId: 'me',
                text: trimmed,
                createdAt: now,
                status: 'sending' as const,
              },
            ]
            saveJson(STORAGE_MSGS, next)
            return next
          })
          simulateDelivery(msgId, existing.requestStatus === 'pending')
        }
        return conversationId
      }

      const conversation: Conversation = {
        id: conversationId,
        participantIds: ['me', userId],
        lastMessage: trimmed || 'Новый запрос',
        updatedAt: now,
        unreadCount: 0,
        requestStatus: 'pending',
      }
      setConversations((prev) => {
        const next = [conversation, ...prev]
        saveJson(STORAGE_CHATS, next)
        return next
      })
      if (trimmed) {
        const msgId = `m-${Date.now()}`
        setMessages((prev) => {
          const next = [
            ...prev,
            {
              id: msgId,
              conversationId,
              senderId: 'me',
              text: trimmed,
              createdAt: now,
              status: 'sending' as const,
            },
          ]
          saveJson(STORAGE_MSGS, next)
          return next
        })
        simulateDelivery(msgId, true)
      }
      return conversationId
    },
    [conversations, simulateDelivery],
  )

  const acceptRequest = useCallback((conversationId: string) => {
    setConversations((prev) => {
      const next = prev.map((c) =>
        c.id === conversationId ? { ...c, requestStatus: 'accepted' as const } : c,
      )
      saveJson(STORAGE_CHATS, next)
      return next
    })
    // После принятия запроса старые исходящие считаем прочитанными
    setMessages((prev) => {
      const next = prev.map((m) =>
        m.conversationId === conversationId && m.senderId === 'me' && m.status !== 'read'
          ? { ...m, status: 'read' as const }
          : m,
      )
      saveJson(STORAGE_MSGS, next)
      return next
    })
  }, [])

  const updateNotificationPrefs = useCallback((patch: Partial<NotificationPrefs>) => {
    setNotificationPrefs((prev) => {
      const next = { ...prev, ...patch }
      saveJson(STORAGE_NOTIF_PREFS, next)
      return next
    })
  }, [])

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      saveJson(STORAGE_NOTIFICATIONS, next)
      return next
    })
  }, [])

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }))
      saveJson(STORAGE_NOTIFICATIONS, next)
      return next
    })
  }, [])

  const createFeedbackTicket = useCallback(
    (category: FeedbackCategoryId, message: string) => {
      if (!user) throw new Error('Нужен вход')
      if (isEmailBlocked(user.email)) throw new Error('Email заблокирован')
      const ticket = createTicket({
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        category,
        message,
      })
      setTickets(seedTicketsIfEmpty())
      pushNotification({
        type: 'admin',
        title: 'Обращение создано',
        body: 'Поддержка ответит в разделе «Обратная связь».',
        href: `/app/feedback/${ticket.id}`,
      })
      return ticket
    },
    [user, pushNotification],
  )

  const replyFeedbackTicket = useCallback(
    (ticketId: string, message: string) => {
      if (!user) throw new Error('Нужен вход')
      const ticket = replyToTicket({
        ticketId,
        senderType: 'user',
        senderId: user.id,
        senderName: user.name,
        message,
      })
      setTickets(seedTicketsIfEmpty())
      return ticket
    },
    [user],
  )

  const adminReplyTicket = useCallback(
    (ticketId: string, message: string, closeAs?: 'resolved' | 'closed') => {
      if (!user?.isAdmin) throw new Error('Нужны права админа')
      const ticket = replyToTicket({
        ticketId,
        senderType: 'admin',
        senderId: user.id,
        senderName: user.name,
        message,
        closeAs,
        takeInProgress: !closeAs,
      })
      setTickets(seedTicketsIfEmpty())
      if (ticket.userId === user.id || ticket.userEmail === user.email) {
        // no-op for self
      } else {
        pushNotification({
          type: 'admin',
          title: closeAs ? 'Обращение закрыто' : 'Ответ поддержки',
          body: message.slice(0, 120),
          href: `/app/feedback/${ticket.id}`,
        })
      }
      return ticket
    },
    [user, pushNotification],
  )

  const adminSetTicketStatus = useCallback(
    (ticketId: string, status: FeedbackTicketStatus) => {
      if (!user?.isAdmin) throw new Error('Нужны права админа')
      const ticket = setTicketStatus(
        ticketId,
        status,
        status === 'in_progress' ? user.id : undefined,
      )
      setTickets(seedTicketsIfEmpty())
      return ticket
    },
    [user],
  )

  const canManageAdmins = Boolean(
    user?.isMasterAdmin || (user?.isAdmin && user?.canGrantAdmin),
  )

  const adminSetUserAdmin = useCallback(
    (userId: string, isAdmin: boolean) => {
      if (!canManageAdmins) throw new Error('Недостаточно прав')
      dirSetUserAdmin(userId, isAdmin, canManageAdmins)
      setAdminDirectory(loadDirectory())
      if (user && user.id === userId) {
        persistUser({ ...user, isAdmin, canGrantAdmin: isAdmin ? user.canGrantAdmin : false })
      }
    },
    [canManageAdmins, user, persistUser],
  )

  const adminSetCanGrant = useCallback(
    (userId: string, canGrant: boolean) => {
      if (!user?.isMasterAdmin) throw new Error('Только главный админ')
      dirSetCanGrant(userId, canGrant, true)
      setAdminDirectory(loadDirectory())
      if (user && user.id === userId) {
        persistUser({ ...user, canGrantAdmin: canGrant })
      }
    },
    [user, persistUser],
  )

  const adminBlockEmail = useCallback((email: string) => {
    setBlockedEmails(blockEmail(email))
  }, [])

  const adminUnblockEmail = useCallback((email: string) => {
    setBlockedEmails(unblockEmail(email))
  }, [])

  const markRead = useCallback((conversationId: string) => {
    setConversations((prev) => {
      const next = prev.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c,
      )
      saveJson(STORAGE_CHATS, next)
      return next
    })
    // Входящие — прочитаны мной; исходящие в открытом чате — собеседник «прочитал»
    setMessages((prev) => {
      const next = prev.map((m) =>
        m.conversationId === conversationId
          ? { ...m, status: 'read' as const }
          : m,
      )
      saveJson(STORAGE_MSGS, next)
      return next
    })
  }, [])

  const value = useMemo<AppContextValue>(
    () => ({
      user,
      conversations,
      messages,
      likes,
      notifications,
      notificationPrefs,
      unreadNotifications,
      directory: USERS,
      login,
      register,
      logout,
      completeOnboarding,
      updateProfile,
      toggleActive,
      checkIn,
      checkOut,
      joinGym,
      leaveGym,
      setHomeGym,
      toggleLike,
      getLikesFor,
      getMyLikedUsers,
      sendMessage,
      startConversation,
      acceptRequest,
      markRead,
      updateNotificationPrefs,
      markNotificationRead,
      markAllNotificationsRead,
      tickets,
      adminDirectory,
      blockedEmails,
      canManageAdmins,
      refreshSupport,
      createFeedbackTicket,
      replyFeedbackTicket,
      adminReplyTicket,
      adminSetTicketStatus,
      adminSetUserAdmin,
      adminSetCanGrant,
      adminBlockEmail,
      adminUnblockEmail,
    }),
    [
      user,
      conversations,
      messages,
      likes,
      notifications,
      notificationPrefs,
      unreadNotifications,
      tickets,
      adminDirectory,
      blockedEmails,
      canManageAdmins,
      login,
      register,
      logout,
      completeOnboarding,
      updateProfile,
      toggleActive,
      checkIn,
      checkOut,
      joinGym,
      leaveGym,
      setHomeGym,
      toggleLike,
      getLikesFor,
      getMyLikedUsers,
      sendMessage,
      startConversation,
      acceptRequest,
      markRead,
      updateNotificationPrefs,
      markNotificationRead,
      markAllNotificationsRead,
      refreshSupport,
      createFeedbackTicket,
      replyFeedbackTicket,
      adminReplyTicket,
      adminSetTicketStatus,
      adminSetUserAdmin,
      adminSetCanGrant,
      adminBlockEmail,
      adminUnblockEmail,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
