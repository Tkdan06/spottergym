const TECHNICAL =
  /internal server error|axioserror|fetch failed|failed to fetch|networkerror|econnrefused|enotfound|prisma|sqlstate|error \d{3}|stack:|at\s+\S+\s+\(/i

export function isTechnicalErrorMessage(message: string) {
  const t = message.trim()
  if (!t) return true
  return TECHNICAL.test(t)
}

export function fallbackForStatus(status: number) {
  if (status === 0) return 'Нет соединения. Проверь интернет и попробуй ещё раз'
  if (status === 401) return 'Нужно войти заново'
  if (status === 403) return 'Недостаточно прав'
  if (status === 404) return 'Не найдено'
  if (status === 413) return 'Слишком большой запрос'
  if (status === 429) return 'Слишком много попыток. Подожди минуту'
  if (status >= 500) return 'Не получилось выполнить запрос. Попробуй ещё раз'
  return 'Не получилось выполнить запрос. Попробуй ещё раз'
}

export function sanitizeApiErrorMessage(raw: string, status: number) {
  const t = raw.trim()
  if (!t || isTechnicalErrorMessage(t)) return fallbackForStatus(status)
  return t
}

export function userFacingError(err: unknown, fallback: string) {
  if (err && typeof err === 'object' && 'message' in err) {
    const message = String((err as { message?: unknown }).message || '').trim()
    if (message && !isTechnicalErrorMessage(message)) return message
  }
  return fallback
}
