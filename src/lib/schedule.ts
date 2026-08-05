/** Локальная дата YYYY-MM-DD */
export function todayISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function normalizeBreakUntil(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  return v
}

/** Активный перерыв: дата окончания сегодня или позже */
export function isOnBreak(breakUntil?: string | null) {
  const until = normalizeBreakUntil(breakUntil)
  if (!until) return false
  return until >= todayISO()
}

/** Если перерыв истёк — вернуть null */
export function activeBreakUntil(breakUntil?: string | null): string | null {
  const until = normalizeBreakUntil(breakUntil)
  if (!until) return null
  return until >= todayISO() ? until : null
}

export function formatBreakUntil(breakUntil: string) {
  const until = normalizeBreakUntil(breakUntil)
  if (!until) return ''
  const [y, m, d] = until.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

export function breakLabel(breakUntil?: string | null) {
  const until = activeBreakUntil(breakUntil)
  if (!until) return ''
  return `Перерыв до ${formatBreakUntil(until)}`
}
