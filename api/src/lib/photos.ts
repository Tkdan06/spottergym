import { AVATAR_MAX_CHARS, PHOTO_DATA_URL_MAX_CHARS } from './fieldLimits.js'
import { isMediaPath } from './mediaStore.js'

/** Allowed inline photo payloads for profile storage. */
const PHOTO_DATA_URL_RE = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=\s]+$/i

export function isAllowedPhotoDataUrl(value: string, maxChars = PHOTO_DATA_URL_MAX_CHARS) {
  if (!value || value.length > maxChars) return false
  return PHOTO_DATA_URL_RE.test(value)
}

export function isAllowedAvatarDataUrl(value: string) {
  return isAllowedPhotoDataUrl(value, AVATAR_MAX_CHARS)
}

/** Accept either legacy data-URL or stored /api/media/... path. */
export function isAllowedPhotoRef(value: string, maxChars = PHOTO_DATA_URL_MAX_CHARS) {
  if (!value) return false
  if (isMediaPath(value)) return true
  return isAllowedPhotoDataUrl(value, maxChars)
}

export function isAllowedAvatarRef(value: string) {
  if (!value) return true
  return isAllowedPhotoRef(value, AVATAR_MAX_CHARS)
}
