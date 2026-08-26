/** Local `datetime-local` value from Date or ISO. */
export function toDatetimeLocalValue(isoOrDate: string | Date) {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** ISO UTC from datetime-local string. */
export function fromDatetimeLocalValue(local: string) {
  const d = new Date(local)
  if (Number.isNaN(d.getTime())) return new Date().toISOString()
  return d.toISOString()
}

export function formatWorkoutWhen(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export type DeltaTone = 'up' | 'down' | 'flat'

export type DeltaPart = { tone: DeltaTone; text: string }

function signedAmount(n: number, suffix: string) {
  const sign = n > 0 ? '+' : ''
  const value = Number.isInteger(n) ? String(n) : n.toFixed(1)
  return `${sign}${value} ${suffix}`
}

export function formatDeltaParts(
  weightDelta: number | null | undefined,
  repsDelta: number | null | undefined,
  opts?: { hideFlat?: boolean },
): DeltaPart[] | null {
  if (weightDelta == null && repsDelta == null) return null
  const w = weightDelta ?? 0
  const r = repsDelta ?? 0
  if (w === 0 && r === 0) {
    if (opts?.hideFlat) return null
    return [{ tone: 'flat', text: 'как в прошлый раз' }]
  }
  const parts: DeltaPart[] = []
  if (w !== 0) parts.push({ tone: w > 0 ? 'up' : 'down', text: signedAmount(w, 'кг') })
  if (r !== 0) parts.push({ tone: r > 0 ? 'up' : 'down', text: signedAmount(r, 'повт.') })
  return parts.length ? parts : null
}

export function formatDeltaLabel(
  weightDelta: number | null | undefined,
  repsDelta: number | null | undefined,
  opts?: { hideFlat?: boolean },
) {
  const parts = formatDeltaParts(weightDelta, repsDelta, opts)
  if (!parts?.length) return null
  const up = parts.some((p) => p.tone === 'up')
  const down = parts.some((p) => p.tone === 'down')
  return {
    tone: (up && !down ? 'up' : down && !up ? 'down' : 'flat') as DeltaTone,
    text: parts.map((p) => p.text).join(' · '),
    parts,
  }
}

/** Signed body-weight change — no good/bad color judgement. */
export function formatBodyDelta(deltaKg: number | null | undefined) {
  if (deltaKg == null) return null
  if (deltaKg === 0) return 'без изменений'
  const sign = deltaKg > 0 ? '+' : ''
  const n = Number.isInteger(deltaKg) ? String(deltaKg) : deltaKg.toFixed(1)
  return `${sign}${n} кг`
}

export function formatKg(kg: number | null | undefined) {
  if (kg == null) return null
  return Number.isInteger(kg) ? `${kg} кг` : `${kg.toFixed(1)} кг`
}

export function formatSignedPercent(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n) || n === 0) return null
  const sign = n > 0 ? '+' : ''
  const value = Number.isInteger(n) ? String(n) : n.toFixed(1)
  return `${sign}${value}%`
}

function signedDelta(n: number) {
  const sign = n > 0 ? '+' : ''
  const value = Number.isInteger(n) ? String(n) : n.toFixed(1)
  return `${sign}${value}`
}

/** Compact +/− next to a hero number. Hidden when there is no previous window. */
export function formatCompactDelta(
  delta: number | null | undefined,
  previous: number | null | undefined,
) {
  if (delta == null || previous == null || previous <= 0 || delta === 0) return null
  return signedDelta(delta)
}

/** Hide comparison when the previous window is empty — no fake 0% / +N. */
export function formatVsPreviousPeriod(
  delta: number | null | undefined,
  previous: number | null | undefined,
) {
  if (delta == null || previous == null || previous <= 0) return null
  return `${signedDelta(delta)} к прошлому периоду`
}

/** Same comparison, short enough to sit next to a tile number. */
export function formatVsPreviousShort(
  delta: number | null | undefined,
  previous: number | null | undefined,
) {
  if (delta == null || previous == null || previous <= 0 || delta === 0) return null
  return `${signedDelta(delta)} к прошлому`
}

export function formatVolume(n: number) {
  return Math.round(n).toLocaleString('ru-RU')
}

export function formatMinutesRu(total: number, style: 'short' | 'long' = 'short') {
  if (total <= 0) return style === 'long' ? '0 минут' : '0 мин'
  const h = Math.floor(total / 60)
  const m = total % 60
  if (style === 'long') {
    const hours = h > 0 ? `${h} ${ruPlural(h, 'час', 'часа', 'часов')}` : ''
    const mins = m > 0 ? `${m} ${ruPlural(m, 'минута', 'минуты', 'минут')}` : ''
    return [hours, mins].filter(Boolean).join(' ')
  }
  if (h <= 0) return `${m} мин`
  if (m <= 0) return `${h} ч`
  return `${h} ч ${m} мин`
}

export function ruPlural(n: number, one: string, few: string, many: string) {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return many
  if (last === 1) return one
  if (last >= 2 && last <= 4) return few
  return many
}

export function formatBarWeightValue(kg: number) {
  const n = Math.round(kg * 10) / 10
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

/** e.g. «80 × 10» or «80,5 × 8» */
export function formatSetPair(weightKg: number, reps: number) {
  return `${formatBarWeightValue(weightKg)} × ${reps}`
}

export type WorkoutFelt = 'easy' | 'normal' | 'hard'

export const WORKOUT_FELT_OPTIONS: { id: WorkoutFelt; label: string }[] = [
  { id: 'easy', label: 'Легко' },
  { id: 'normal', label: 'Нормально' },
  { id: 'hard', label: 'Тяжело' },
]

export function workoutFeltLabel(value: WorkoutFelt | null | undefined) {
  if (!value) return null
  return WORKOUT_FELT_OPTIONS.find((o) => o.id === value)?.label ?? null
}

