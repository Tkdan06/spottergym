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
import type { LikeCounts, LikesMap } from './likes'

/** Legacy JWT key — cleared; session is httpOnly cookie only. */
const TOKEN_KEY = 'spotter.api.token'
/** Non-secret marker that a cookie session may exist (gates polls; not auth). */
const SESSION_FLAG = 'spotter.api.session'

export function getApiBase() {
  const fromEnv = String(import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '')
  if (fromEnv) return fromEnv
  // Vite proxy → api :3001
  return '/api'
}

export function isApiConfigured() {
  return true
}

/** Truthy when we expect a cookie session (never stores the JWT). */
export function getStoredToken() {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
  try {
    return localStorage.getItem(SESSION_FLAG) || ''
  } catch {
    return ''
  }
}

export function setStoredToken(token: string | null) {
  try {
    localStorage.removeItem(TOKEN_KEY)
    if (token) localStorage.setItem(SESSION_FLAG, '1')
    else localStorage.removeItem(SESSION_FLAG)
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
    const raw = (data.error || '').trim()
    const message =
      !raw || /^not found$/i.test(raw)
        ? res.status === 404
          ? 'Сервис временно недоступен или ещё обновляется. Попробуй через минуту.'
          : `Ошибка ${res.status}`
        : raw
    throw new ApiError(message, res.status)
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
  const data = await request<{ user: AppUser }>('/auth/register', {
    method: 'POST',
    json: input,
  })
  setStoredToken('1')
  return data.user
}

export async function apiLogin(email: string, password: string) {
  const data = await request<{ user: AppUser }>('/auth/login', {
    method: 'POST',
    json: { email, password },
  })
  setStoredToken('1')
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

/** Bumps lastSeenAt so DAU counts any authenticated session, not only check-in. */
export async function apiHeartbeat() {
  return request<{ ok: true; lastSeenAt: string }>('/me/heartbeat', { method: 'POST' })
}

export async function apiPatchMe(patch: Partial<AppUser>) {
  const data = await request<{ user: AppUser }>('/me', {
    method: 'PATCH',
    json: patch,
  })
  return data.user
}

/** Soft-delete own account. Requires body confirm: "DELETE". */
export async function apiDeleteAccount() {
  return request<{ ok: true }>('/me/delete-account', {
    method: 'POST',
    json: { confirm: 'DELETE' },
  })
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

export type ActivityRange = 7 | 30 | 90

export type ActivityDay = {
  date: string
  minutes: number
  sessions: number
  gymIds: string[]
  intervals: { start: string; end: string }[]
}

export type ActivityDayHighlight = {
  date: string
  minutes: number
  sessions: number
}

export type ActivityStats = {
  range: ActivityRange
  timezone: 'Europe/Moscow'
  generatedAt: string
  totalMinutes: number
  totalSessions: number
  streakDays: number
  busiestDay: ActivityDayHighlight | null
  quietestDay: ActivityDayHighlight | null
  days: ActivityDay[]
}

export async function apiFetchMyActivity(range: ActivityRange = 30) {
  const data = await request<{ activity: ActivityStats }>(
    `/me/activity?range=${encodeURIComponent(String(range))}`,
  )
  return data.activity
}

/** Clears closed check-in history used for personal activity stats. */
export async function apiResetMyActivity() {
  return request<{ ok: true; deleted: number }>('/me/activity', { method: 'DELETE' })
}

export type WorkoutSetInput = { weightKg: number; reps: number }

export type WorkoutExercisePreview = {
  name: string
  sets: WorkoutSetInput[]
}

export type WorkoutExerciseDto = {
  id?: string
  name: string
  trackKey?: string
  sortOrder: number
  sets: (WorkoutSetInput & {
    id?: string
    setIndex: number
    weightDelta?: number | null
    repsDelta?: number | null
  })[]
}

export type WorkoutSessionSummary = {
  id: string
  title: string
  performedAt: string
  bodyWeightKg: number | null
  notes: string
  exerciseCount: number
  setCount: number
  exercises: WorkoutExercisePreview[]
  createdAt: string
  updatedAt: string
}

export type WorkoutSessionDetail = {
  id: string
  title: string
  performedAt: string
  bodyWeightKg: number | null
  notes: string
  exercises: WorkoutExerciseDto[]
  createdAt: string
  updatedAt: string
}

export type WorkoutSessionInput = {
  title: string
  performedAt: string
  bodyWeightKg?: number | null
  notes?: string
  exercises: { name: string; trackKey?: string; sets: WorkoutSetInput[] }[]
}

export type WorkoutProgressRange = 7 | 30 | 90

export type WorkoutProgress = {
  range: WorkoutProgressRange
  body: {
    points: { at: string; kg: number }[]
    latestKg: number | null
    deltaKg: number | null
  }
  exercises: { name: string; sessionCount: number }[]
  strength: {
    exercise: string | null
    points: { at: string; weightKg: number; reps: number }[]
    latestWeightKg: number | null
    deltaWeightKg: number | null
    deltaReps: number | null
  }
  highlight: {
    bodyLatestKg: number | null
    bodyDeltaKg: number | null
    liftName: string | null
    liftDeltaWeightKg: number | null
    liftDeltaReps: number | null
  }
}

export async function apiFetchWorkouts(opts?: {
  limit?: number
  before?: string
  beforeId?: string
}) {
  const sp = new URLSearchParams()
  if (opts?.limit) sp.set('limit', String(opts.limit))
  if (opts?.before) sp.set('before', opts.before)
  if (opts?.beforeId) sp.set('beforeId', opts.beforeId)
  const qs = sp.toString()
  const data = await request<{
    workouts: WorkoutSessionSummary[]
    hasMore?: boolean
    totalCount?: number
    atRetentionCap?: boolean
  }>(`/me/workouts${qs ? `?${qs}` : ''}`)
  return {
    workouts: data.workouts,
    hasMore: Boolean(data.hasMore),
    totalCount: typeof data.totalCount === 'number' ? data.totalCount : data.workouts.length,
    atRetentionCap: Boolean(data.atRetentionCap),
  }
}

export async function apiFetchWorkoutProgress(range: WorkoutProgressRange, exercise?: string) {
  const q = new URLSearchParams({ range: String(range) })
  if (exercise) q.set('exercise', exercise)
  const data = await request<{ progress: WorkoutProgress }>(`/me/workouts/progress?${q}`)
  return data.progress
}

export async function apiFetchWorkout(id: string) {
  const data = await request<{ workout: WorkoutSessionDetail }>(
    `/me/workouts/${encodeURIComponent(id)}`,
  )
  return data.workout
}

export async function apiCreateWorkout(body: WorkoutSessionInput) {
  const data = await request<{ workout: WorkoutSessionDetail }>('/me/workouts', {
    method: 'POST',
    json: body,
  })
  return data.workout
}

export async function apiUpdateWorkout(id: string, body: WorkoutSessionInput) {
  const data = await request<{ workout: WorkoutSessionDetail }>(
    `/me/workouts/${encodeURIComponent(id)}`,
    { method: 'PATCH', json: body },
  )
  return data.workout
}

export async function apiDeleteWorkout(id: string) {
  return request<{ ok: true }>(`/me/workouts/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export type CoachSplit = {
  upper: number
  lower: number
  push: number
  pull: number
  unknown: number
}

export type CoachLetter = {
  headline: string
  weekVerdict: { tone: 'hit' | 'almost' | 'missed'; text: string }
  wins: { title: string; text: string }[]
  nextSession: { title: string; focus: string; steps: string[] }
  distance30: { text: string; change: string } | null
  distance90: { text: string } | null
}

export type WorkoutCoachState = {
  status: 'locked' | 'ready' | 'cached' | 'offline'
  configured: boolean
  eligible: boolean
  canGenerate: boolean
  demo?: boolean
  sessionsIn21d: number
  sessionsNeeded: number
  periodStart: string
  periodEnd: string
  periodLabel: string
  nextAt: string
  facts: {
    weekSessions: number
    weekPrevSessions: number
    weekSplit: CoachSplit
    verdictHint: 'hit' | 'almost' | 'missed' | null
    d30Ready: boolean
    d90Ready: boolean
  }
  letter: CoachLetter | null
}

export async function apiFetchWorkoutCoach() {
  const data = await request<{ coach: WorkoutCoachState }>('/me/workouts/coach')
  return data.coach
}

export async function apiGenerateWorkoutCoach() {
  const data = await request<{ coach: WorkoutCoachState }>('/me/workouts/coach/generate', {
    method: 'POST',
  })
  return data.coach
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

export async function apiFetchUser(
  userId: string,
  opts?: { revealAnonymous?: boolean },
) {
  const sp = opts?.revealAnonymous ? '?reveal=1' : ''
  const data = await request<{ user: AppUser }>(
    `/users/${encodeURIComponent(userId)}${sp}`,
  )
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
  checkedInTodayAt?: string
  checkedInTodayGymId?: string
}

export async function apiAdminFetchUsers(opts?: {
  q?: string
  activity?: 'seenToday' | 'checkedInToday'
}) {
  const sp = new URLSearchParams()
  if (opts?.q?.trim()) sp.set('q', opts.q.trim())
  if (opts?.activity) sp.set('activity', opts.activity)
  const qs = sp.toString()
  const data = await request<{ users: AdminUserRow[] }>(
    `/admin/users${qs ? `?${qs}` : ''}`,
  )
  return data.users
}

export async function apiAdminFetchAnalytics() {
  const data = await request<{ analytics: AdminAnalytics }>('/admin/analytics')
  return data.analytics
}

export type PasswordResetAnalytics = {
  summary: {
    last24h: number
    last7d: number
    last30d: number
    completed7d: number
    uniqueEmails7d: number
    noAccount7d: number
  }
  status7d: Record<string, number>
  topEmails: {
    email: string
    count: number
    lastAt: string | null
    userId: string | null
    name: string | null
    username: string | null
  }[]
  recent: {
    id: string
    email: string
    userId: string | null
    name: string | null
    username: string | null
    ip: string
    status: string
    createdAt: string
  }[]
}

export async function apiAdminFetchPasswordResets() {
  return request<PasswordResetAnalytics>('/admin/password-resets')
}

export type LandingFunnelWindow = {
  views: number
  uniqueVisitors: number
  scroll50: number
  scroll50Unique: number
  scroll90: number
  scroll90Unique: number
  ctaRegister: number
  ctaRegisterUnique: number
  ctaLogin: number
  ctaByPlacement: Record<string, number>
  registerView: number
  registerViewUnique: number
  registerSuccess: number
  registerSuccessUnique: number
  viewToCtaPct: number | null
  ctaToRegisterPct: number | null
  viewToRegisterPct: number | null
}

export type LandingAnalytics = {
  generatedAt: string
  last24h: LandingFunnelWindow
  last7d: LandingFunnelWindow
  last30d: LandingFunnelWindow
  campaigns7d: {
    campaign: string
    views: number
    ctaRegister: number
    registerSuccess: number
  }[]
  recent: {
    id: string
    name: string
    placement: string
    utmSource: string
    utmCampaign: string
    utmContent: string
    fromParam: string
    visitorId: string
    createdAt: string
  }[]
}

export async function apiAdminFetchLanding() {
  return request<LandingAnalytics>('/admin/landing')
}

export type ReferralUserBrief = {
  id: string
  name: string
  username: string | null
  email: string
  city: string
  deleted: boolean
  createdAt: string | null
}

export type ReferralAnalytics = {
  generatedAt: string
  summary: {
    totalInvites: number
    creditedInvites: number
    pendingInvites: number
    uniqueInviters: number
    invites24h: number
    invites7d: number
    invites30d: number
    credited7d: number
    activeUsers: number
    referredUsers: number
    organicUsers: number
    referredSharePct: number | null
  }
  leaders: Array<
    ReferralUserBrief & {
      inviteCount: number
      creditedCount: number
      pendingCount: number
      tier: number
      tierTitle: string
      lastInviteAt: string | null
    }
  >
  recent: Array<{
    id: string
    createdAt: string
    credited: boolean
    inviter: ReferralUserBrief
    invitee: ReferralUserBrief & { onboardingDone: boolean }
  }>
}

export async function apiAdminFetchReferrals() {
  return request<ReferralAnalytics>('/admin/referrals')
}

export type InviteCirclePayload = {
  creditedCount: number
  pendingCount: number
  tier: number
  title: string
  badge: string
  chrome: 'none' | 'soft' | 'strong' | 'hero'
  nextTitle: string | null
  nextMin: number | null
  toNext: number | null
  friends: Array<{
    id: string
    name: string
    username: string | null
    city: string
    createdAt: string
    creditedAt: string
  }>
  pending: Array<{
    id: string
    name: string
    username: string | null
    city: string
    createdAt: string
    creditedAt: string
  }>
}

export async function apiFetchMyReferrals() {
  const data = await request<{ circle: InviteCirclePayload }>('/me/referrals')
  return data.circle
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

export async function apiAdminFetchBlockedIps() {
  const data = await request<{ ips: string[] }>('/admin/blocked-ips')
  return data.ips
}

export async function apiAdminBlockIp(ip: string, reason?: string) {
  const data = await request<{ ips: string[] }>('/admin/blocked-ips', {
    method: 'POST',
    json: { ip, reason },
  })
  return data.ips
}

export async function apiAdminUnblockIp(ip: string) {
  const data = await request<{ ips: string[] }>(
    `/admin/blocked-ips/${encodeURIComponent(ip)}`,
    { method: 'DELETE' },
  )
  return data.ips
}

export async function apiAdminEmergencyShutdown(password: string) {
  return request<{ ok: boolean; emergency: boolean; message: string }>(
    '/admin/emergency-shutdown',
    {
      method: 'POST',
      json: { password, confirm: 'SHUTDOWN' },
    },
  )
}

export async function apiAdminEmergencyRecover(email: string, password: string) {
  return request<{ ok: boolean; emergency: boolean; message: string }>(
    '/admin/emergency-recover',
    {
      method: 'POST',
      json: { email, password },
    },
  )
}

export async function apiFetchHealth() {
  const res = await fetch(`${getApiBase()}/health`, {
    credentials: 'include',
    cache: 'no-store',
  })
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    emergency?: boolean
    service?: string
  }
  return {
    ok: Boolean(data.ok),
    emergency: Boolean(data.emergency),
    status: res.status,
  }
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
  const data = await request<{ likes: LikesMap; counts?: LikeCounts; actors?: UserProfile[] }>(
    '/likes',
  )
  return {
    likes: data.likes,
    counts: data.counts || {},
    actors: Array.isArray(data.actors) ? data.actors : [],
  }
}

export async function apiToggleLike(userId: string) {
  const data = await request<{
    liked: boolean
    likes: LikesMap
    counts?: LikeCounts
    actors?: UserProfile[]
  }>(`/likes/${encodeURIComponent(userId)}/toggle`, { method: 'POST' })
  return {
    liked: data.liked,
    likes: data.likes,
    counts: data.counts || {},
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

export type AdminBroadcast = {
  id: string
  title: string
  body: string
  createdAt: string
  finishedAt?: string | null
  createdById: string
  createdByName: string
  status: 'pending' | 'sending' | 'sent' | 'failed'
  recipientCount: number
  deliveredCount: number
  failedCount: number
  readCount: number
  unreadCount: number
}

export async function apiAdminFetchBroadcasts() {
  const data = await request<{ broadcasts: AdminBroadcast[] }>('/admin/broadcasts')
  return data.broadcasts
}

export async function apiAdminCreateBroadcast(title: string, body: string) {
  const data = await request<{ broadcast: AdminBroadcast }>('/admin/broadcasts', {
    method: 'POST',
    json: { title, body },
  })
  return data.broadcast
}

export type ApiConversation = Conversation & { other?: UserProfile }

export async function apiFetchConversations(opts?: { before?: string; limit?: number }) {
  const sp = new URLSearchParams()
  if (opts?.before) sp.set('before', opts.before)
  if (opts?.limit) sp.set('limit', String(opts.limit))
  const qs = sp.toString()
  const data = await request<{ conversations: ApiConversation[]; hasMore?: boolean }>(
    `/conversations${qs ? `?${qs}` : ''}`,
  )
  return {
    conversations: data.conversations,
    hasMore: Boolean(data.hasMore),
  }
}

export async function apiStartConversation(userId: string, message?: string) {
  const data = await request<{ conversation: ApiConversation }>('/conversations', {
    method: 'POST',
    json: { userId, message: message || undefined },
  })
  return data.conversation
}

export async function apiFetchMessages(
  conversationId: string,
  opts?: { before?: string; limit?: number },
) {
  const sp = new URLSearchParams()
  if (opts?.before) sp.set('before', opts.before)
  if (opts?.limit) sp.set('limit', String(opts.limit))
  const qs = sp.toString()
  const data = await request<{
    conversation: ApiConversation
    messages: Message[]
    hasMore?: boolean
  }>(
    `/conversations/${encodeURIComponent(conversationId)}/messages${qs ? `?${qs}` : ''}`,
  )
  return {
    conversation: data.conversation,
    messages: data.messages,
    hasMore: Boolean(data.hasMore),
  }
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

/** Hide chat from my inbox only (Telegram-style delete for me) */
export async function apiDeleteConversation(conversationId: string) {
  await request<{ ok: true; id: string }>(
    `/conversations/${encodeURIComponent(conversationId)}`,
    { method: 'DELETE' },
  )
}
