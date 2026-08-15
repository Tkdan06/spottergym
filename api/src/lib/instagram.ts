/** Instagram handle helpers — keep FE (`src/lib/instagram.ts`) in sync. */

export const INSTAGRAM_MAX = 30

/** Letters, digits, underscore, period — Instagram rules (1–30). */
const HANDLE_RE = /^[a-z0-9._]{1,30}$/

/**
 * Accepts @handle, bare handle, or profile URL; returns lowercase handle or ''.
 */
export function normalizeInstagram(raw: string): string {
  let s = raw.trim()
  if (!s) return ''

  s = s.replace(/^https?:\/\//i, '')
  s = s.replace(/^(www\.)?instagram\.com\//i, '')
  s = s.split(/[/?#]/)[0] || ''
  s = s.replace(/^@+/, '').toLowerCase()
  return s
}

export function isValidInstagram(handle: string): boolean {
  if (!handle) return true
  if (!HANDLE_RE.test(handle)) return false
  if (handle.startsWith('.') || handle.endsWith('.')) return false
  if (handle.includes('..')) return false
  return true
}

export function instagramProfileUrl(handle: string): string {
  const h = normalizeInstagram(handle)
  return h ? `https://www.instagram.com/${encodeURIComponent(h)}/` : ''
}
