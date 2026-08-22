import { prisma } from '../db.js'

/** Default presence window after check-in */
export const CHECK_IN_TTL_MS = 3 * 60 * 60 * 1000
/** Soft warning window before auto check-out */
export const CHECK_IN_WARN_MS = 30 * 60 * 1000
/** Each “still here” tap */
export const CHECK_IN_EXTEND_MS = 60 * 60 * 1000
export const CHECK_IN_MAX_EXTENDS = 2

export function defaultExpiresAt(from = new Date()) {
  return new Date(from.getTime() + CHECK_IN_TTL_MS)
}

export function resolveExpiresAt(checkedInAt: Date, expiresAt: Date | null | undefined) {
  if (expiresAt) return expiresAt
  return new Date(checkedInAt.getTime() + CHECK_IN_TTL_MS)
}

export function canExtendCheckIn(extendCount: number, expiresAt: Date, now = new Date()) {
  return extendCount < CHECK_IN_MAX_EXTENDS && expiresAt.getTime() > now.getTime()
}

let lastExpireAt = 0
const EXPIRE_MIN_INTERVAL_MS = 15_000

/** Close every open check-in past its expiry (legacy rows use checkedInAt + 3h). */
export async function expireStaleCheckIns(now = new Date()) {
  const ts = now.getTime()
  if (ts - lastExpireAt < EXPIRE_MIN_INTERVAL_MS) return 0
  lastExpireAt = ts
  const legacyCutoff = new Date(ts - CHECK_IN_TTL_MS)
  const result = await prisma.checkIn.updateMany({
    where: {
      checkedOutAt: null,
      OR: [
        { expiresAt: { lte: now } },
        { expiresAt: null, checkedInAt: { lte: legacyCutoff } },
      ],
    },
    data: { checkedOutAt: now },
  })
  return result.count
}
