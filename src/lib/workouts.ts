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

export function formatDeltaLabel(
  weightDelta: number | null | undefined,
  repsDelta: number | null | undefined,
  opts?: { hideFlat?: boolean },
) {
  if (weightDelta == null && repsDelta == null) return null
  const w = weightDelta ?? 0
  const r = repsDelta ?? 0
  if (w === 0 && r === 0) {
    if (opts?.hideFlat) return null
    return { tone: 'flat' as const, text: 'как в прошлый раз' }
  }
  const parts: string[] = []
  if (w !== 0) {
    const sign = w > 0 ? '+' : ''
    parts.push(`${sign}${Number.isInteger(w) ? w : w.toFixed(1)} кг`)
  }
  if (r !== 0) {
    const sign = r > 0 ? '+' : ''
    parts.push(`${sign}${r} повт.`)
  }
  const up = w > 0 || (w === 0 && r > 0)
  const down = w < 0 || (w === 0 && r < 0)
  return {
    tone: up ? ('up' as const) : down ? ('down' as const) : ('flat' as const),
    text: parts.join(' · '),
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

