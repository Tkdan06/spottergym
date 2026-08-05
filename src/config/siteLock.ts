/**
 * Закрытый доступ к сайту (soft gate для друзей / тестёров).
 *
 * Вкл/выкл без смены пароля: public/site-lock.json → "enabled": true|false
 * Логин/пароль: переменные VITE_SITE_LOCK_* или дефолты ниже.
 *
 * Важно: это SPA — пароль попадает в бандл. Это не банковская защита,
 * а «дверь для своих», чтобы сайт не был открыт всем подряд.
 */

export type SiteLockRemote = {
  enabled: boolean
  hint?: string
}

const STORAGE_KEY = 'spotter.site-lock.ok'

export function siteLockCredentials() {
  return {
    user: String(import.meta.env.VITE_SITE_LOCK_USER || 'spotter').trim(),
    password: String(import.meta.env.VITE_SITE_LOCK_PASSWORD || 'floor-test-2026').trim(),
  }
}

/** Принудительный офф через env (перекрывает site-lock.json) */
export function siteLockEnvForceOff() {
  const v = import.meta.env.VITE_SITE_LOCK_ENABLED
  if (v === undefined || v === '') return false
  return v === 'false' || v === '0'
}

/** Принудительный он через env */
export function siteLockEnvForceOn() {
  const v = import.meta.env.VITE_SITE_LOCK_ENABLED
  if (v === undefined || v === '') return false
  return v === 'true' || v === '1'
}

export async function fetchSiteLockRemote(): Promise<SiteLockRemote> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}site-lock.json`, {
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(String(res.status))
    const data = (await res.json()) as Partial<SiteLockRemote>
    return {
      enabled: Boolean(data.enabled),
      hint: typeof data.hint === 'string' ? data.hint : undefined,
    }
  } catch {
    // если файла нет — по умолчанию закрыто (безопаснее для теста)
    return { enabled: true, hint: 'Закрытый тест Spotter' }
  }
}

export function isSiteLockUnlocked() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function setSiteLockUnlocked(ok: boolean) {
  try {
    if (ok) sessionStorage.setItem(STORAGE_KEY, '1')
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function checkSiteLockCredentials(user: string, password: string) {
  const creds = siteLockCredentials()
  return user.trim() === creds.user && password === creds.password
}
