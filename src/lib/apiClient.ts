import type {
  AppUser,
  Conversation,
  FeedbackCategoryId,
  FeedbackTicket,
  Gender,
  Gym,
  Message,
  NotificationPrefs,
  AppNotification,
  UserProfile,
} from '../types'
import type { AdminAnalytics } from './adminAnalytics'
import type { LikesMap } from './likes'

const TOKEN_KEY = 'spotter.api.token'

export function getApiBase() {
  const fromEnv = String(import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '')
  if (fromEnv) return fromEnv
  // Vite proxy → api :3001
  return '/api'
}

export function isApiConfigured() {
  return true
}

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function setStoredToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const headers = new Headers(options.headers || {})
  if (options.json !== undefined) {
    headers.set('Content-Type', 'application/json')
  }
  // Use a custom header so nginx Basic Auth can keep Authorization: Basic
  const token = getStoredToken()
  if (token) headers.set('X-Spotter-Token', token)

  const res = await fetch(`${getApiBase()}${path}`, {
    ...options,
    headers,
    credentials: 'include',
    body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
  })

  const data = (await res.json().catch(() => ({}))) as {
    error?: string
    user?: AppUser
    token?: string
    gyms?: Gym[]
    gym?: Gym
    people?: AppUser[]
    ok?: boolean
  }

  if (!res.ok) {
    throw new ApiError(data.error || `Ошибка ${res.status}`, res.status)
  }
  return data as T
}

export async function apiHealth() {
  try {
    const res = await fetch(`${getApiBase()}/health`, { credentials: 'include' })
    return res.ok
  } catch {
    return false
  }
}

export async function apiRegister(input: {
  name: string
  email: string
  password: string
  gender: Gender
  inviteFrom?: string
}) {
  const data = await request<{ user: AppUser; token: string }>('/auth/register', {
    method: 'POST',
    json: input,
  })
  if (data.token) setStoredToken(data.token)
  return data.user
}

export async function apiLogin(email: string, password: string) {
  const data = await request<{ user: AppUser; token: string }>('/auth/login', {
    method: 'POST',
    json: { email, password },
  })
  if (data.token) setStoredToken(data.token)
  return data.user
}

export async function apiLogout() {
  try {
    await request('/auth/logout', { method: 'POST' })
  } finally {
    setStoredToken(null)
  }
}

export async function apiChangePassword(currentPassword: string, newPassword: string) {
  await request<{ ok: boolean }>('/auth/change-password', {
    method: 'POST',
    json: { currentPassword, newPassword },
  })
}

export async function apiForgotPassword(email: string) {
  return request<{ ok: boolean; message?: string }>('/auth/forgot-password', {
    method: 'POST',
    json: { email },
  })
}

export async function apiResetPassword(token: string, newPassword: string) {
  return request<{ ok: boolean; message?: string }>('/auth/reset-password', {
    method: 'POST',
    json: { token, newPassword },
  })
}

export async function apiMe() {
  const data = await request<{ user: AppUser }>('/auth/me')
  return data.user
}

export async function apiPatchMe(patch: Partial<AppUser>) {
  const data = await request<{ user: AppUser }>('/me', {
    method: 'PATCH',
    json: patch,
  })
  return data.user
}

export async function apiCheckIn(gymId: string) {
  const data = await request<{ user: AppUser }>('/me/check-in', {
    method: 'POST',
    json: { gymId },
  })
  return data.user
}

export async function apiCheckOut() {
  const data = await request<{ user: AppUser }>('/me/check-out', { method: 'POST' })
  return data.user
}

export async function apiExtendCheckIn() {
  const data = await request<{ user: AppUser }>('/me/check-in/extend', { method: 'POST' })
  return data.user
}

export async function apiJoinGym(gymId: string, makeHome = false) {
  const data = await request<{ user: AppUser }>(
    `/me/gyms/${encodeURIComponent(gymId)}${makeHome ? '?home=1' : ''}`,
    { method: 'POST' },
  )
  return data.user
}

export async function apiLeaveGym(gymId: string) {
  const data = await request<{ user: AppUser }>(
    `/me/gyms/${encodeURIComponent(gymId)}`,
    { method: 'DELETE' },
  )
  return data.user
}

export async function apiFetchGyms(params?: {
  city?: string
  network?: string
  q?: string
  /** Поиск клубов вне excludeCity (пустой локальный результат) */
  elsewhere?: boolean
  excludeCity?: string
}) {
  const sp = new URLSearchParams()
  if (params?.city) sp.set('city', params.city)
  if (params?.network) sp.set('network', params.network)
  if (params?.q) sp.set('q', params.q)
  if (params?.elsewhere) sp.set('elsewhere', '1')
  if (params?.excludeCity) sp.set('excludeCity', params.excludeCity)
  const qs = sp.toString()
  const data = await request<{ gyms: Gym[] }>(`/gyms${qs ? `?${qs}` : ''}`)
  return data.gyms
}

export async function apiFetchGym(gymId: string) {
  const data = await request<{ gym: Gym }>(`/gyms/${encodeURIComponent(gymId)}`)
  return data.gym
}

export async function apiFetchGymPeople(gymId: string) {
  const data = await request<{ people: AppUser[] }>(
    `/gyms/${encodeURIComponent(gymId)}/people`,
  )
  return data.people
}

export async function apiLookupUsername(username: string) {
  const data = await request<{ user: AppUser }>(
    `/users/by-username/${encodeURIComponent(username)}`,
  )
  return data.user
}

export async function apiSearchUsers(q: string) {
  const data = await request<{ users: AppUser[] }>(
    `/users/search?q=${encodeURIComponent(q.trim())}`,
  )
  return data.users
}

export async function apiFetchUser(userId: string) {
  const data = await request<{ user: AppUser }>(`/users/${encodeURIComponent(userId)}`)
  return data.user
}

export async function apiFetchBlocks() {
  const data = await request<{ blockedUserIds: string[] }>('/blocks')
  return data.blockedUserIds
}

export async function apiBlockUser(userId: string) {
  const data = await request<{ blockedUserIds: string[] }>(
    `/blocks/${encodeURIComponent(userId)}`,
    { method: 'POST' },
  )
  return data.blockedUserIds
}

export async function apiUnblockUser(userId: string) {
  const data = await request<{ blockedUserIds: string[] }>(
    `/blocks/${encodeURIComponent(userId)}`,
    { method: 'DELETE' },
  )
  return data.blockedUserIds
}

export type AdminUserRow = AppUser & {
  photosCount?: number
  photosBytes?: number
}

export async function apiAdminFetchUsers(q?: string) {
  const sp = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''
  const data = await request<{ users: AdminUserRow[] }>(`/admin/users${sp}`)
  return data.users
}

export async function apiAdminFetchAnalytics() {
  const data = await request<{ analytics: AdminAnalytics }>('/admin/analytics')
  return data.analytics
}

export async function apiAdminFetchBlockedEmails() {
  const data = await request<{ emails: string[] }>('/admin/blocked-emails')
  return data.emails
}

export async function apiAdminBlockEmail(email: string, reason?: string) {
  const data = await request<{ emails: string[] }>('/admin/blocked-emails', {
    method: 'POST',
    json: { email, reason },
  })
  return data.emails
}

export async function apiAdminUnblockEmail(email: string) {
  const data = await request<{ emails: string[] }>(
    `/admin/blocked-emails/${encodeURIComponent(email)}`,
    { method: 'DELETE' },
  )
  return data.emails
}

export async function apiAdminDeleteUser(userId: string, options?: { alsoBlock?: boolean }) {
  const sp = options?.alsoBlock ? '?alsoBlock=1' : ''
  await request<{ ok: boolean }>(
    `/admin/users/${encodeURIComponent(userId)}${sp}`,
    { method: 'DELETE' },
  )
}

export async function apiAdminPatchUserAdmin(
  userId: string,
  body: { isAdmin: boolean; permissions?: AppUser['adminPermissions'] },
) {
  const data = await request<{ user: AppUser }>(
    `/admin/users/${encodeURIComponent(userId)}/admin`,
    { method: 'PATCH', json: body },
  )
  return data.user
}

export async function apiPatchTicketStatus(
  ticketId: string,
  status: FeedbackTicket['status'],
) {
  const data = await request<{ ticket: FeedbackTicket }>(
    `/tickets/${encodeURIComponent(ticketId)}/status`,
    { method: 'PATCH', json: { status } },
  )
  return data.ticket
}

export async function apiFetchLikes() {
  const data = await request<{ likes: LikesMap; actors?: UserProfile[] }>('/likes')
  return {
    likes: data.likes,
    actors: Array.isArray(data.actors) ? data.actors : [],
  }
}

export async function apiToggleLike(userId: string) {
  const data = await request<{ liked: boolean; likes: LikesMap; actors?: UserProfile[] }>(
    `/likes/${encodeURIComponent(userId)}/toggle`,
    { method: 'POST' },
  )
  return {
    liked: data.liked,
    likes: data.likes,
    actors: Array.isArray(data.actors) ? data.actors : [],
  }
}

export async function apiFetchNotifications() {
  const data = await request<{ notifications: AppNotification[] }>('/notifications')
  return data.notifications
}

export async function apiMarkNotificationRead(id: string) {
  await request(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' })
}

export async function apiMarkAllNotificationsRead() {
  await request('/notifications/read-all', { method: 'POST' })
}

export async function apiFetchNotificationPrefs() {
  const data = await request<{ prefs: NotificationPrefs }>('/notifications/prefs')
  return data.prefs
}

export async function apiPatchNotificationPrefs(prefs: Partial<NotificationPrefs>) {
  const data = await request<{ prefs: NotificationPrefs }>('/notifications/prefs', {
    method: 'PATCH',
    json: prefs,
  })
  return data.prefs
}

export async function apiFetchTickets() {
  const data = await request<{ tickets: FeedbackTicket[] }>('/tickets')
  return data.tickets
}

export async function apiCreateTicket(category: FeedbackCategoryId, message: string) {
  const data = await request<{ ticket: FeedbackTicket }>('/tickets', {
    method: 'POST',
    json: { category, message },
  })
  return data.ticket
}

export async function apiReplyTicket(
  ticketId: string,
  message: string,
  closeAs?: 'resolved' | 'closed',
) {
  const data = await request<{ ticket: FeedbackTicket }>(
    `/tickets/${encodeURIComponent(ticketId)}/reply`,
    { method: 'POST', json: { message, closeAs } },
  )
  return data.ticket
}

export async function apiAdminOutboundTicket(userId: string, message: string) {
  const data = await request<{ ticket: FeedbackTicket }>('/tickets/outbound', {
    method: 'POST',
    json: { userId, message },
  })
  return data.ticket
}

export type ApiConversation = Conversation & { other?: UserProfile }

export async function apiFetchConversations() {
  const data = await request<{ conversations: ApiConversation[] }>('/conversations')
  return data.conversations
}

export async function apiStartConversation(userId: string, message?: string) {
  const data = await request<{ conversation: ApiConversation }>('/conversations', {
    method: 'POST',
    json: { userId, message: message || undefined },
  })
  return data.conversation
}

export async function apiFetchMessages(conversationId: string) {
  const data = await request<{
    conversation: ApiConversation
    messages: Message[]
  }>(`/conversations/${encodeURIComponent(conversationId)}/messages`)
  return data
}

export async function apiSendMessage(conversationId: string, text: string) {
  const data = await request<{ message: Message }>(
    `/conversations/${encodeURIComponent(conversationId)}/messages`,
    { method: 'POST', json: { text } },
  )
  return data.message
}

export async function apiAcceptConversation(conversationId: string) {
  const data = await request<{ conversation: ApiConversation }>(
    `/conversations/${encodeURIComponent(conversationId)}/accept`,
    { method: 'POST' },
  )
  return data.conversation
}

export async function apiMarkConversationRead(conversationId: string) {
  await request(`/conversations/${encodeURIComponent(conversationId)}/read`, {
    method: 'POST',
  })
}

export async function apiPinConversation(conversationId: string, pinned?: boolean) {
  const data = await request<{ conversation: ApiConversation }>(
    `/conversations/${encodeURIComponent(conversationId)}/pin`,
    { method: 'POST', json: pinned === undefined ? {} : { pinned } },
  )
  return data.conversation
}
