export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function isQuotaExceededError(err: unknown) {
  if (!err || typeof err !== 'object') return false
  const e = err as { name?: string; code?: number | string; message?: string }
  if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') return true
  if (e.code === 22 || e.code === 1014) return true
  const msg = String(e.message || '').toLowerCase()
  return msg.includes('quota') || msg.includes('квот')
}

/** Friendly message when browser storage is full (often after photo data-URLs). */
export function quotaExceededMessage() {
  return 'Не хватает места в памяти браузера для сохранения. Фото уже уходит на сервер — обнови страницу через пару секунд.'
}

export function saveJson<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (err) {
    if (isQuotaExceededError(err)) {
      const wrapped = new Error(quotaExceededMessage())
      wrapped.name = 'QuotaExceededError'
      throw wrapped
    }
    throw err
  }
}
