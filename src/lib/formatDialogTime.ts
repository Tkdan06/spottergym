/** Calendar day at local midnight */
function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Monday 00:00 of the week containing `d` (Telegram / EU week) */
function startOfWeekMonday(d: Date) {
  const day = startOfDay(d)
  const wd = day.getDay() // 0 = Sun … 6 = Sat
  const offset = wd === 0 ? -6 : 1 - wd
  day.setDate(day.getDate() + offset)
  return day
}

function sameWeek(a: Date, b: Date) {
  return startOfWeekMonday(a).getTime() === startOfWeekMonday(b).getTime()
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

/**
 * Telegram-style timestamp for the chat list (диалоги).
 * - today → 14:32
 * - yesterday → вчера
 * - earlier this week → пн / вт …
 * - same year → 25.07
 * - older year → 25.07.2025
 */
export function formatDialogTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return ''

  const today = startOfDay(now)
  const msgDay = startOfDay(date)
  const diffDays = Math.round((today.getTime() - msgDay.getTime()) / 86_400_000)

  if (diffDays === 0) {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }

  if (diffDays === 1) {
    return 'вчера'
  }

  // Rest of the current calendar week → weekday (пн, вт…)
  if (diffDays > 1 && sameWeek(msgDay, today)) {
    const raw = date.toLocaleDateString('ru-RU', { weekday: 'short' })
    return raw.replace(/\.$/, '').toLowerCase()
  }

  const dd = pad2(date.getDate())
  const mm = pad2(date.getMonth() + 1)
  if (date.getFullYear() === now.getFullYear()) {
    return `${dd}.${mm}`
  }
  return `${dd}.${mm}.${date.getFullYear()}`
}
