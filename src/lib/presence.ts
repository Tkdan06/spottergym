import type { UserProfile } from '../types'

/** Default presence window after check-in */
export const CHECK_IN_TTL_MS = 3 * 60 * 60 * 1000
/** Soft warning before auto check-out */
export const CHECK_IN_WARN_MS = 30 * 60 * 1000
/** Each “still here” tap */
export const CHECK_IN_EXTEND_MS = 60 * 60 * 1000
export const CHECK_IN_MAX_EXTENDS = 2

/** Зал, в котором человек сейчас отметился */
export function getCheckedInGymId(user: Pick<UserProfile, 'isActive' | 'checkedInGymId' | 'homeGymId'>) {
  if (!user.isActive) return ''
  if (user.checkedInGymId) return user.checkedInGymId
  // Миграция старых профилей без checkedInGymId
  return user.homeGymId || ''
}

/** Live session length: `12:34` or `1:02:15` */
export function formatCheckInElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

export function getCheckInStartedAt(
  user: Pick<UserProfile, 'isActive' | 'checkedInAt' | 'lastSeenAt'>,
): string {
  if (!user.isActive) return ''
  if (user.checkedInAt) return user.checkedInAt
  return user.lastSeenAt || ''
}

export function getCheckInExpiresAt(
  user: Pick<UserProfile, 'isActive' | 'checkedInAt' | 'checkedInExpiresAt' | 'lastSeenAt'>,
): string {
  if (!user.isActive) return ''
  if (user.checkedInExpiresAt) return user.checkedInExpiresAt
  const started = getCheckInStartedAt(user)
  if (!started) return ''
  const t = Date.parse(started)
  if (!Number.isFinite(t)) return ''
  return new Date(t + CHECK_IN_TTL_MS).toISOString()
}

export function isCheckInExpired(
  user: Pick<UserProfile, 'isActive' | 'checkedInAt' | 'checkedInExpiresAt' | 'lastSeenAt'>,
  now = Date.now(),
) {
  if (!user.isActive) return false
  const expires = getCheckInExpiresAt(user)
  if (!expires) return false
  const t = Date.parse(expires)
  return Number.isFinite(t) && t <= now
}

export function isCheckInExpiringSoon(
  user: Pick<UserProfile, 'isActive' | 'checkedInAt' | 'checkedInExpiresAt' | 'lastSeenAt'>,
  now = Date.now(),
) {
  if (!user.isActive || isCheckInExpired(user, now)) return false
  const expires = getCheckInExpiresAt(user)
  if (!expires) return false
  const t = Date.parse(expires)
  if (!Number.isFinite(t)) return false
  const left = t - now
  return left > 0 && left <= CHECK_IN_WARN_MS
}

export function canExtendCheckInLocal(
  user: Pick<
    UserProfile,
    | 'isActive'
    | 'checkedInAt'
    | 'checkedInExpiresAt'
    | 'checkInExtendCount'
    | 'checkInCanExtend'
    | 'lastSeenAt'
  >,
  now = Date.now(),
) {
  if (typeof user.checkInCanExtend === 'boolean') return user.checkInCanExtend
  if (!user.isActive || isCheckInExpired(user, now)) return false
  return (user.checkInExtendCount ?? 0) < CHECK_IN_MAX_EXTENDS
}

export function buildCheckInSessionFields(checkedInAtIso?: string, extendCount = 0) {
  const checkedInAt = checkedInAtIso || new Date().toISOString()
  const started = Date.parse(checkedInAt)
  const base = Number.isFinite(started) ? started : Date.now()
  const expiresAt = new Date(base + CHECK_IN_TTL_MS + extendCount * CHECK_IN_EXTEND_MS).toISOString()
  return {
    checkedInAt,
    checkedInExpiresAt: expiresAt,
    checkInExtendCount: extendCount,
    checkInCanExtend: extendCount < CHECK_IN_MAX_EXTENDS,
  }
}

/** Виден как «в зале» именно в этом клубе */
export function isPresentInGym(
  user: Pick<UserProfile, 'isActive' | 'checkedInGymId' | 'homeGymId' | 'gymIds'>,
  gymId: string,
) {
  if (!gymId || !user.isActive) return false
  if (!user.gymIds?.includes(gymId)) return false
  return getCheckedInGymId(user) === gymId
}
