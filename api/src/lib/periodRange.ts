export const PERIOD_RANGES = [7, 30, 90, 180, 365] as const

export type PeriodRange = (typeof PERIOD_RANGES)[number]

export function isPeriodRange(n: number): n is PeriodRange {
  return (PERIOD_RANGES as readonly number[]).includes(n)
}

export function parsePeriodRange(raw: string | undefined, fallback: PeriodRange = 30): PeriodRange {
  const n = Number(raw)
  return isPeriodRange(n) ? n : fallback
}
