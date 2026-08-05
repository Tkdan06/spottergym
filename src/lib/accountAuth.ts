import { normalizeEmail } from './adminConfig'
import { loadJson, saveJson } from './storage'

const authKey = (email: string) => `spotter.auth:${normalizeEmail(email)}`

/** Лёгкий хэш для клиентского хранения (не серверная криптография) */
export function hashPassword(password: string) {
  const raw = String(password ?? '')
  let h = 2166136261
  for (let i = 0; i < raw.length; i += 1) {
    h ^= raw.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return `v1:${(h >>> 0).toString(16)}:${raw.length}`
}

export function saveAccountPassword(email: string, password: string) {
  saveJson(authKey(email), { hash: hashPassword(password) })
}

export function hasAccountPassword(email: string) {
  const raw = loadJson<{ hash?: string } | null>(authKey(email), null)
  return Boolean(raw && typeof raw.hash === 'string' && raw.hash)
}

export function verifyAccountPassword(email: string, password: string) {
  const raw = loadJson<{ hash?: string } | null>(authKey(email), null)
  if (!raw || typeof raw.hash !== 'string' || !raw.hash) return null
  return raw.hash === hashPassword(password)
}

export function clearAccountPassword(email: string) {
  try {
    localStorage.removeItem(authKey(email))
  } catch {
    /* ignore */
  }
}
