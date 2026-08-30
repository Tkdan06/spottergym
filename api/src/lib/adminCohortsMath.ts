import { addMoscowDays, moscowDayKey, moscowDayStartUtc } from './adminAnalytics.js'

export const COHORT_RETENTION_DAYS = [1, 3, 7, 14, 30, 60] as const
export const AHA_COMPARE_DAYS = [1, 7, 14, 30] as const
export const AHA_WINDOW_DAYS = 7
export const MIN_AHA_SAMPLE = 8

export type CohortGrain = 'week' | 'month'
export type AcqDimension = 'all' | 'source' | 'medium' | 'campaign' | 'referral' | 'organic' | 'seo'
export type ProductDimension = 'all' | 'gym_selected' | 'social' | 'workout' | 'ai'

export const AHA_ACTIONS = [
  'people_viewed',
  'profile_viewed',
  'like_sent',
  'request_sent',
  'chat_started',
  'workout_saved',
  'progress_opened',
  'ai_used',
] as const

export type AhaAction = (typeof AHA_ACTIONS)[number]

export type CohortUser = {
  id: string
  registeredAt: Date
  lastSeenAt: Date
  homeGymId: string | null
}

export type AcquisitionTouch = {
  source: string
  medium: string
  campaign: string
  searchEngine: string
  searchPaid: boolean
}

export type RetentionCell = {
  day: number
  eligible: number
  retained: number
  rate: number | null
  thin: boolean
}

export type AhaCandidate = {
  action: AhaAction
  usersWith: number
  usersWithout: number
  r7With: number | null
  r7Without: number | null
  difference: number | null
  sampleSize: number
  score: number | null
  thin: boolean
}

export function isCohortGrain(value: string | null | undefined): value is CohortGrain {
  return value === 'week' || value === 'month'
}

export function isAcqDimension(value: string | null | undefined): value is AcqDimension {
  return (
    value === 'all' ||
    value === 'source' ||
    value === 'medium' ||
    value === 'campaign' ||
    value === 'referral' ||
    value === 'organic' ||
    value === 'seo'
  )
}

export function isProductDimension(value: string | null | undefined): value is ProductDimension {
  return (
    value === 'all' ||
    value === 'gym_selected' ||
    value === 'social' ||
    value === 'workout' ||
    value === 'ai'
  )
}

export function isAhaAction(value: string | null | undefined): value is AhaAction {
  return !!value && (AHA_ACTIONS as readonly string[]).includes(value)
}

/** Monday (MSK) of the week that contains the date. */
export function moscowWeekStartKey(date: Date): string {
  const dayKey = moscowDayKey(date)
  const shifted = new Date(date.getTime() + 3 * 60 * 60 * 1000)
  const dow = shifted.getUTCDay()
  const toMonday = dow === 0 ? -6 : 1 - dow
  return addMoscowDays(dayKey, toMonday)
}

export function moscowMonthKey(date: Date): string {
  return moscowDayKey(date).slice(0, 7)
}

export function cohortBucketKey(date: Date, grain: CohortGrain): string {
  return grain === 'month' ? moscowMonthKey(date) : moscowWeekStartKey(date)
}

export function targetDayKey(registeredAt: Date, n: number): string {
  return addMoscowDays(moscowDayKey(registeredAt), n)
}

/** D+N is a calendar day strictly before today (MSK) — same rule as hub retention. */
export function isDayNObserved(registeredAt: Date, n: number, todayKey: string): boolean {
  return targetDayKey(registeredAt, n) < todayKey
}

export function retainedOnDayN(registeredAt: Date, lastSeenAt: Date, n: number): boolean {
  return moscowDayKey(lastSeenAt) === targetDayKey(registeredAt, n)
}

/** Action counts for Aha only if it happened before D+window (no look-ahead into R7). */
export function ahaDeadlineUtc(registeredAt: Date, windowDays = AHA_WINDOW_DAYS): Date {
  return moscowDayStartUtc(addMoscowDays(moscowDayKey(registeredAt), windowDays))
}

export function performedInAhaWindow(
  registeredAt: Date,
  firstAt: number | undefined,
  windowDays = AHA_WINDOW_DAYS,
): boolean {
  if (firstAt == null) return false
  if (firstAt < registeredAt.getTime()) return false
  return firstAt < ahaDeadlineUtc(registeredAt, windowDays).getTime()
}

export function pooledDayN(
  users: { registeredAt: Date; lastSeenAt: Date }[],
  n: number,
  todayKey: string,
  minSample = MIN_AHA_SAMPLE,
): RetentionCell {
  let eligible = 0
  let retained = 0
  for (const user of users) {
    if (!isDayNObserved(user.registeredAt, n, todayKey)) continue
    eligible += 1
    if (retainedOnDayN(user.registeredAt, user.lastSeenAt, n)) retained += 1
  }
  const thin = eligible < minSample
  return {
    day: n,
    eligible,
    retained,
    rate: eligible > 0 ? retained / eligible : null,
    thin,
  }
}

export function matchesAcquisition(
  touch: AcquisitionTouch | undefined,
  isInvitee: boolean,
  dim: AcqDimension,
  value: string | null,
): boolean {
  if (dim === 'all') return true
  if (dim === 'referral') return isInvitee
  const source = (touch?.source || '').trim()
  const medium = (touch?.medium || '').trim().toLowerCase()
  const campaign = (touch?.campaign || '').trim()
  const seo = !!(touch?.searchEngine && !touch.searchPaid)
  const organic = seo || medium === 'organic'
  if (dim === 'organic') return organic
  if (dim === 'seo') return seo
  if (dim === 'source') return !!value && source === value
  if (dim === 'medium') return !!value && medium === value.toLowerCase()
  if (dim === 'campaign') return !!value && campaign === value
  return true
}

export function matchesProductDimension(
  flags: { gymSelected: boolean; social: boolean; workout: boolean; ai: boolean },
  dim: ProductDimension,
): boolean {
  if (dim === 'all') return true
  if (dim === 'gym_selected') return flags.gymSelected
  if (dim === 'social') return flags.social
  if (dim === 'workout') return flags.workout
  return flags.ai
}

export function ahaScore(
  r7With: number | null,
  r7Without: number | null,
  nWith: number,
  nWithout: number,
  minSample = MIN_AHA_SAMPLE,
): { difference: number | null; score: number | null; thin: boolean } {
  const thin = nWith < minSample || nWithout < minSample
  if (thin || r7With == null || r7Without == null) {
    return { difference: r7With != null && r7Without != null ? r7With - r7Without : null, score: null, thin }
  }
  const difference = r7With - r7Without
  return {
    difference,
    score: difference * Math.sqrt(Math.min(nWith, nWithout)),
    thin: false,
  }
}

export function rankAhaCandidates(
  rows: {
    action: AhaAction
    usersWith: number
    usersWithout: number
    r7With: number | null
    r7Without: number | null
  }[],
  minSample = MIN_AHA_SAMPLE,
): AhaCandidate[] {
  const ranked: AhaCandidate[] = rows.map((row) => {
    const { difference, score, thin } = ahaScore(
      row.r7With,
      row.r7Without,
      row.usersWith,
      row.usersWithout,
      minSample,
    )
    return {
      ...row,
      difference,
      sampleSize: row.usersWith + row.usersWithout,
      score,
      thin,
    }
  })
  ranked.sort((a, b) => {
    if (a.thin !== b.thin) return a.thin ? 1 : -1
    return (b.score ?? Number.NEGATIVE_INFINITY) - (a.score ?? Number.NEGATIVE_INFINITY)
  })
  return ranked
}

export function correlationCaption(actionLabel: string, difference: number | null): string {
  if (difference == null) {
    return `Недостаточно данных, чтобы сравнить тех, кто сделал «${actionLabel}», и тех, кто нет.`
  }
  const side = difference >= 0 ? 'выше' : 'ниже'
  return `Пользователи, совершившие действие «${actionLabel}», имеют retention ${side}, чем пользователи, которые его не совершали.`
}
