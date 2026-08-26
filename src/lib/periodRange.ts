export const PERIOD_RANGES = [7, 30, 90, 180, 365] as const

export type PeriodRange = (typeof PERIOD_RANGES)[number]

export const PERIOD_TABS: { id: PeriodRange; label: string }[] = PERIOD_RANGES.map((id) => ({
  id,
  label: `${id}д`,
}))
