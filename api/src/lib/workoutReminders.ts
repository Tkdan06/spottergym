import { prisma } from '../db.js'
import { createNotification } from './notify.js'

const DAY_MAP: Record<string, string> = {
  Mon: 'Пн',
  Tue: 'Вт',
  Wed: 'Ср',
  Thu: 'Чт',
  Fri: 'Пт',
  Sat: 'Сб',
  Sun: 'Вс',
}

type Slot = { day?: string; from?: string; to?: string }

function moscowParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)

  const get = (type: string) => parts.find((p) => p.type === type)?.value || ''
  const weekdayEn = get('weekday') // Mon, Tue…
  const dayRu = DAY_MAP[weekdayEn] || ''
  const dateKey = `${get('year')}-${get('month')}-${get('day')}`
  const hour = Number(get('hour'))
  const minute = Number(get('minute'))
  return { dayRu, dateKey, hour, minute, minutesOfDay: hour * 60 + minute }
}

function parseHm(value: string) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

function isOnBreak(breakUntil: string | null | undefined, dateKey: string) {
  if (!breakUntil) return false
  return breakUntil >= dateKey
}

/** Fire once when Moscow time is exactly 60 minutes before a visit slot start. */
export async function runWorkoutRemindersTick() {
  const { dayRu, dateKey, minutesOfDay } = moscowParts()
  if (!dayRu) return 0

  const users = await prisma.user.findMany({
    where: { onboardingDone: true },
    select: { id: true, visitSlots: true, breakUntil: true },
    take: 5000,
  })

  let sent = 0
  for (const user of users) {
    if (isOnBreak(user.breakUntil, dateKey)) continue
    const slots = Array.isArray(user.visitSlots) ? (user.visitSlots as Slot[]) : []
    for (const slot of slots) {
      if (!slot || slot.day !== dayRu || !slot.from) continue
      const start = parseHm(slot.from)
      if (start === null) continue
      // Reminder window: exactly 60 minutes before start (same minute)
      const remindAt = start - 60
      if (remindAt < 0) continue
      if (minutesOfDay !== remindAt) continue

      const slotKey = `${dateKey}|${slot.day}|${slot.from}`
      try {
        await prisma.workoutReminderLog.create({
          data: { userId: user.id, slotKey },
        })
      } catch {
        continue // already sent
      }

      const row = await createNotification({
        userId: user.id,
        type: 'workout_reminder',
        title: 'Пора собираться на тренировку',
        body: `Старт в ${slot.from}. Не забудь установить статус в зале.`,
        href: '/app',
      })
      if (row) sent += 1
    }
  }
  return sent
}

export function startWorkoutReminderLoop() {
  const tick = () => {
    void runWorkoutRemindersTick()
      .then((n) => {
        if (n > 0) console.log(`[workout-reminders] sent ${n}`)
      })
      .catch((err) => console.warn('[workout-reminders]', err))
  }

  // Align roughly to minute boundaries
  const delay = 60_000 - (Date.now() % 60_000) + 500
  setTimeout(() => {
    tick()
    setInterval(tick, 60_000)
  }, delay)
  console.log('[workout-reminders] loop scheduled (Europe/Moscow, T-60m)')
}
