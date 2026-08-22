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

export function formatBarWeightValue(kg: number) {
  const n = Math.round(kg * 10) / 10
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

/** e.g. «80 × 10» or «80,5 × 8» */
export function formatSetPair(weightKg: number, reps: number) {
  return `${formatBarWeightValue(weightKg)} × ${reps}`
}

