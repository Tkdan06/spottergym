import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { flushSync } from 'react-dom'
import { DEMO_GYM_ID, USERS, getGym, normalizeExperienceLevel } from '../data/mock'
import {
  loadAccountBags,
  loadAccountProfile,
  resolveContacts,
  saveAccountContacts,
  saveAccountConversations,
  saveAccountLikes,
  saveAccountMessages,
  saveAccountProfile,
} from '../lib/accountData'
import { otherParticipantId } from '../lib/conversations'
import {
  hasAccountPassword,
  saveAccountPassword,
  verifyAccountPassword,
} from '../lib/accountAuth'
import {
  ApiError,
  apiAcceptConversation,
  apiAdminBlockEmail,
  apiAdminDeleteUser,
  apiAdminFetchBlockedEmails,
  apiAdminFetchUsers,
  apiAdminOutboundTicket,
  apiAdminPatchUserAdmin,
  apiAdminUnblockEmail,
  apiBlockUser,
  apiCheckIn,
  apiCheckOut,
  apiExtendCheckIn,
  apiCreateTicket,
  apiFetchBlocks,
  apiFetchConversations,
  apiFetchLikes,
  apiFetchMessages,
  apiFetchNotificationPrefs,
  apiFetchNotifications,
  apiFetchTickets,
  apiFetchUser,
  apiHeartbeat,
  apiHealth,
  apiJoinGym,
  apiLeaveGym,
  apiLogin,
  apiLogout,
  apiLookupUsername,
  apiMarkAllNotificationsRead,
  apiMarkConversationRead,
  apiMarkNotificationRead,
  apiPinConversation,
  apiMe,
  apiPatchMe,
  apiPatchNotificationPrefs,
  apiPatchTicketStatus,
  apiRegister,
  apiReplyTicket,
  apiSearchUsers,
  apiSendMessage,
  apiStartConversation,
  apiToggleLike,
  apiUnblockUser,
  getStoredToken,
  setStoredToken,
} from '../lib/apiClient'
import { DEMO_ACCOUNT_EMAIL, DEMO_ACCOUNT_NAME, isDemoAccount } from '../lib/demoAccount'
import { ensureWebPushSubscription, syncAppBadge } from '../lib/push'
import {
  buildCheckInSessionFields,
  canExtendCheckInLocal,
  CHECK_IN_EXTEND_MS,
  CHECK_IN_MAX_EXTENDS,
  getCheckInExpiresAt,
  isCheckInExpired,
} from '../lib/presence'
import {
  adminFlagsForEmail,
  blockEmail,
  isEmailBlocked,
  loadBlockedEmails,
  estimatePhotosBytes,
  loadDirectory,
  mergeStoredAccountsIntoDirectory,
  removeUserAccount,
  saveBlockedEmails,
  saveDirectory,
  setAdminPermissions as dirSetAdminPermissions,
  setCanGrantAdmin as dirSetCanGrant,
  setUserAdmin as dirSetUserAdmin,
  syncDirectoryFromAppUser,
  unblockEmail,
} from '../lib/adminDirectory'
import {
  EMPTY_PERMISSIONS,
  FULL_PERMISSIONS,
  hasAdminPermission,
  SUPPORT_PERMISSIONS,
  type AdminPermissionPreset,
  ADMIN_PRESETS,
  normalizeAdminPermissions,
} from '../lib/adminPermissions'
import { normalizeEmail } from '../lib/adminConfig'
import { localGenderAvatar, withSyncedAvatar } from '../lib/avatar'
import {
  BIO_MAX,
  CHAT_MESSAGE_MAX,
  GREETING_MESSAGE_MAX,
  NAME_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
  clampText,
} from '../lib/fieldLimits'
import { clampPhotos } from '../lib/photos'
import {
  generateLocalUsername,
  isValidUsername,
  normalizeUsername,
} from '../lib/username'
import { activeBreakUntil } from '../lib/schedule'
import {
  blockUserId,
  loadBlockedUserIds,
  reportReasonLabel,
  type ReportReasonId,
  unblockUserId,
} from '../lib/userBlocks'
import {
  createAdminOutboundTicket,
  createTicket,
  replyToTicket,
  saveTickets,
  seedTicketsIfEmpty,
  setTicketStatus,
} from '../lib/feedback'
import {
  getLikeCount,
  hasLiked,
  normalizeLikeCounts,
  seedLikeCounts,
  toggleLikeCount,
  type LikeCounts,
  normalizeLikesMap,
  resolveLikers,
  resolveOutgoingLikes,
  toggleLikeInMap,
  type LikesMap,
} from '../lib/likes'
import {
  DEFAULT_NOTIF_PREFS,
  isNotificationAllowed,
  appendNotificationForEmail,
  loadNotificationPrefsForUser,
  loadNotificationsForUser,
  saveNotificationPrefsForUser,
  saveNotificationsForUser,
  unreadNotificationsCount,
} from '../lib/notifications'
import {
  WELCOME_INSTALL_BODY,
  WELCOME_INSTALL_HREF,
  WELCOME_INSTALL_LOCAL_ID,
  WELCOME_INSTALL_TITLE,
} from '../lib/welcomeInstall'
import { loadJson, saveJson } from '../lib/storage'
import { normalizeGymFields, withGymMembership } from '../lib/userGyms'
import type {
  AdminDirectoryUser,
  AppNotification,
  AppUser,
  Conversation,
  FeedbackCategoryId,
  FeedbackTicket,
  AdminPermissions,
  FeedbackTicketStatus,
  Gender,
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
  likeCounts: LikeCounts
  notifications: AppNotification[]
  notificationPrefs: NotificationPrefs
  unreadNotifications: number
  directory: typeof USERS
  /** true = Postgres API доступен; иначе localStorage fallback */
  apiOnline: boolean
  login: (email: string, password: string) => Promise<boolean>
  register: (name: string, email: string, password: string, gender: Gender) => Promise<boolean>
  logout: () => Promise<void>
  completeOnboarding: (
    data: Partial<AppUser>,
  ) => void | Promise<{ ok: true } | { ok: false; error: string }>
  updateProfile: (data: Partial<AppUser>) => void | Promise<void>
  /** Быстрый check-in/out; при нескольких залах лучше checkIn + picker */
  toggleActive: (gymId?: string) => void | Promise<void>
  checkIn: (gymId: string) => void | Promise<void>
  checkOut: () => void | Promise<void>
  /** Продлить присутствие на +1 час (макс. 2 раза) */
  extendCheckIn: () => void | Promise<void>
  joinGym: (gymId: string, makeHome?: boolean) => void | Promise<void>
  leaveGym: (gymId: string) => void | Promise<void>
  setHomeGym: (gymId: string) => void | Promise<void>
  toggleLike: (userId: string) => void | Promise<void>
  getLikesFor: (userId: string) => { count: number; likedByMe: boolean; likers: UserProfile[] }
  /** Пользователи, которых лайкнул текущий аккаунт (любые залы) */
  getMyLikedUsers: () => UserProfile[]
  /** Exact find by @username; caches profile in directory */
  lookupUsername: (username: string) => Promise<UserProfile>
  /** Partial @ник / имя — серверный поиск */
  searchUsers: (query: string) => Promise<UserProfile[]>
  /** Профиль по id с сервера (кэширует). bypassCache — всегда дернуть API. */
  fetchUserById: (userId: string, opts?: { bypassCache?: boolean }) => Promise<UserProfile>
  rememberUser: (person: UserProfile) => void
  sendMessage: (conversationId: string, text: string) => void | Promise<void>
  startConversation: (userId: string, text: string) => string | Promise<string>
  acceptRequest: (conversationId: string) => void | Promise<void>
  markRead: (conversationId: string) => void | Promise<void>
  /** Закрепить / открепить чат (только для текущего пользователя) */
  togglePinConversation: (conversationId: string, pinned?: boolean) => void | Promise<void>
  /** Подтянуть список чатов / тред с сервера */
  refreshChats: (opts?: { before?: string; append?: boolean }) => Promise<{ hasMore: boolean }>
  refreshThread: (
    conversationId: string,
    opts?: { before?: string },
  ) => Promise<{ hasMore: boolean }>
  updateNotificationPrefs: (patch: Partial<NotificationPrefs>) => void | Promise<void>
  markNotificationRead: (id: string) => void | Promise<void>
  markAllNotificationsRead: () => void | Promise<void>
  /** Обратная связь / админка */
  tickets: FeedbackTicket[]
  adminDirectory: AdminDirectoryUser[]
  blockedEmails: string[]
  canManageAdmins: boolean
  canBlockUsers: boolean
  canRemoveUsers: boolean
  canViewUsers: boolean
  canHandleTickets: boolean
  canMessageUsers: boolean
  refreshSupport: () => void | Promise<void>
  createFeedbackTicket: (
    category: FeedbackCategoryId,
    message: string,
  ) => Promise<FeedbackTicket>
  replyFeedbackTicket: (ticketId: string, message: string) => Promise<FeedbackTicket>
  adminReplyTicket: (
    ticketId: string,
    message: string,
    closeAs?: 'resolved' | 'closed',
  ) => Promise<FeedbackTicket>
  adminSetTicketStatus: (
    ticketId: string,
    status: FeedbackTicketStatus,
  ) => FeedbackTicket | Promise<FeedbackTicket>
  adminSetUserAdmin: (
    userId: string,
    isAdmin: boolean,
    preset?: AdminPermissionPreset,
  ) => void | Promise<void>
  adminSetPermissions: (
    userId: string,
    permissions: AdminPermissions,
  ) => void | Promise<void>
  adminSetCanGrant: (userId: string, canGrant: boolean) => void
  adminBlockEmail: (email: string) => void | Promise<void>
  adminUnblockEmail: (email: string) => void | Promise<void>
  adminRemoveUser: (email: string, alsoBlock?: boolean) => void | Promise<void>
  /** Админ пишет пользователю (тикет + уведомление в его ленту) */
  adminMessageUser: (target: AdminDirectoryUser, message: string) => Promise<FeedbackTicket>
  /** Перечитать директорию и аккаунты localStorage / API */
  refreshAdminDirectory: (opts?: {
    q?: string
    activity?: 'seenToday' | 'checkedInToday'
  }) => Promise<AdminDirectoryUser[]>
  /** Пользователи, которых скрыл текущий аккаунт */
  blockedUserIds: string[]
  isBlocked: (userId: string) => boolean
  blockUser: (userId: string) => void | Promise<void>
  unblockUser: (userId: string) => void | Promise<void>
  reportUser: (
    userId: string,
    reason: ReportReasonId,
    note?: string,
  ) => Promise<FeedbackTicket>
}

const STORAGE_USER = 'spotter.user'

function createDemoAppUser(): AppUser {
  const demo = createDefaultUser(DEMO_ACCOUNT_NAME, DEMO_ACCOUNT_EMAIL, 'male')
  demo.onboardingDone = true
  demo.city = 'Москва'
  demo.gymIds = [DEMO_GYM_ID]
  demo.homeGymId = DEMO_GYM_ID
  demo.bio = 'В зале 4 раза в неделю. Открыт к знакомствам и совместным тренировкам.'
  demo.intent = 'both'
  demo.interests = ['Знакомства', 'Силовые', 'Вечерние тренировки']
  demo.sports = ['Силовые', 'Тренажёрный зал']
  demo.visitSlots = [
    { day: 'Пн', from: '19:00', to: '21:00' },
    { day: 'Ср', from: '19:00', to: '21:00' },
    { day: 'Пт', from: '19:00', to: '21:00' },
  ]
  demo.photos = []
  return demo
}

export const AppContext = createContext<AppContextValue | null>(null)

function withAdminFlags(user: AppUser): AppUser {
  const local = adminFlagsForEmail(user.email)
  const isMasterAdmin = local.isMasterAdmin || Boolean(user.isMasterAdmin)
  const isAdmin = isMasterAdmin || local.isAdmin || Boolean(user.isAdmin)
  const adminPermissions = isMasterAdmin
    ? { ...FULL_PERMISSIONS }
    : normalizeAdminPermissions(user.adminPermissions || local.adminPermissions, {
        isAdmin,
        isMasterAdmin,
        canGrantAdmin: Boolean(user.canGrantAdmin || user.adminPermissions?.manageAdmins),
      })
  const next: AppUser = {
    ...user,
    isAdmin,
    isMasterAdmin,
    adminPermissions,
    canGrantAdmin: adminPermissions.manageAdmins,
    registeredAt: user.registeredAt || user.lastSeenAt || new Date().toISOString(),
  }
  syncDirectoryFromAppUser(next)
  return next
}

function toAdminDirectoryUser(
  u: AppUser & {
    photosCount?: number
    photosBytes?: number
    checkedInTodayAt?: string
    checkedInTodayGymId?: string
  },
): AdminDirectoryUser {
  const photosCount =
    typeof u.photosCount === 'number'
      ? u.photosCount
      : Array.isArray(u.photos)
        ? u.photos.length
        : 0
  const photosBytes =
    typeof u.photosBytes === 'number' ? u.photosBytes : estimatePhotosBytes(u.photos)
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    isAdmin: Boolean(u.isAdmin),
    isMasterAdmin: Boolean(u.isMasterAdmin),
    canGrantAdmin: Boolean(u.canGrantAdmin ?? u.adminPermissions?.manageAdmins),
    adminPermissions: u.adminPermissions,
    age: u.age,
    gender: u.gender,
    city: u.city,
    homeGymId: u.homeGymId,
    gymIds: u.gymIds,
    intent: u.intent,
    experienceLevel: u.experienceLevel,
    isCoach: u.isCoach,
    onboardingDone: u.onboardingDone,
    isActive: u.isActive,
    checkedInGymId: u.checkedInGymId,
    photosCount,
    photosBytes,
    registeredAt: u.registeredAt,
    lastSeenAt: u.lastSeenAt,
    checkedInTodayAt: u.checkedInTodayAt || undefined,
    checkedInTodayGymId: u.checkedInTodayGymId || undefined,
    isDemoSeed: false,
  }
}

function normalizeGender(value: unknown): Gender {
  return value === 'female' ? 'female' : 'male'
}

function createDefaultUser(name: string, email: string, gender: Gender = 'male'): AppUser {
  return withAdminFlags({
    id: 'me',
    username: generateLocalUsername(name),
    name,
    email: normalizeEmail(email),
    age: 25,
    gender: normalizeGender(gender),
    bio: '',
    photos: [],
    avatar: localGenderAvatar(normalizeGender(gender)),
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
    breakUntil: null as string | null,
    privacy: 'open' as PrivacyMode,
    lookingToMeet: true,
    isActive: false,
    checkedInGymId: '',
    checkedInAt: '',
    checkedInExpiresAt: '',
    checkInExtendCount: 0,
    checkInCanExtend: false,
    lastSeenAt: new Date().toISOString(),
    registeredAt: new Date().toISOString(),
    onboardingDone: false,
    isAdmin: false,
    isMasterAdmin: false,
    canGrantAdmin: false,
    adminPermissions: { ...EMPTY_PERMISSIONS },
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
  const existingUsername =
    typeof raw.username === 'string' ? normalizeUsername(raw.username) : ''
  const normalized = withAdminFlags(
    withSyncedAvatar({
      ...gymNormalized,
      username: existingUsername || generateLocalUsername(gymNormalized.name || 'user'),
      photos: Array.isArray(raw.photos) ? raw.photos : [],
      sports: Array.isArray(raw.sports) ? raw.sports : [],
      interests: Array.isArray(raw.interests) ? raw.interests : [],
      isActive: Boolean(raw.isActive) && Boolean(checkedInGymId),
      checkedInGymId: raw.isActive ? checkedInGymId : '',
      checkedInAt:
        Boolean(raw.isActive) && Boolean(checkedInGymId)
          ? typeof raw.checkedInAt === 'string' && raw.checkedInAt
            ? raw.checkedInAt
            : typeof raw.lastSeenAt === 'string'
              ? raw.lastSeenAt
              : new Date().toISOString()
          : '',
      checkedInExpiresAt:
        Boolean(raw.isActive) && Boolean(checkedInGymId)
          ? typeof raw.checkedInExpiresAt === 'string' && raw.checkedInExpiresAt
            ? raw.checkedInExpiresAt
            : ''
          : '',
      checkInExtendCount:
        Boolean(raw.isActive) && Boolean(checkedInGymId)
          ? Number(raw.checkInExtendCount) || 0
          : 0,
      checkInCanExtend: Boolean(raw.checkInCanExtend),
      visitSlots: Array.isArray(raw.visitSlots) ? raw.visitSlots : [],
      breakUntil: activeBreakUntil(raw.breakUntil),
      registeredAt:
        typeof raw.registeredAt === 'string' && raw.registeredAt
          ? raw.registeredAt
          : typeof raw.lastSeenAt === 'string'
            ? raw.lastSeenAt
            : new Date().toISOString(),
      isAdmin: Boolean(raw.isAdmin),
      isMasterAdmin: Boolean(raw.isMasterAdmin),
      canGrantAdmin: Boolean(raw.canGrantAdmin),
      adminPermissions: raw.adminPermissions,
    }),
  )

  // Soft fallback: expired local sessions clear on load
  if (normalized.isActive) {
    const expiresAt =
      normalized.checkedInExpiresAt ||
      getCheckInExpiresAt(normalized) ||
      buildCheckInSessionFields(normalized.checkedInAt).checkedInExpiresAt
    const withExpiry: AppUser = {
      ...normalized,
      checkedInExpiresAt: expiresAt,
      checkInCanExtend: canExtendCheckInLocal({
        ...normalized,
        checkedInExpiresAt: expiresAt,
      }),
    }
    if (isCheckInExpired(withExpiry)) {
      const cleared: AppUser = {
        ...withExpiry,
        isActive: false,
        checkedInGymId: '',
        checkedInAt: '',
        checkedInExpiresAt: '',
        checkInExtendCount: 0,
        checkInCanExtend: false,
      }
      saveJson(STORAGE_USER, cleared)
      if (cleared.email) saveAccountProfile(cleared)
      return cleared
    }
    saveJson(STORAGE_USER, withExpiry)
    if (withExpiry.email) saveAccountProfile(withExpiry)
    return withExpiry
  }

  saveJson(STORAGE_USER, normalized)
  if (normalized.email) saveAccountProfile(normalized)
  return normalized
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(() => loadUser())
  const [knownUsers, setKnownUsers] = useState<UserProfile[]>(() => {
    const current = loadUser()
    return current ? loadAccountBags(current.email).contacts : []
  })
  const [apiOnline, setApiOnline] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const current = loadUser()
    return current ? loadAccountBags(current.email).conversations : []
  })
  const [messages, setMessages] = useState<Message[]>(() => {
    const current = loadUser()
    return current ? loadAccountBags(current.email).messages : []
  })
  const [likes, setLikes] = useState<LikesMap>(() => {
    const current = loadUser()
    return current ? loadAccountBags(current.email).likes : {}
  })
  const [likeCounts, setLikeCounts] = useState<LikeCounts>(() => {
    const current = loadUser()
    if (!current) return {}
    const bags = loadAccountBags(current.email)
    return seedLikeCounts(bags.likes)
  })
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const current = loadUser()
    return current ? loadNotificationsForUser(current.email, false) : []
  })
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>(() => {
    const current = loadUser()
    return current ? loadNotificationPrefsForUser(current.email) : { ...DEFAULT_NOTIF_PREFS }
  })
  const [tickets, setTickets] = useState<FeedbackTicket[]>(() => seedTicketsIfEmpty())
  const [adminDirectory, setAdminDirectory] = useState<AdminDirectoryUser[]>(() => loadDirectory())
  const [blockedEmails, setBlockedEmails] = useState<string[]>(() => loadBlockedEmails())
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>(() =>
    loadBlockedUserIds(loadUser()?.id || ''),
  )

  const userEmailRef = useRef(user?.email || '')
  const userRef = useRef(user)
  const apiOnlineRef = useRef(false)
  const notificationPrefsRef = useRef(notificationPrefs)
  /** Инкремент при login/logout — отсекает устаревшие apiLogout/apiMe */
  const sessionEpochRef = useRef(0)
  useEffect(() => {
    userEmailRef.current = user?.email || ''
  }, [user?.email])
  useEffect(() => {
    userRef.current = user
  }, [user])
  useEffect(() => {
    apiOnlineRef.current = apiOnline
  }, [apiOnline])
  useEffect(() => {
    notificationPrefsRef.current = notificationPrefs
  }, [notificationPrefs])

  // Postgres API: health + восстановление сессии по JWT
  useEffect(() => {
    let cancelled = false
    const bootEpoch = sessionEpochRef.current
    ;(async () => {
      const online = await apiHealth()
      if (cancelled || bootEpoch !== sessionEpochRef.current) return
      setApiOnline(online)
      apiOnlineRef.current = online

      // Cookie session — always try /auth/me when API is up (no JWT in localStorage).
      if (!online) return
      try {
        const me = await apiMe()
        if (cancelled || bootEpoch !== sessionEpochRef.current) return
        setStoredToken('1')
        const normalized = withAdminFlags(
          normalizeGymFields(me as AppUser) as AppUser,
        )
        setUser(normalized)
        saveJson(STORAGE_USER, normalized)
        saveAccountProfile(normalized)
        hydrateAccountData(normalized.email)
      } catch (err) {
        if (cancelled || bootEpoch !== sessionEpochRef.current) return
        // Только 401 = сессия мертва. Иные ошибки / health blip — не стираем аккаунт.
        if (err instanceof ApiError && err.status === 401) {
          setStoredToken(null)
          setUser(null)
          localStorage.removeItem(STORAGE_USER)
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const persistChats = useCallback((list: Conversation[]) => {
    const email = userEmailRef.current
    if (email) saveAccountConversations(email, list)
  }, [])
  const persistMsgs = useCallback((list: Message[]) => {
    const email = userEmailRef.current
    if (email) saveAccountMessages(email, list)
  }, [])
  const persistLikesMap = useCallback((map: LikesMap) => {
    const email = userEmailRef.current
    if (email) saveAccountLikes(email, map)
  }, [])

  const hydrateAccountData = useCallback((email: string) => {
    userEmailRef.current = email
    const bags = loadAccountBags(email)
    const current = loadUser()
    const contacts = resolveContacts(bags.conversations, bags.contacts, current?.id)
    setConversations(bags.conversations)
    setMessages(bags.messages)
    setLikes(bags.likes)
    setLikeCounts(seedLikeCounts(bags.likes))
    setKnownUsers(contacts)
    saveAccountContacts(email, contacts)
    // seed уведомлений только для демо и только при первом создании ключа
    setNotifications(loadNotificationsForUser(email, false))
    setNotificationPrefs(loadNotificationPrefsForUser(email))
  }, [])

  const pushNotification = useCallback(
    (item: Omit<AppNotification, 'id' | 'createdAt' | 'read'> & { id?: string }) => {
      const email = userEmailRef.current
      if (!email) return
      if (!isNotificationAllowed(notificationPrefsRef.current, item.type)) return

      setNotifications((prev) => {
        const id = item.id || `n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        // Стабильный id (например после онбординга) — не дублируем
        if (item.id && prev.some((n) => n.id === item.id)) return prev
        const next: AppNotification[] = [
          {
            id,
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
        saveNotificationsForUser(email, next)
        return next
      })
    },
    [],
  )

  const unreadNotifications = useMemo(
    () => unreadNotificationsCount(notifications, notificationPrefs),
    [notifications, notificationPrefs],
  )

  const unreadChats = useMemo(
    () =>
      conversations.reduce((sum, c) => {
        const count = Number(c.unreadCount) || 0
        if (c.requestStatus === 'incoming' && count <= 0) return sum + 1
        return sum + count
      }, 0),
    [conversations],
  )

  useEffect(() => {
    void syncAppBadge(unreadNotifications + unreadChats)
  }, [unreadNotifications, unreadChats])

  const patchMessageStatus = useCallback(
    (messageId: string, status: MessageStatus) => {
      setMessages((prev) => {
        const next = prev.map((m) => (m.id === messageId ? { ...m, status } : m))
        persistMsgs(next)
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

  const persistUser = useCallback(
    (next: AppUser | null) => {
      if (next) {
        const normalized = withAdminFlags(normalizeGymFields(next) as AppUser)
        setUser(normalized)
        saveJson(STORAGE_USER, normalized)
        saveAccountProfile(normalized)
        setAdminDirectory(loadDirectory())
        setBlockedUserIds(loadBlockedUserIds(normalized.id))
        hydrateAccountData(normalized.email)
        return
      }
      setUser(null)
      setBlockedUserIds([])
      userEmailRef.current = ''
      setConversations([])
      setMessages([])
      setLikes({})
      setLikeCounts({})
      setNotifications([])
      setNotificationPrefs({ ...DEFAULT_NOTIF_PREFS })
      localStorage.removeItem(STORAGE_USER)
    },
    [hydrateAccountData],
  )

  const rememberUserRef = useRef<(person: UserProfile) => void>(() => undefined)
  const rememberUsersRef = useRef<(people: UserProfile[]) => void>(() => undefined)
  const knownUsersRef = useRef<UserProfile[]>([])
  useEffect(() => {
    knownUsersRef.current = knownUsers
  }, [knownUsers])

  const refreshChats = useCallback(async (opts?: { before?: string; append?: boolean }) => {
    if (!apiOnlineRef.current || !getStoredToken()) return { hasMore: false }
    const { conversations: list, hasMore } = await apiFetchConversations({
      before: opts?.before,
      limit: 50,
    })
    rememberUsersRef.current(list.map((row) => row.other).filter(Boolean) as UserProfile[])
    const mapped = list.map(({ other: _o, ...c }) => c)
    setConversations((prev) => {
      let next: Conversation[]
      if (opts?.append) {
        const seen = new Set(prev.map((c) => c.id))
        const extra = mapped.filter((c) => !seen.has(c.id))
        next = [...prev, ...extra].sort(
          (a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt),
        )
      } else {
        next = mapped.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
      }
      const email = userEmailRef.current
      if (email) saveAccountConversations(email, next)
      return next
    })
    return { hasMore }
  }, [])

  /** Light poll: chats + notifications + likes so badges and likes stay fresh while the app is open */
  const refreshInbox = useCallback(async () => {
    if (!apiOnlineRef.current || !getStoredToken()) return
    try {
      const [notifs, listPayload, likesPayload] = await Promise.all([
        apiFetchNotifications(),
        apiFetchConversations({ limit: 50 }),
        apiFetchLikes(),
      ])
      const list = listPayload.conversations
      const email = userEmailRef.current
      setNotifications(notifs)
      if (email) saveNotificationsForUser(email, notifs)
      const contacts: UserProfile[] = []
      for (const row of list) {
        if (row.other) contacts.push(row.other)
      }
      for (const actor of likesPayload.actors) contacts.push(actor)
      rememberUsersRef.current(contacts)
      const fresh = list.map(({ other: _o, ...c }) => c)
      setConversations((prev) => {
        // Keep chats loaded via "ещё" pagination; poll only refreshes the head page
        const freshIds = new Set(fresh.map((c) => c.id))
        const extras = prev.filter((c) => !freshIds.has(c.id))
        const next = [...fresh, ...extras].sort(
          (a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt),
        )
        if (email) saveAccountConversations(email, next)
        return next
      })
      const likesMap = normalizeLikesMap(likesPayload.likes)
      const counts = normalizeLikeCounts(likesPayload.counts)
      setLikes(likesMap)
      setLikeCounts(counts)
      if (email) saveAccountLikes(email, likesMap)
    } catch {
      /* keep cache */
    }
  }, [])

  const refreshThread = useCallback(
    async (conversationId: string, opts?: { before?: string }) => {
      if (!apiOnlineRef.current || !getStoredToken() || !conversationId) {
        return { hasMore: false }
      }
      const {
        conversation,
        messages: thread,
        hasMore,
      } = await apiFetchMessages(conversationId, {
        before: opts?.before,
      })
      if (conversation.other) rememberUserRef.current(conversation.other)
      const { other: _o, ...conv } = conversation
      if (!opts?.before) {
        setConversations((prev) => {
          const rest = prev.filter((c) => c.id !== conv.id)
          const next = [conv, ...rest].sort(
            (a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt),
          )
          const email = userEmailRef.current
          if (email) saveAccountConversations(email, next)
          return next
        })
      }
      setMessages((prev) => {
        const others = prev.filter((m) => m.conversationId !== conversationId)
        let threadMsgs: Message[]
        if (opts?.before) {
          const existing = prev.filter((m) => m.conversationId === conversationId)
          const seen = new Set(existing.map((m) => m.id))
          const older = thread.filter((m) => !seen.has(m.id))
          threadMsgs = [...older, ...existing].sort(
            (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt),
          )
        } else {
          const locals = prev.filter(
            (m) =>
              m.conversationId === conversationId &&
              m.id.startsWith('local-') &&
              !thread.some((t) => t.text === m.text && t.senderId === m.senderId),
          )
          threadMsgs = [...thread, ...locals].sort(
            (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt),
          )
        }
        const next = [...others, ...threadMsgs]
        const email = userEmailRef.current
        if (email) saveAccountMessages(email, next)
        return next
      })
      return { hasMore }
    },
    [],
  )

  const hydrateSocialFromApi = useCallback(async () => {
    if (!apiOnlineRef.current || !getStoredToken()) return
    try {
      const [likesPayload, notifs, prefs, ticketsList, blockedIds] = await Promise.all([
        apiFetchLikes(),
        apiFetchNotifications(),
        apiFetchNotificationPrefs(),
        apiFetchTickets(),
        apiFetchBlocks(),
      ])
      const email = userEmailRef.current
      const likesMap = normalizeLikesMap(likesPayload.likes)
      const counts = normalizeLikeCounts(likesPayload.counts)
      setLikes(likesMap)
      setLikeCounts(counts)
      if (email) saveAccountLikes(email, likesMap)
      rememberUsersRef.current(likesPayload.actors)
      setNotifications(notifs)
      if (email) saveNotificationsForUser(email, notifs)
      setNotificationPrefs(prefs)
      if (email) saveNotificationPrefsForUser(email, prefs)
      setTickets(ticketsList)
      saveTickets(ticketsList)
      setBlockedUserIds(blockedIds)
      try {
        await refreshChats()
      } catch {
        /* notifications already applied; chats keep previous cache */
      }
      void ensureWebPushSubscription()
    } catch {
      /* keep local cache */
    }
  }, [refreshChats])

  const refreshSupport = useCallback(async () => {
    if (apiOnlineRef.current && getStoredToken()) {
      try {
        const ticketsList = await apiFetchTickets()
        setTickets(ticketsList)
        saveTickets(ticketsList)
        return
      } catch {
        /* fall through */
      }
    }
    setTickets(seedTicketsIfEmpty())
  }, [])

  const refreshAdminDirectory = useCallback(
    async (opts?: { q?: string; activity?: 'seenToday' | 'checkedInToday' }) => {
      const filtered = Boolean(opts?.activity || opts?.q?.trim())
      if (apiOnlineRef.current && getStoredToken()) {
        try {
          const [users, emails] = await Promise.all([
            apiAdminFetchUsers(opts).catch(() => null),
            filtered
              ? Promise.resolve(null)
              : apiAdminFetchBlockedEmails().catch(() => null),
          ])
          if (users) {
            const mapped = users.map(toAdminDirectoryUser)
            if (!filtered) {
              saveDirectory(mapped)
              setAdminDirectory(mapped)
            }
            if (emails) {
              saveBlockedEmails(emails)
              setBlockedEmails(emails)
            } else if (!filtered) {
              setBlockedEmails(loadBlockedEmails())
            }
            if (!filtered) await refreshSupport()
            return mapped
          }
        } catch {
          /* fall through to local */
        }
      }
      if (!filtered) {
        const local = mergeStoredAccountsIntoDirectory()
        setAdminDirectory(local)
        setBlockedEmails(loadBlockedEmails())
        await refreshSupport()
        return local
      }
      return []
    },
    [refreshSupport],
  )

  // Presence for DAU: any authenticated page visit, not only check-in
  useEffect(() => {
    if (!apiOnline || !user || !getStoredToken()) return
    if (isDemoAccount(user.email)) return

    let cancelled = false
    const beat = () => {
      if (cancelled || document.visibilityState === 'hidden') return
      void apiHeartbeat().catch(() => {})
    }

    beat()
    const id = window.setInterval(beat, 60_000)
    const onVis = () => {
      if (document.visibilityState === 'visible') beat()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [apiOnline, user?.id, user?.email])

  // Общие лайки / уведомления / тикеты с сервера
  useEffect(() => {
    if (!apiOnline || !user || !getStoredToken()) return
    void hydrateSocialFromApi()
  }, [apiOnline, user?.id, hydrateSocialFromApi])

  // Keep chats, likes, and notification badges fresh while the app is open
  useEffect(() => {
    if (!apiOnline || !user || !getStoredToken()) return

    let cancelled = false
    const tick = () => {
      if (cancelled || document.visibilityState === 'hidden') return
      void refreshInbox()
      void ensureWebPushSubscription()
    }

    const id = window.setInterval(tick, 5000)
    const onVis = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVis)
    // First tick shortly after mount so badges/likes catch up without waiting a full interval
    const warm = window.setTimeout(tick, 800)

    return () => {
      cancelled = true
      window.clearInterval(id)
      window.clearTimeout(warm)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [apiOnline, user?.id, refreshInbox])

  // Админ-реестр с сервера
  useEffect(() => {
    if (!apiOnline || !user?.isAdmin || !getStoredToken()) return
    if (
      !hasAdminPermission(user, 'viewUsers') &&
      !hasAdminPermission(user, 'manageAdmins') &&
      !hasAdminPermission(user, 'blockUsers')
    ) {
      return
    }
    void refreshAdminDirectory()
  }, [apiOnline, user?.id, user?.isAdmin, refreshAdminDirectory])

  const loginLocal = useCallback(
    (email: string, password: string) => {
      if (import.meta.env.PROD) {
        throw new Error('Сервер недоступен. Попробуй позже')
      }

      const normalizedEmail = normalizeEmail(email)
      const pass = String(password ?? '')
      if (isEmailBlocked(normalizedEmail)) {
        throw new Error('Этот email заблокирован администратором')
      }

      if (isDemoAccount(normalizedEmail)) {
        const saved = loadAccountProfile(normalizedEmail)
        persistUser(saved ? (normalizeGymFields(saved) as AppUser) : createDemoAppUser())
        return true
      }

      const saved = loadAccountProfile(normalizedEmail)
      const session = loadUser()
      const sessionMatch =
        session && normalizeEmail(session.email) === normalizedEmail ? session : null

      // Dev-only: no auto-create admin accounts on login
      if (!saved && !sessionMatch) {
        throw new Error('Аккаунт не найден')
      }

      if (hasAccountPassword(normalizedEmail)) {
        if (!verifyAccountPassword(normalizedEmail, pass)) {
          throw new Error('Неверный email или пароль')
        }
      } else if (pass.length >= PASSWORD_MIN) {
        saveAccountPassword(normalizedEmail, pass)
      } else {
        throw new Error('Неверный email или пароль')
      }

      persistUser(normalizeGymFields((saved || sessionMatch) as AppUser) as AppUser)
      return true
    },
    [persistUser],
  )

  const login = useCallback(
    async (email: string, password: string) => {
      const normalizedEmail = normalizeEmail(email)
      if (isDemoAccount(normalizedEmail)) {
        if (import.meta.env.PROD) {
          throw new Error('Демо-вход недоступен')
        }
        sessionEpochRef.current += 1
        let ok = false
        flushSync(() => {
          ok = loginLocal(email, password)
        })
        return ok
      }

      const online = apiOnlineRef.current || (await apiHealth())
      setApiOnline(online)
      if (online) {
        try {
          const me = await apiLogin(normalizedEmail, password)
          sessionEpochRef.current += 1
          // flushSync: иначе navigate('/app') видит ещё null/старого user
          flushSync(() => {
            persistUser(withAdminFlags(normalizeGymFields(me as AppUser) as AppUser))
          })
          return true
        } catch (err) {
          if (err instanceof ApiError) throw err
          throw new Error(err instanceof Error ? err.message : 'Не удалось войти')
        }
      }

      sessionEpochRef.current += 1
      let ok = false
      flushSync(() => {
        ok = loginLocal(email, password)
      })
      return ok
    },
    [loginLocal, persistUser],
  )

  const register = useCallback(
    async (name: string, email: string, password: string, gender: Gender) => {
      const normalizedEmail = normalizeEmail(email)
      const pass = String(password ?? '')
      if (isEmailBlocked(normalizedEmail)) {
        throw new Error('Этот email заблокирован администратором')
      }
      if (isDemoAccount(normalizedEmail)) {
        throw new Error('Этот email недоступен для регистрации')
      }
      if (pass.length < PASSWORD_MIN) {
        throw new Error(`Пароль должен быть не короче ${PASSWORD_MIN} символов`)
      }
      if (pass.length > PASSWORD_MAX) {
        throw new Error(`Пароль слишком длинный — максимум ${PASSWORD_MAX} символов`)
      }
      const safeName = clampText(name.trim(), NAME_MAX)

      const online = apiOnlineRef.current || (await apiHealth())
      setApiOnline(online)
      if (online) {
        try {
          const me = await apiRegister({
            name: safeName,
            email: normalizedEmail,
            password: pass,
            gender: normalizeGender(gender),
          })
          sessionEpochRef.current += 1
          flushSync(() => {
            persistUser(withAdminFlags(normalizeGymFields(me as AppUser) as AppUser))
          })
          return true
        } catch (err) {
          if (err instanceof ApiError) throw err
          throw new Error(err instanceof Error ? err.message : 'Не удалось зарегистрироваться')
        }
      }

      if (import.meta.env.PROD) {
        throw new Error('Сервер недоступен. Попробуй позже')
      }

      if (loadAccountProfile(normalizedEmail)) {
        throw new Error('Аккаунт с таким email уже есть — войди')
      }
      saveAccountPassword(normalizedEmail, pass)
      sessionEpochRef.current += 1
      flushSync(() => {
        persistUser(createDefaultUser(safeName, normalizedEmail, normalizeGender(gender)))
      })
      return true
    },
    [persistUser],
  )

  const logout = useCallback(async () => {
    // Сначала локально выходим — иначе медленный /auth/logout в Safari
    // может завершиться уже после нового login и стереть админ-сессию.
    const epoch = ++sessionEpochRef.current
    setStoredToken(null)
    flushSync(() => {
      persistUser(null)
    })
    try {
      await apiLogout()
    } catch {
      /* token already cleared */
    }
    // Если за время запроса уже вошли в другой аккаунт — не трогаем
    if (epoch !== sessionEpochRef.current) return
    setStoredToken(null)
  }, [persistUser])

  const applyServerUser = useCallback((me: AppUser) => {
    const next = withAdminFlags(normalizeGymFields(me) as AppUser)
    setUser(next)
    saveJson(STORAGE_USER, next)
    saveAccountProfile(next)
    return next
  }, [])

  const completeOnboarding = useCallback(
    async (data: Partial<AppUser>): Promise<{ ok: true } | { ok: false; error: string }> => {
      // flushSync: иначе navigate('/app') успевает раньше, чем onboardingDone=true,
      // ProtectedRoute кидает обратно на /onboarding → пустой/чёрный экран
      const box: { user: AppUser | null; prev: AppUser | null } = { user: null, prev: null }
      flushSync(() => {
        setUser((prev) => {
          if (!prev) return prev
          box.prev = prev
          const next = withSyncedAvatar(
            normalizeGymFields({
              ...prev,
              ...data,
              photos: Array.isArray(data.photos) ? data.photos : prev.photos || [],
              sports: Array.isArray(data.sports) ? data.sports : prev.sports || [],
              interests: Array.isArray(data.interests) ? data.interests : prev.interests || [],
              coachSports: Array.isArray(data.coachSports)
                ? data.coachSports
                : prev.coachSports || [],
              visitSlots: Array.isArray(data.visitSlots) ? data.visitSlots : prev.visitSlots || [],
              onboardingDone: true,
            }) as AppUser,
          )
          box.user = next
          saveJson(STORAGE_USER, next)
          saveAccountProfile(next)
          return next
        })
      })
      const saved = box.user
      if (!saved) {
        return { ok: false, error: 'Не удалось сохранить профиль. Начни заново' }
      }

      let syncedFromApi = false
      const needApi = apiOnlineRef.current && !isDemoAccount(saved.email)

      if (needApi) {
        const patch = {
          ...data,
          onboardingDone: true as const,
          gymIds: saved.gymIds,
          homeGymId: saved.homeGymId || saved.gymIds[0] || undefined,
          city: saved.city,
          age: saved.age,
          bio: saved.bio,
          intent: saved.intent,
          experienceLevel: saved.experienceLevel,
          interests: saved.interests,
          sports: saved.sports,
          isCoach: saved.isCoach,
          coachSports: saved.coachSports,
          visitSlots: saved.visitSlots,
          privacy: saved.privacy,
          lookingToMeet: saved.lookingToMeet,
        }
        try {
          const me = await apiPatchMe(patch)
          applyServerUser(me as AppUser)
          syncedFromApi = true
        } catch {
          try {
            const me = await apiPatchMe({ onboardingDone: true })
            applyServerUser(me as AppUser)
            syncedFromApi = true
          } catch {
            syncedFromApi = false
          }
        }
        if (!syncedFromApi) {
          // Откат: онлайн, но сервер не принял — просим начать заново
          const rollback = box.prev
          if (rollback) {
            flushSync(() => {
              setUser(rollback)
              saveJson(STORAGE_USER, rollback)
              saveAccountProfile(rollback)
            })
          }
          return {
            ok: false,
            error: 'Не удалось сохранить данные. Проверь интернет и начни заново',
          }
        }
        try {
          await hydrateSocialFromApi()
        } catch {
          /* keep local */
        }
      }

      // Offline / демо: локальный welcome, если сервер не отдал ленту
      if (!syncedFromApi) {
        window.setTimeout(() => {
          pushNotification({
            id: WELCOME_INSTALL_LOCAL_ID,
            type: 'system',
            title: WELCOME_INSTALL_TITLE,
            body: WELCOME_INSTALL_BODY,
            href: WELCOME_INSTALL_HREF,
          })
        }, 400)
      }
      return { ok: true }
    },
    [pushNotification, applyServerUser, hydrateSocialFromApi],
  )

  const updateProfile = useCallback(
    async (data: Partial<AppUser>) => {
      const safe: Partial<AppUser> = {
        ...data,
        ...(data.name !== undefined ? { name: clampText(data.name.trim(), NAME_MAX) } : {}),
        ...(data.username !== undefined
          ? { username: normalizeUsername(data.username) }
          : {}),
        ...(data.bio !== undefined ? { bio: clampText(data.bio, BIO_MAX) } : {}),
        ...(data.photos !== undefined ? { photos: clampPhotos(data.photos) } : {}),
      }
      // Never send check-in session fields — PATCH /me schema is strict (C1)
      delete (safe as { isActive?: unknown }).isActive
      delete (safe as { checkedInGymId?: unknown }).checkedInGymId
      delete (safe as { checkedInAt?: unknown }).checkedInAt
      delete (safe as { checkedInExpiresAt?: unknown }).checkedInExpiresAt
      delete (safe as { checkInExtendCount?: unknown }).checkInExtendCount
      delete (safe as { checkInCanExtend?: unknown }).checkInCanExtend

      if (safe.gymIds !== undefined && safe.gymIds.length < 1) {
        throw new Error('Нужен хотя бы один зал')
      }

      const snapshot = userRef.current
      if (!snapshot) return

      const clearingCheckIn =
        Boolean(safe.breakUntil) && snapshot.isActive
          ? {
              isActive: false as const,
              checkedInGymId: '',
              checkedInAt: '',
              checkedInExpiresAt: '',
              checkInExtendCount: 0,
              checkInCanExtend: false,
            }
          : {}
      const merged = normalizeGymFields({
        ...snapshot,
        ...safe,
        ...clearingCheckIn,
        ...(safe.gender !== undefined ? { gender: normalizeGender(safe.gender) } : {}),
        ...(safe.breakUntil !== undefined
          ? { breakUntil: activeBreakUntil(safe.breakUntil) }
          : {}),
        lastSeenAt: new Date().toISOString(),
      }) as AppUser
      const nameOrGenderChanged =
        safe.name !== undefined || safe.gender !== undefined || safe.photos !== undefined
      const nextLocal = nameOrGenderChanged ? withSyncedAvatar(merged) : merged
      userRef.current = nextLocal
      setUser(nextLocal)
      saveJson(STORAGE_USER, nextLocal)
      saveAccountProfile(nextLocal)

      if (!apiOnlineRef.current || isDemoAccount(nextLocal.email)) return

      try {
        // Break while checked-in: check out on server before PATCH breakUntil
        if (safe.breakUntil && snapshot.isActive) {
          const afterOut = await apiCheckOut()
          applyServerUser(afterOut as AppUser)
        }

        const patch: Partial<AppUser> = {
          ...(safe.name !== undefined ? { name: safe.name } : {}),
          ...(safe.username !== undefined ? { username: safe.username } : {}),
          ...(safe.age !== undefined ? { age: safe.age } : {}),
          ...(safe.gender !== undefined ? { gender: safe.gender } : {}),
          ...(safe.bio !== undefined ? { bio: safe.bio } : {}),
          ...(safe.photos !== undefined ? { photos: nextLocal.photos } : {}),
          ...(safe.avatar !== undefined ? { avatar: nextLocal.avatar } : {}),
          ...(safe.city !== undefined ? { city: safe.city } : {}),
          ...(safe.gymIds !== undefined ? { gymIds: safe.gymIds } : {}),
          ...(safe.homeGymId !== undefined ? { homeGymId: safe.homeGymId || '' } : {}),
          ...(safe.intent !== undefined ? { intent: safe.intent } : {}),
          ...(safe.experienceLevel !== undefined
            ? { experienceLevel: safe.experienceLevel }
            : {}),
          ...(safe.interests !== undefined ? { interests: safe.interests } : {}),
          ...(safe.sports !== undefined ? { sports: safe.sports } : {}),
          ...(safe.isCoach !== undefined ? { isCoach: safe.isCoach } : {}),
          ...(safe.coachSports !== undefined ? { coachSports: safe.coachSports } : {}),
          ...(safe.visitSlots !== undefined ? { visitSlots: safe.visitSlots } : {}),
          ...(safe.breakUntil !== undefined ? { breakUntil: safe.breakUntil } : {}),
          ...(safe.privacy !== undefined ? { privacy: safe.privacy } : {}),
          ...(safe.lookingToMeet !== undefined ? { lookingToMeet: safe.lookingToMeet } : {}),
          ...(safe.onboardingDone !== undefined
            ? { onboardingDone: safe.onboardingDone }
            : {}),
        }

        const me = await apiPatchMe(patch)
        applyServerUser(me as AppUser)
      } catch (err) {
        try {
          const me = await apiMe()
          applyServerUser(me as AppUser)
        } catch {
          /* keep optimistic local if refetch fails */
        }
        throw err instanceof Error ? err : new Error('Не удалось сохранить профиль')
      }
    },
    [applyServerUser],
  )

  const checkIn = useCallback(
    async (gymId: string) => {
      const snapshot = userRef.current
      if (!snapshot || !snapshot.gymIds.includes(gymId)) return
      const now = new Date().toISOString()
      const session = buildCheckInSessionFields(now, 0)
      const next = {
        ...snapshot,
        isActive: true,
        checkedInGymId: gymId,
        ...session,
        breakUntil: null,
        lastSeenAt: now,
      }
      userRef.current = next
      setUser(next)
      saveJson(STORAGE_USER, next)
      saveAccountProfile(next)
      if (!apiOnlineRef.current || isDemoAccount(next.email)) return
      try {
        const me = await apiCheckIn(gymId)
        applyServerUser(me as AppUser)
      } catch (err) {
        userRef.current = snapshot
        setUser(snapshot)
        saveJson(STORAGE_USER, snapshot)
        saveAccountProfile(snapshot)
        throw err instanceof Error ? err : new Error('Не удалось отметиться')
      }
    },
    [applyServerUser],
  )

  const checkOut = useCallback(async () => {
    const snapshot = userRef.current
    if (!snapshot) return
    const next = {
      ...snapshot,
      isActive: false,
      checkedInGymId: '',
      checkedInAt: '',
      checkedInExpiresAt: '',
      checkInExtendCount: 0,
      checkInCanExtend: false,
      lastSeenAt: new Date().toISOString(),
    }
    userRef.current = next
    setUser(next)
    saveJson(STORAGE_USER, next)
    saveAccountProfile(next)
    if (!apiOnlineRef.current || isDemoAccount(next.email)) return
    try {
      const me = await apiCheckOut()
      applyServerUser(me as AppUser)
    } catch (err) {
      userRef.current = snapshot
      setUser(snapshot)
      saveJson(STORAGE_USER, snapshot)
      saveAccountProfile(snapshot)
      throw err instanceof Error ? err : new Error('Не удалось снять статус')
    }
  }, [applyServerUser])

  const extendCheckIn = useCallback(async () => {
    const prev = userRef.current
    if (!prev?.isActive || !canExtendCheckInLocal(prev)) return

    // Online: server is source of truth — no silent local success on API fail
    if (apiOnlineRef.current && getStoredToken() && !isDemoAccount(prev.email)) {
      try {
        const me = await apiExtendCheckIn()
        applyServerUser(me as AppUser)
      } catch (err) {
        throw err instanceof Error ? err : new Error('Не удалось продлить')
      }
      return
    }

    setUser((current) => {
      if (!current?.isActive || !canExtendCheckInLocal(current)) return current
      const expires = Date.parse(getCheckInExpiresAt(current) || '')
      const base = Number.isFinite(expires) ? expires : Date.now()
      const nextCount = (current.checkInExtendCount || 0) + 1
      const next: AppUser = {
        ...current,
        checkedInExpiresAt: new Date(Math.max(base, Date.now()) + CHECK_IN_EXTEND_MS).toISOString(),
        checkInExtendCount: nextCount,
        checkInCanExtend: nextCount < CHECK_IN_MAX_EXTENDS,
        lastSeenAt: new Date().toISOString(),
      }
      userRef.current = next
      saveJson(STORAGE_USER, next)
      saveAccountProfile(next)
      return next
    })
  }, [applyServerUser])

  // Auto check-out when 3h (+extends) window ends — local soft fallback + sync
  useEffect(() => {
    if (!user?.isActive) return

    const tick = () => {
      if (!user.isActive || !isCheckInExpired(user)) return
      void Promise.resolve(checkOut()).catch(() => undefined)
    }

    tick()
    const id = window.setInterval(tick, 30_000)
    const onVis = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [user, checkOut])

  const toggleActive = useCallback(
    async (gymId?: string) => {
      const snapshot = userRef.current
      if (!snapshot) return
      if (snapshot.isActive) {
        await checkOut()
        return
      }
      const target =
        (gymId && snapshot.gymIds.includes(gymId) && gymId) ||
        snapshot.homeGymId ||
        snapshot.gymIds[0] ||
        ''
      if (!target) return
      await checkIn(target)
    },
    [checkIn, checkOut],
  )

  const joinGym = useCallback(
    async (gymId: string, makeHome = false) => {
      const snapshot = userRef.current
      if (!snapshot) return
      const gym = getGym(gymId)
      const nextUser: AppUser = {
        ...withGymMembership(snapshot, gymId, true, { makeHome }),
        // Catalog → settings: city follows the club you just added
        ...(gym?.city ? { city: gym.city } : {}),
      }
      userRef.current = nextUser
      setUser(nextUser)
      saveJson(STORAGE_USER, nextUser)
      saveAccountProfile(nextUser)
      if (!apiOnlineRef.current || isDemoAccount(nextUser.email)) return
      try {
        const me = await apiJoinGym(gymId, makeHome)
        applyServerUser(me as AppUser)
        if (gym?.city && gym.city !== me.city) {
          const patched = await apiPatchMe({ city: gym.city })
          applyServerUser(patched as AppUser)
        }
      } catch (err) {
        userRef.current = snapshot
        setUser(snapshot)
        saveJson(STORAGE_USER, snapshot)
        saveAccountProfile(snapshot)
        throw err instanceof Error ? err : new Error('Не удалось добавить зал')
      }
    },
    [applyServerUser],
  )

  const leaveGym = useCallback(
    async (gymId: string) => {
      const snapshot = userRef.current
      if (!snapshot) return
      if (snapshot.gymIds.length <= 1 && snapshot.gymIds.includes(gymId)) {
        throw new Error('Нельзя убрать последний зал. Сначала добавь другой.')
      }
      const nextUser = withGymMembership(snapshot, gymId, false)
      userRef.current = nextUser
      setUser(nextUser)
      saveJson(STORAGE_USER, nextUser)
      saveAccountProfile(nextUser)
      if (!apiOnlineRef.current || isDemoAccount(nextUser.email)) return
      try {
        const me = await apiLeaveGym(gymId)
        applyServerUser(me as AppUser)
      } catch (err) {
        userRef.current = snapshot
        setUser(snapshot)
        saveJson(STORAGE_USER, snapshot)
        saveAccountProfile(snapshot)
        throw err instanceof Error ? err : new Error('Не удалось убрать зал')
      }
    },
    [applyServerUser],
  )

  const setHomeGym = useCallback(
    async (gymId: string) => {
      const snapshot = userRef.current
      if (!snapshot) return
      const gymIds = snapshot.gymIds.includes(gymId) ? snapshot.gymIds : [...snapshot.gymIds, gymId]
      const nextUser: AppUser = {
        ...snapshot,
        gymIds,
        homeGymId: gymId,
        lastSeenAt: new Date().toISOString(),
      }
      userRef.current = nextUser
      setUser(nextUser)
      saveJson(STORAGE_USER, nextUser)
      saveAccountProfile(nextUser)
      if (!apiOnlineRef.current || isDemoAccount(nextUser.email)) return
      try {
        const me = await apiPatchMe({ gymIds: nextUser.gymIds, homeGymId: gymId })
        applyServerUser(me as AppUser)
      } catch (err) {
        userRef.current = snapshot
        setUser(snapshot)
        saveJson(STORAGE_USER, snapshot)
        saveAccountProfile(snapshot)
        throw err instanceof Error ? err : new Error('Не удалось сменить домашний зал')
      }
    },
    [applyServerUser],
  )

  const rememberUsers = useCallback((people: UserProfile[]) => {
    const incoming = people.filter((p) => p?.id)
    if (!incoming.length) return
    setKnownUsers((prev) => {
      let changed = false
      const map = new Map(prev.map((u) => [u.id, u]))
      for (const person of incoming) {
        const existing = map.get(person.id)
        if (!existing) {
          map.set(person.id, person)
          changed = true
          continue
        }
        const merged = { ...existing, ...person }
        if (JSON.stringify(existing) !== JSON.stringify(merged)) {
          map.set(person.id, merged)
          changed = true
        }
      }
      if (!changed) return prev
      const next = [...map.values()]
      const email = userEmailRef.current
      if (email) saveAccountContacts(email, next)
      return next
    })
  }, [])

  const rememberUser = useCallback(
    (person: UserProfile) => {
      rememberUsers([person])
    },
    [rememberUsers],
  )

  useEffect(() => {
    rememberUserRef.current = rememberUser
    rememberUsersRef.current = rememberUsers
  }, [rememberUser, rememberUsers])

  const likeInFlightRef = useRef(new Set<string>())

  const toggleLike = useCallback(
    async (userId: string) => {
      if (!user || user.id === userId) return
      if (likeInFlightRef.current.has(userId)) return
      likeInFlightRef.current.add(userId)
      try {
        if (apiOnlineRef.current && getStoredToken()) {
          try {
            const { likes: next, counts, actors } = await apiToggleLike(userId)
            const map = normalizeLikesMap(next)
            setLikes(map)
            setLikeCounts(normalizeLikeCounts(counts))
            persistLikesMap(map)
            rememberUsers(actors)
          } catch (err) {
            // Do not invent a local like on failure — keep previous state
            throw err instanceof Error ? err : new Error('Не удалось поставить лайк')
          }
          return
        }
        const liked = !hasLiked(likes, userId, user.id)
        setLikes((prev) => {
          const next = toggleLikeInMap(prev, userId, user.id)
          persistLikesMap(next)
          return next
        })
        setLikeCounts((prev) => toggleLikeCount(prev, userId, liked))
      } finally {
        likeInFlightRef.current.delete(userId)
      }
    },
    [user, likes, persistLikesMap, rememberUsers],
  )

  const getLikesFor = useCallback(
    (userId: string) => ({
      count: getLikeCount(likes, userId, likeCounts),
      likedByMe: user ? hasLiked(likes, userId, user.id) : false,
      likers: resolveLikers(likes, userId, user, knownUsers),
    }),
    [likes, likeCounts, user, knownUsers],
  )

  const getMyLikedUsers = useCallback(
    () => (user ? resolveOutgoingLikes(likes, user.id, user, knownUsers) : []),
    [likes, user, knownUsers],
  )

  const lookupUsername = useCallback(
    async (raw: string) => {
      const username = normalizeUsername(raw)
      if (!isValidUsername(username)) {
        throw new Error('Ник: 3–20 символов, латиница, цифры и _')
      }
      if (user?.username && normalizeUsername(user.username) === username) {
        return user as UserProfile
      }
      const cached = knownUsers.find((u) => u.username && normalizeUsername(u.username) === username)
      if (cached) return cached

      // Seed / test profiles (e.g. @test) — always findable locally for QA
      const seed = USERS.find((u) => u.username && normalizeUsername(u.username) === username)
      if (seed) {
        rememberUser(seed)
        return seed
      }

      const online = apiOnlineRef.current || (await apiHealth())
      setApiOnline(online)
      if (!online) {
        throw new Error('Пользователь не найден')
      }
      const found = await apiLookupUsername(username)
      rememberUser(found)
      return found
    },
    [user, knownUsers, rememberUser],
  )

  const searchUsers = useCallback(
    async (raw: string) => {
      const q = raw.trim().replace(/^@+/, '')
      if (q.length < 2) {
        throw new Error('Введи минимум 2 символа')
      }

      const online = apiOnlineRef.current || (await apiHealth())
      setApiOnline(online)
      if (online && getStoredToken()) {
        const found = await apiSearchUsers(q)
        for (const person of found) rememberUser(person)
        return found
      }

      // Offline / demo: local filter by @ник or name
      const needle = q.toLowerCase()
      const pool = [
        ...(user && isDemoAccount(user.email) ? USERS : []),
        ...knownUsers,
        ...(user ? [user as UserProfile] : []),
      ]
      const seen = new Set<string>()
      const results: UserProfile[] = []
      for (const person of pool) {
        if (seen.has(person.id)) continue
        seen.add(person.id)
        const un = (person.username || '').toLowerCase()
        const name = (person.name || '').toLowerCase()
        if (un.includes(needle) || name.includes(needle)) results.push(person)
        if (results.length >= 20) break
      }
      return results
    },
    [user, knownUsers, rememberUser],
  )

  const fetchUserById = useCallback(
    async (userId: string, opts?: { bypassCache?: boolean }) => {
      if (!userId) throw new Error('Пользователь не найден')
      if (user && user.id === userId) return user as UserProfile
      if (!opts?.bypassCache) {
        const cached = knownUsersRef.current.find((u) => u.id === userId)
        if (cached) return cached
      }
      if (user && isDemoAccount(user.email)) {
        const seed = USERS.find((u) => u.id === userId)
        if (seed) {
          rememberUser(seed)
          return seed
        }
      }
      const online = apiOnlineRef.current || (await apiHealth())
      setApiOnline(online)
      if (!online || !getStoredToken()) {
        const cached = knownUsersRef.current.find((u) => u.id === userId)
        if (cached) return cached
        throw new Error('Пользователь не найден')
      }
      const found = await apiFetchUser(userId)
      rememberUser(found)
      return found
    },
    [user, rememberUser],
  )

  const sendMessage = useCallback(
    async (conversationId: string, text: string) => {
      const trimmed = clampText(text.trim(), CHAT_MESSAGE_MAX)
      if (!trimmed) return

      const convForBlock = conversations.find((c) => c.id === conversationId)
      const peerId = convForBlock ? otherParticipantId(convForBlock, user?.id) : ''
      if (peerId && blockedUserIds.includes(peerId)) {
        throw new Error('Нельзя писать: пользователь в блоке')
      }

      if (apiOnlineRef.current && getStoredToken()) {
        const optimistic: Message = {
          id: `local-${Date.now()}`,
          conversationId,
          senderId: user?.id || 'me',
          text: trimmed,
          createdAt: new Date().toISOString(),
          status: 'sending',
        }
        setMessages((prev) => {
          const next = [...prev, optimistic]
          persistMsgs(next)
          return next
        })
        setConversations((prev) => {
          const next = prev
            .map((c) =>
              c.id === conversationId
                ? { ...c, lastMessage: trimmed, updatedAt: optimistic.createdAt, unreadCount: 0 }
                : c,
            )
            .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
          persistChats(next)
          return next
        })
        try {
          await apiSendMessage(conversationId, trimmed)
        } catch (err) {
          setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
          throw err
        }
        // POST succeeded — never roll back; refresh best-effort
        try {
          await refreshThread(conversationId)
          await refreshChats()
        } catch {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === optimistic.id ? { ...m, status: 'sent' as const } : m,
            ),
          )
        }
        return
      }

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
        persistMsgs(next)
        return next
      })
      setConversations((prev) => {
        const next = prev
          .map((c) =>
            c.id === conversationId
              ? { ...c, lastMessage: msg.text, updatedAt: msg.createdAt, unreadCount: 0 }
              : c,
          )
          .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
        persistChats(next)
        return next
      })
      simulateDelivery(msg.id, conversation?.requestStatus === 'pending')
    },
    [
      conversations,
      blockedUserIds,
      simulateDelivery,
      user?.id,
      persistMsgs,
      persistChats,
      refreshThread,
      refreshChats,
    ],
  )

  const startConversation = useCallback(
    async (userId: string, text: string) => {
      if (!user) throw new Error('Нужен вход')
      if (blockedUserIds.includes(userId)) {
        throw new Error('Пользователь в чёрном списке')
      }
      const trimmed = clampText(text.trim(), GREETING_MESSAGE_MAX)

      if (apiOnlineRef.current && getStoredToken()) {
        try {
          const conv = await apiStartConversation(userId, trimmed || undefined)
          if (conv.other) rememberUser(conv.other)
          await refreshChats()
          if (trimmed || conv.id) await refreshThread(conv.id).catch(() => undefined)
          return conv.id
        } catch (err) {
          // 409 already-exists pending: open existing thread after refresh
          if (err instanceof ApiError && err.status === 409) {
            await refreshChats().catch(() => undefined)
            const list = await apiFetchConversations().catch(() => null)
            const found = list?.conversations.find((row) => {
              const ids = row.participantIds || []
              return ids.includes(userId) || row.other?.id === userId
            })
            if (found) {
              if (found.other) rememberUser(found.other)
              const e = new Error(err.message) as Error & { conversationId?: string }
              e.conversationId = found.id
              throw e
            }
          }
          throw err
        }
      }

      const existing = conversations.find(
        (c) => otherParticipantId(c, user.id) === userId,
      )
      const conversationId = existing?.id ?? `c-${Date.now()}`
      const now = new Date().toISOString()
      const seed = USERS.find((u) => u.id === userId)
      if (seed) rememberUser(seed)

      if (existing) {
        if (trimmed) {
          const msgId = `m-${Date.now()}`
          setConversations((prev) => {
            const next = prev
              .map((c) =>
                c.id === existing.id
                  ? { ...c, lastMessage: trimmed, updatedAt: now }
                  : c,
              )
              .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
            persistChats(next)
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
            persistMsgs(next)
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
        const next = [conversation, ...prev].sort(
          (a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt),
        )
        persistChats(next)
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
          persistMsgs(next)
          return next
        })
        simulateDelivery(msgId, true)
      }
      return conversationId
    },
    [
      conversations,
      simulateDelivery,
      user,
      blockedUserIds,
      rememberUser,
      persistChats,
      persistMsgs,
      refreshChats,
      refreshThread,
    ],
  )

  const acceptRequest = useCallback(
    async (conversationId: string) => {
      if (apiOnlineRef.current && getStoredToken()) {
        await apiAcceptConversation(conversationId)
        await refreshChats()
        await refreshThread(conversationId)
        return
      }
      setConversations((prev) => {
        const next = prev.map((c) =>
          c.id === conversationId ? { ...c, requestStatus: 'accepted' as const } : c,
        )
        persistChats(next)
        return next
      })
      setMessages((prev) => {
        const next = prev.map((m) =>
          m.conversationId === conversationId && m.senderId === 'me' && m.status !== 'read'
            ? { ...m, status: 'read' as const }
            : m,
        )
        persistMsgs(next)
        return next
      })
    },
    [persistChats, persistMsgs, refreshChats, refreshThread],
  )

  const updateNotificationPrefs = useCallback(async (patch: Partial<NotificationPrefs>) => {
    let snapshot: NotificationPrefs | null = null
    setNotificationPrefs((prev) => {
      snapshot = prev
      const next = { ...prev, ...patch }
      const email = userEmailRef.current
      if (email) saveNotificationPrefsForUser(email, next)
      return next
    })
    if (!apiOnlineRef.current || !getStoredToken()) return
    try {
      const prefs = await apiPatchNotificationPrefs(patch)
      setNotificationPrefs(prefs)
      const email = userEmailRef.current
      if (email) saveNotificationPrefsForUser(email, prefs)
    } catch (err) {
      if (snapshot) {
        setNotificationPrefs(snapshot)
        const email = userEmailRef.current
        if (email) saveNotificationPrefsForUser(email, snapshot)
      }
      throw err instanceof Error ? err : new Error('Не удалось сохранить настройки')
    }
  }, [])

  const markNotificationRead = useCallback(async (id: string) => {
    let snapshot: AppNotification[] | null = null
    setNotifications((prev) => {
      snapshot = prev
      const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      const email = userEmailRef.current
      if (email) saveNotificationsForUser(email, next)
      return next
    })
    if (!apiOnlineRef.current || !getStoredToken()) return
    try {
      await apiMarkNotificationRead(id)
    } catch {
      if (snapshot) {
        setNotifications(snapshot)
        const email = userEmailRef.current
        if (email) saveNotificationsForUser(email, snapshot)
      }
    }
  }, [])

  const markAllNotificationsRead = useCallback(async () => {
    let snapshot: AppNotification[] | null = null
    setNotifications((prev) => {
      snapshot = prev
      const next = prev.map((n) => ({ ...n, read: true }))
      const email = userEmailRef.current
      if (email) saveNotificationsForUser(email, next)
      return next
    })
    if (!apiOnlineRef.current || !getStoredToken()) return
    try {
      await apiMarkAllNotificationsRead()
    } catch {
      if (snapshot) {
        setNotifications(snapshot)
        const email = userEmailRef.current
        if (email) saveNotificationsForUser(email, snapshot)
      }
    }
  }, [])

  const createFeedbackTicket = useCallback(
    async (category: FeedbackCategoryId, message: string) => {
      if (!user) throw new Error('Нужен вход')
      if (isEmailBlocked(user.email)) throw new Error('Email заблокирован')
      if (apiOnlineRef.current && getStoredToken()) {
        const ticket = await apiCreateTicket(category, message)
        await refreshSupport()
        await hydrateSocialFromApi()
        return ticket
      }
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
        body: 'Поддержка ответит в разделе «Обратная связь»',
        href: `/app/feedback/${ticket.id}`,
      })
      return ticket
    },
    [user, pushNotification, refreshSupport, hydrateSocialFromApi],
  )

  const replyFeedbackTicket = useCallback(
    async (ticketId: string, message: string) => {
      if (!user) throw new Error('Нужен вход')
      if (apiOnlineRef.current && getStoredToken()) {
        const ticket = await apiReplyTicket(ticketId, message)
        await refreshSupport()
        return ticket
      }
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
    [user, refreshSupport],
  )

  const adminReplyTicket = useCallback(
    async (ticketId: string, message: string, closeAs?: 'resolved' | 'closed') => {
      if (!hasAdminPermission(user, 'tickets')) throw new Error('Нет права отвечать на обращения')
      if (apiOnlineRef.current && getStoredToken()) {
        const ticket = await apiReplyTicket(ticketId, message, closeAs)
        await refreshSupport()
        return ticket
      }
      const ticket = replyToTicket({
        ticketId,
        senderType: 'admin',
        senderId: user!.id,
        senderName: user!.name,
        message,
        closeAs,
        takeInProgress: !closeAs,
      })
      setTickets(seedTicketsIfEmpty())
      if (normalizeEmail(ticket.userEmail) !== normalizeEmail(user!.email)) {
        appendNotificationForEmail(ticket.userEmail, {
          type: 'admin',
          title: closeAs ? 'Обращение закрыто' : 'Ответ поддержки',
          body: message.slice(0, 120),
          href: `/app/feedback/${ticket.id}`,
        })
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
    [user, pushNotification, refreshSupport],
  )

  const adminMessageUser = useCallback(
    async (target: AdminDirectoryUser, message: string) => {
      if (!hasAdminPermission(user, 'messageUsers')) {
        throw new Error('Нет права писать пользователям')
      }
      if (target.isMasterAdmin && !user!.isMasterAdmin) {
        throw new Error('Нельзя писать главному админу от имени другого админа')
      }
      if (isEmailBlocked(target.email)) {
        throw new Error('Этот email заблокирован — сначала разблокируй')
      }
      if (apiOnlineRef.current && getStoredToken()) {
        const ticket = await apiAdminOutboundTicket(target.id, message)
        await refreshSupport()
        return ticket
      }
      const ticket = createAdminOutboundTicket({
        targetUserId: target.id,
        targetUserName: target.name,
        targetUserEmail: target.email,
        adminId: user!.id,
        adminName: user!.name,
        message,
      })
      setTickets(seedTicketsIfEmpty())
      appendNotificationForEmail(target.email, {
        type: 'admin',
        title: 'Сообщение от Spotter',
        body: message.slice(0, 140),
        href: `/app/feedback/${ticket.id}`,
      })
      if (normalizeEmail(target.email) === normalizeEmail(user!.email)) {
        setNotifications(loadNotificationsForUser(user!.email, false))
      }
      return ticket
    },
    [user, refreshSupport],
  )

  const adminSetTicketStatus = useCallback(
    async (ticketId: string, status: FeedbackTicketStatus) => {
      if (!hasAdminPermission(user, 'tickets')) throw new Error('Нет права работать с обращениями')
      if (apiOnlineRef.current && getStoredToken()) {
        const ticket = await apiPatchTicketStatus(ticketId, status)
        setTickets((prev) => {
          const next = prev.map((t) => (t.id === ticket.id ? ticket : t))
          saveTickets(next)
          return next
        })
        return ticket
      }
      const ticket = setTicketStatus(
        ticketId,
        status,
        status === 'in_progress' ? user!.id : undefined,
      )
      setTickets(seedTicketsIfEmpty())
      return ticket
    },
    [user],
  )

  const canManageAdmins = hasAdminPermission(user, 'manageAdmins')
  const canBlockUsers = hasAdminPermission(user, 'blockUsers')
  const canRemoveUsers = hasAdminPermission(user, 'removeUsers')
  const canViewUsers = hasAdminPermission(user, 'viewUsers')
  const canHandleTickets = hasAdminPermission(user, 'tickets')
  const canMessageUsers = hasAdminPermission(user, 'messageUsers')

  const adminSetUserAdmin = useCallback(
    async (userId: string, isAdmin: boolean, preset: AdminPermissionPreset = 'support') => {
      if (!canManageAdmins) throw new Error('Недостаточно прав для назначения админов')
      const presetPerms =
        ADMIN_PRESETS.find((p) => p.id === preset)?.permissions || SUPPORT_PERMISSIONS
      // Только главный может выдавать manageAdmins / полные права с управлением
      let permissions = { ...presetPerms }
      if (!user?.isMasterAdmin) {
        permissions = { ...permissions, manageAdmins: false }
        if (preset === 'full') {
          permissions = {
            ...permissions,
            removeUsers: canRemoveUsers ? permissions.removeUsers : false,
          }
        }
      }
      if (apiOnlineRef.current && getStoredToken()) {
        const updated = await apiAdminPatchUserAdmin(userId, {
          isAdmin,
          permissions: isAdmin ? permissions : undefined,
        })
        setAdminDirectory((prev) => {
          const mapped = toAdminDirectoryUser(updated)
          const next = prev.some((p) => p.id === mapped.id)
            ? prev.map((p) => (p.id === mapped.id ? { ...p, ...mapped } : p))
            : [...prev, mapped]
          saveDirectory(next)
          return next
        })
        if (user && user.id === updated.id) {
          persistUser(withAdminFlags(normalizeGymFields(updated) as AppUser))
        }
        return
      }
      const updated = dirSetUserAdmin(userId, isAdmin, canManageAdmins, permissions)
      setAdminDirectory(loadDirectory())
      if (user && (user.id === userId || normalizeEmail(user.email) === normalizeEmail(updated.email))) {
        persistUser({
          ...user,
          isAdmin: updated.isAdmin,
          canGrantAdmin: updated.adminPermissions?.manageAdmins ?? false,
          adminPermissions: updated.adminPermissions || SUPPORT_PERMISSIONS,
        })
      }
    },
    [canManageAdmins, canRemoveUsers, user, persistUser],
  )

  const adminSetPermissions = useCallback(
    async (userId: string, permissions: AdminPermissions) => {
      if (!canManageAdmins) throw new Error('Недостаточно прав')
      let next = { ...permissions }
      if (!user?.isMasterAdmin) {
        // Обычный админ с manageAdmins не может выдавать manageAdmins и removeUsers сверх своих
        next = {
          ...next,
          manageAdmins: false,
          removeUsers: user && hasAdminPermission(user, 'removeUsers') ? next.removeUsers : false,
        }
      }
      if (apiOnlineRef.current && getStoredToken()) {
        const updated = await apiAdminPatchUserAdmin(userId, {
          isAdmin: true,
          permissions: next,
        })
        setAdminDirectory((prev) => {
          const mapped = toAdminDirectoryUser(updated)
          const list = prev.map((p) => (p.id === mapped.id ? { ...p, ...mapped } : p))
          saveDirectory(list)
          return list
        })
        if (user && user.id === updated.id) {
          persistUser(withAdminFlags(normalizeGymFields(updated) as AppUser))
        }
        return
      }
      const updated = dirSetAdminPermissions(userId, next, canManageAdmins)
      setAdminDirectory(loadDirectory())
      if (user && (user.id === userId || normalizeEmail(user.email) === normalizeEmail(updated.email))) {
        persistUser({
          ...user,
          isAdmin: true,
          canGrantAdmin: updated.adminPermissions?.manageAdmins ?? false,
          adminPermissions: updated.adminPermissions || SUPPORT_PERMISSIONS,
        })
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
        const perms = {
          ...(user.adminPermissions || SUPPORT_PERMISSIONS),
          manageAdmins: canGrant,
        }
        persistUser({ ...user, canGrantAdmin: canGrant, adminPermissions: perms })
      }
    },
    [user, persistUser],
  )

  const adminBlockEmail = useCallback(
    async (email: string) => {
      if (!canBlockUsers) throw new Error('Нет права блокировать')
      const target = adminDirectory.find(
        (p) => normalizeEmail(p.email) === normalizeEmail(email),
      )
      if (target?.isMasterAdmin) throw new Error('Нельзя блокировать главного админа')
      if (apiOnlineRef.current && getStoredToken()) {
        const emails = await apiAdminBlockEmail(email)
        saveBlockedEmails(emails)
        setBlockedEmails(emails)
        return
      }
      setBlockedEmails(blockEmail(email))
    },
    [canBlockUsers, adminDirectory],
  )

  const adminUnblockEmail = useCallback(
    async (email: string) => {
      if (!canBlockUsers) throw new Error('Нет права блокировать')
      if (apiOnlineRef.current && getStoredToken()) {
        const emails = await apiAdminUnblockEmail(email)
        saveBlockedEmails(emails)
        setBlockedEmails(emails)
        return
      }
      setBlockedEmails(unblockEmail(email))
    },
    [canBlockUsers],
  )

  const adminRemoveUser = useCallback(
    async (email: string, alsoBlock = false) => {
      if (!canRemoveUsers) throw new Error('Нет права удалять пользователей')
      const listed =
        adminDirectory.find((p) => normalizeEmail(p.email) === normalizeEmail(email)) ||
        loadDirectory().find((p) => normalizeEmail(p.email) === normalizeEmail(email))
      if (listed?.isMasterAdmin) throw new Error('Нельзя удалить главного админа')
      if (user && normalizeEmail(user.email) === normalizeEmail(email)) {
        throw new Error('Нельзя удалить свой аккаунт')
      }
      if (apiOnlineRef.current && getStoredToken()) {
        const target = listed
        if (!target?.id) throw new Error('Пользователь не найден на сервере')
        await apiAdminDeleteUser(target.id, { alsoBlock })
        if (alsoBlock) {
          // Email уже заблокирован на сервере вместе с soft-delete
          const emails = await apiAdminFetchBlockedEmails().catch(() => loadBlockedEmails())
          saveBlockedEmails(emails)
          setBlockedEmails(emails)
        }
        await refreshAdminDirectory()
        return
      }
      removeUserAccount(email, { alsoBlock })
      setAdminDirectory(loadDirectory())
      setBlockedEmails(loadBlockedEmails())
      setTickets(seedTicketsIfEmpty())
    },
    [canRemoveUsers, user, adminDirectory, refreshAdminDirectory],
  )

  const isBlocked = useCallback(
    (userId: string) => blockedUserIds.includes(userId),
    [blockedUserIds],
  )

  const blockUser = useCallback(
    async (userId: string) => {
      if (!user) throw new Error('Нужен вход')
      if (userId === user.id || userId === 'me') throw new Error('Нельзя заблокировать себя')
      // Telegram-style: keep chat + history; only mark blocked (hide from hall / no new DMs)
      if (apiOnlineRef.current && getStoredToken()) {
        const next = await apiBlockUser(userId)
        setBlockedUserIds(next)
      } else {
        setBlockedUserIds(blockUserId(user.id, userId))
      }
    },
    [user],
  )

  const unblockUser = useCallback(
    async (userId: string) => {
      if (!user) throw new Error('Нужен вход')
      if (apiOnlineRef.current && getStoredToken()) {
        setBlockedUserIds(await apiUnblockUser(userId))
        return
      }
      setBlockedUserIds(unblockUserId(user.id, userId))
    },
    [user],
  )

  const reportUser = useCallback(
    (userId: string, reason: ReportReasonId, note = '') => {
      if (!user) throw new Error('Нужен вход')
      const target = USERS.find((u) => u.id === userId)
      const who = target ? `${target.name} (${userId})` : userId
      const text = [
        `Жалоба на пользователя: ${who}`,
        `Причина: ${reportReasonLabel(reason)}`,
        note.trim() ? `Комментарий: ${note.trim()}` : '',
      ]
        .filter(Boolean)
        .join('\n')
      return createFeedbackTicket('safety', text)
    },
    [user, createFeedbackTicket],
  )

  const markRead = useCallback(
    async (conversationId: string) => {
      if (apiOnlineRef.current && getStoredToken()) {
        try {
          await apiMarkConversationRead(conversationId)
          await refreshThread(conversationId)
          await refreshChats()
          return
        } catch {
          /* local fallback below */
        }
      }
      setConversations((prev) => {
        const next = prev.map((c) =>
          c.id === conversationId ? { ...c, unreadCount: 0 } : c,
        )
        persistChats(next)
        return next
      })
      // Only mark peer messages read — never invent read ticks on own sends
      const myId = user?.id
      setMessages((prev) => {
        const next = prev.map((m) => {
          if (m.conversationId !== conversationId) return m
          if (m.senderId === 'me' || (myId && m.senderId === myId)) return m
          return { ...m, status: 'read' as const }
        })
        persistMsgs(next)
        return next
      })
    },
    [persistChats, persistMsgs, refreshChats, refreshThread, user?.id],
  )

  const togglePinConversation = useCallback(
    async (conversationId: string, pinned?: boolean) => {
      const applyLocal = (nextPinned: boolean) => {
        setConversations((prev) => {
          const next = prev.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  pinned: nextPinned,
                  pinnedAt: nextPinned ? new Date().toISOString() : null,
                }
              : c,
          )
          persistChats(next)
          return next
        })
      }

      if (apiOnlineRef.current && getStoredToken()) {
        try {
          const updated = await apiPinConversation(conversationId, pinned)
          setConversations((prev) => {
            const next = prev.map((c) => (c.id === conversationId ? { ...c, ...updated } : c))
            persistChats(next)
            return next
          })
          if (updated.other) rememberUser(updated.other)
          return
        } catch {
          /* local fallback */
        }
      }

      const current = conversations.find((c) => c.id === conversationId)
      const nextPinned = typeof pinned === 'boolean' ? pinned : !current?.pinned
      applyLocal(nextPinned)
    },
    [conversations, persistChats, rememberUser],
  )

  const directory = useMemo(() => {
    const map = new Map<string, UserProfile>()
    if (user && isDemoAccount(user.email)) {
      for (const u of USERS) map.set(u.id, u)
    }
    for (const u of knownUsers) map.set(u.id, u)
    return [...map.values()]
  }, [user, knownUsers])

  const value = useMemo<AppContextValue>(
    () => ({
      user,
      apiOnline,
      conversations,
      messages,
      likes,
      likeCounts,
      notifications,
      notificationPrefs,
      unreadNotifications,
      directory,
      login,
      register,
      logout,
      completeOnboarding,
      updateProfile,
      toggleActive,
      checkIn,
      checkOut,
      extendCheckIn,
      joinGym,
      leaveGym,
      setHomeGym,
      toggleLike,
      getLikesFor,
      getMyLikedUsers,
      lookupUsername,
      searchUsers,
      fetchUserById,
      rememberUser,
      sendMessage,
      startConversation,
      acceptRequest,
      markRead,
      togglePinConversation,
      refreshChats,
      refreshThread,
      updateNotificationPrefs,
      markNotificationRead,
      markAllNotificationsRead,
      tickets,
      adminDirectory,
      blockedEmails,
      canManageAdmins,
      canBlockUsers,
      canRemoveUsers,
      canViewUsers,
      canHandleTickets,
      canMessageUsers,
      refreshSupport,
      createFeedbackTicket,
      replyFeedbackTicket,
      adminReplyTicket,
      adminSetTicketStatus,
      adminSetUserAdmin,
      adminSetPermissions,
      adminSetCanGrant,
      adminBlockEmail,
      adminUnblockEmail,
      adminRemoveUser,
      adminMessageUser,
      refreshAdminDirectory,
      blockedUserIds,
      isBlocked,
      blockUser,
      unblockUser,
      reportUser,
    }),
    [
      user,
      apiOnline,
      conversations,
      messages,
      likes,
      likeCounts,
      notifications,
      notificationPrefs,
      unreadNotifications,
      directory,
      lookupUsername,
      searchUsers,
      fetchUserById,
      rememberUser,
      tickets,
      adminDirectory,
      blockedEmails,
      blockedUserIds,
      canManageAdmins,
      canBlockUsers,
      canRemoveUsers,
      canViewUsers,
      canHandleTickets,
      canMessageUsers,
      adminSetPermissions,
      adminRemoveUser,
      adminMessageUser,
      refreshAdminDirectory,
      login,
      register,
      logout,
      completeOnboarding,
      updateProfile,
      toggleActive,
      checkIn,
      checkOut,
      extendCheckIn,
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
      togglePinConversation,
      refreshChats,
      refreshThread,
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
      isBlocked,
      blockUser,
      unblockUser,
      reportUser,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
