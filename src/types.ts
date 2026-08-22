export type Intent = 'dating' | 'buddy' | 'both'
export type PrivacyMode = 'open' | 'anonymous'
export type Gender = 'female' | 'male'
/** Уровень в зале — без «лет стажа», коротко и по ощущению */
export type ExperienceLevel = 'newbie' | 'confident' | 'experienced' | 'pro'

export interface VisitSlot {
  day: string
  from: string
  to: string
}

export interface Gym {
  id: string
  name: string
  network: 'DDX Fitness' | 'Spirit. Fitness' | 'World Class' | string
  city: string
  district: string
  address: string
  membersCount: number
  activeNow: number
  image: string
  lat?: number | null
  lng?: number | null
}

export interface UserProfile {
  id: string
  /** Public findable handle without @ */
  username?: string
  /** Optional Instagram handle without @ */
  instagram?: string
  name: string
  age: number
  gender: Gender
  bio: string
  photos: string[]
  avatar: string
  /** Все клубы, к которым привязан пользователь */
  gymIds: string[]
  /** Зал по умолчанию на главной вкладке «Зал» */
  homeGymId: string
  city: string
  intent: Intent
  /** Уровень: новичок → уверенный → опытный → профи */
  experienceLevel: ExperienceLevel
  interests: string[]
  sports: string[]
  /** Тренер в зале — видно на карточке */
  isCoach: boolean
  /** Направления, в которых тренирует (из sports / каталога) */
  coachSports: string[]
  visitSlots: VisitSlot[]
  /**
   * Перерыв / отпуск: YYYY-MM-DD — до этой даты (включительно) не в зале.
   * Пусто / null — обычный режим.
   */
  breakUntil?: string | null
  privacy: PrivacyMode
  lookingToMeet: boolean
  /** Total likes received — set on gym floor payload for ranking */
  likeCount?: number
  /** Сейчас в каком-то зале */
  isActive: boolean
  /** В каком зале сейчас (пусто, если не отметился) */
  checkedInGymId: string
  /** Когда отметился в текущем зале (ISO); пусто если не в зале */
  checkedInAt?: string
  /** Когда авто-снимем статус (ISO) */
  checkedInExpiresAt?: string
  /** Сколько раз уже продлевал (+1ч), макс. 2 */
  checkInExtendCount?: number
  /** Можно ли нажать «Ещё здесь» */
  checkInCanExtend?: boolean
  lastSeenAt: string
  /** Soft-deleted account — chats kept, show «Удалённый пользователь» */
  isDeleted?: boolean
  verified?: boolean
  /** Credited referrals (onboarded friends) */
  referralCreditedCount?: number
  /** 0–4 ladder tier */
  referralTier?: number
  referralTitle?: string
  referralBadge?: string
  referralChrome?: 'none' | 'soft' | 'strong' | 'hero'
}

/** Как в Telegram: часы → ✓ → ✓✓ → ✓✓ синие */
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read'

export interface Message {
  id: string
  conversationId: string
  senderId: string
  text: string
  createdAt: string
  status: MessageStatus
  /** @deprecated используй status; оставлено для миграции localStorage */
  read?: boolean
}

export interface Conversation {
  id: string
  participantIds: [string, string]
  lastMessage: string
  updatedAt: string
  unreadCount: number
  requestStatus: 'accepted' | 'pending' | 'incoming'
  /** Pinned for the current user only */
  pinned?: boolean
  pinnedAt?: string | null
  /** Other participant when loaded from API / cache */
  other?: UserProfile
}

/** Гранулярные права админа (главный админ всегда имеет все) */
export type AdminPermissionKey =
  | 'tickets'
  | 'messageUsers'
  | 'viewUsers'
  | 'blockUsers'
  | 'removeUsers'
  | 'manageAdmins'

export interface AdminPermissions {
  tickets: boolean
  messageUsers: boolean
  viewUsers: boolean
  blockUsers: boolean
  removeUsers: boolean
  manageAdmins: boolean
}

export interface AppUser extends UserProfile {
  email: string
  onboardingDone: boolean
  /** ISO — когда аккаунт создан (регистрация) */
  registeredAt: string
  isAdmin: boolean
  isMasterAdmin: boolean
  /** @deprecated используй adminPermissions.manageAdmins */
  canGrantAdmin: boolean
  adminPermissions: AdminPermissions
}

export type FeedbackCategoryId =
  | 'technical'
  | 'question'
  | 'suggestion'
  | 'safety'
  | 'other'

export type FeedbackTicketStatus = 'new' | 'open' | 'in_progress' | 'resolved' | 'closed'
export type TicketTab = 'incoming' | 'in_progress' | 'closed'

export interface FeedbackMessage {
  id: string
  senderType: 'user' | 'admin'
  senderId: string
  senderName: string
  text: string
  createdAt: string
}

export interface FeedbackTicket {
  id: string
  userId: string
  userName: string
  userEmail: string
  category: FeedbackCategoryId
  subject: string
  status: FeedbackTicketStatus
  createdAt: string
  updatedAt: string
  assigneeId: string
  messages: FeedbackMessage[]
}

export interface AdminDirectoryUser {
  id: string
  name: string
  email: string
  isAdmin: boolean
  isMasterAdmin: boolean
  /** @deprecated → adminPermissions.manageAdmins */
  canGrantAdmin: boolean
  adminPermissions?: AdminPermissions
  /** Снимок профиля для админки (обновляется при логине/сохранении) */
  age?: number
  gender?: Gender
  city?: string
  homeGymId?: string
  gymIds?: string[]
  intent?: Intent
  experienceLevel?: ExperienceLevel
  isCoach?: boolean
  onboardingDone?: boolean
  isActive?: boolean
  checkedInGymId?: string
  photosCount?: number
  /** Примерный размер фото в байтах (data URL) */
  photosBytes?: number
  registeredAt?: string
  lastSeenAt?: string
  /** First check-in of today (MSK), if any */
  checkedInTodayAt?: string
  checkedInTodayGymId?: string
  /** IP at registration (admin only) */
  signupIp?: string
  /** How many non-deleted accounts share this signup IP (admin only) */
  signupIpCount?: number
  /** Сид из mock — не «живой» зарегистрированный пользователь */
  isDemoSeed?: boolean
}

export type NotificationType =
  | 'gym_new_member'
  | 'like'
  | 'chat_request'
  | 'checkin'
  | 'coach'
  | 'system'
  | 'admin'
  | 'workout_reminder'
  | 'new_registration'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  body: string
  createdAt: string
  read: boolean
  href?: string
  gymId?: string
  actorId?: string
}

export interface NotificationPrefs {
  /** Главный рубильник */
  enabled: boolean
  gymNewMembers: boolean
  likes: boolean
  chatRequests: boolean
  checkins: boolean
  coaches: boolean
  system: boolean
  /** За час до слота тренировки */
  workoutReminders: boolean
  /** Только для админов: пуш о новых регистрациях */
  newRegistrations: boolean
}
