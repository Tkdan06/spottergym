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
  name: string
  age: number
  gender: Gender
  bio: string
  photos: string[]
  avatar: string
  /** Все клубы, к которым привязан пользователь */
  gymIds: string[]
  /** Зал по умолчанию на «Этаже» */
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
  privacy: PrivacyMode
  lookingToMeet: boolean
  /** Сейчас в каком-то зале */
  isActive: boolean
  /** В каком зале сейчас (пусто, если не отметился) */
  checkedInGymId: string
  lastSeenAt: string
  verified?: boolean
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
}

export interface AppUser extends UserProfile {
  email: string
  onboardingDone: boolean
  isAdmin: boolean
  isMasterAdmin: boolean
  canGrantAdmin: boolean
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
  canGrantAdmin: boolean
}

export type NotificationType =
  | 'gym_new_member'
  | 'like'
  | 'chat_request'
  | 'checkin'
  | 'coach'
  | 'system'
  | 'admin'

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
}
