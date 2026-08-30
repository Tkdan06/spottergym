export type ProductView =
  | 'funnels'
  | 'core-loop'
  | 'social'
  | 'chats'
  | 'workouts'
  | 'activity'
  | 'progress'
  | 'ai'

export const PRODUCT_VIEWS = [
  'funnels',
  'core-loop',
  'social',
  'chats',
  'workouts',
  'activity',
  'progress',
  'ai',
] as const

export type ProductReferralFilter = 'all' | 'yes' | 'no'

export type MetricDefinition = {
  numerator: string
  denominator: string
  event: string
  window: string
}

export type ProductFunnelStep = {
  id: string
  label: string
  users: number
  events: number
  conversion: number | null
  dropOff: number
  dropOffRate: number | null
  medianSecondsFromPrev: number | null
  worst: boolean
  definition: MetricDefinition
}

export type FunnelStepSource = {
  id: string
  label: string
  firstAt: Map<string, number>
  events: number
  definition: MetricDefinition
}

export function isProductView(value: string | null | undefined): value is ProductView {
  return !!value && (PRODUCT_VIEWS as readonly string[]).includes(value)
}

export function isReferralFilter(value: string | null | undefined): value is ProductReferralFilter {
  return value === 'all' || value === 'yes' || value === 'no'
}

export function rate(part: number, whole: number): number | null {
  if (whole <= 0) return null
  return part / whole
}

export function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Distinct users; duplicate rows for the same user do not inflate the user count. */
export function firstAtByUser(rows: { userId: string; at: number }[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of rows) {
    if (!row.userId) continue
    const prev = map.get(row.userId)
    if (prev == null || row.at < prev) map.set(row.userId, row.at)
  }
  return map
}

export function closeSequentialFunnel(steps: FunnelStepSource[]): ProductFunnelStep[] {
  let allowed: Set<string> | null = null
  let prevAt = new Map<string, number>()
  const out: ProductFunnelStep[] = []

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const next = new Set<string>()
    const deltas: number[] = []

    for (const [userId, at] of step.firstAt) {
      if (allowed == null) {
        next.add(userId)
        continue
      }
      if (!allowed.has(userId)) continue
      const prev = prevAt.get(userId)
      if (prev == null || at < prev) continue
      next.add(userId)
      deltas.push((at - prev) / 1000)
    }

    const users = next.size
    const prevUsers = i === 0 ? users : (allowed?.size ?? 0)
    const dropOff = i === 0 ? 0 : Math.max(0, prevUsers - users)
    out.push({
      id: step.id,
      label: step.label,
      users,
      events: Math.max(0, step.events),
      conversion: i === 0 ? (users > 0 ? 1 : null) : rate(users, prevUsers),
      dropOff,
      dropOffRate: i === 0 ? null : rate(dropOff, prevUsers),
      medianSecondsFromPrev: i === 0 ? null : median(deltas),
      worst: false,
      definition: step.definition,
    })

    allowed = next
    prevAt = new Map([...next].map((id) => [id, step.firstAt.get(id) as number]))
  }

  let worstIndex = -1
  let worstDrop = 0
  let worstRate = -1
  for (let i = 1; i < out.length; i++) {
    const step = out[i]
    if (
      step.dropOff > worstDrop ||
      (step.dropOff === worstDrop && step.dropOff > 0 && (step.dropOffRate ?? 0) > worstRate)
    ) {
      worstDrop = step.dropOff
      worstRate = step.dropOffRate ?? 0
      worstIndex = i
    }
  }
  if (worstIndex >= 0 && worstDrop > 0) out[worstIndex].worst = true
  return out
}

export function hasGymContext(input: {
  homeGymId?: string | null
  gymSelected?: boolean
  gymSkipped?: boolean
  memberGyms?: number
}): boolean {
  return !!(input.homeGymId || input.gymSelected || input.gymSkipped || (input.memberGyms ?? 0) > 0)
}

export function matchesGymFilter(
  user: { homeGymId?: string | null; memberGymIds?: string[] },
  gymId: string | null,
): boolean {
  if (!gymId) return true
  if (user.homeGymId === gymId) return true
  return (user.memberGymIds || []).includes(gymId)
}

export function matchesReferralFilter(
  isInvitee: boolean,
  referral: ProductReferralFilter | null,
): boolean {
  if (!referral || referral === 'all') return true
  return referral === 'yes' ? isInvitee : !isInvitee
}

export function matchesSourceFilter(utmSources: string[], source: string | null): boolean {
  if (!source) return true
  const cleaned = utmSources.map((s) => s.trim()).filter(Boolean)
  if (source === 'direct') return cleaned.length === 0
  return cleaned.includes(source)
}

/** Training never uses CheckIn. A workout without activity still counts. */
export function workoutBelongsToTraining(session: { performedAt: Date }, checkIns: unknown[]): boolean {
  void checkIns
  return !!session.performedAt
}

export function isRepeatWorkout(sessionsSorted: Date[], index: number): boolean {
  return index >= 1 && sessionsSorted.length >= 2
}

export function activityDurationSeconds(input: {
  checkedInAt: Date
  checkedOutAt: Date | null
  expiresAt: Date | null
  now: Date
}): number {
  const end =
    input.checkedOutAt ||
    (input.expiresAt && input.expiresAt.getTime() < input.now.getTime() ? input.expiresAt : input.now)
  const raw = (end.getTime() - input.checkedInAt.getTime()) / 1000
  if (!Number.isFinite(raw) || raw < 0) return 0
  return Math.min(raw, 8 * 60 * 60)
}

export function durationBucket(seconds: number): string {
  if (seconds < 30 * 60) return '<30м'
  if (seconds < 60 * 60) return '30–60м'
  if (seconds < 2 * 60 * 60) return '1–2ч'
  if (seconds < 3 * 60 * 60) return '2–3ч'
  return '3ч+'
}

/** Generation success is generated/requested. Generated is not product value. */
export function aiSuccessRate(generated: number, requested: number): number | null {
  return rate(generated, requested)
}

export function progressReturnedUsers(opensByUser: Map<string, number>): number {
  let n = 0
  for (const count of opensByUser.values()) if (count >= 2) n += 1
  return n
}

export function windowLabel(fromKey: string, toKey: string): string {
  return fromKey === toKey ? `${fromKey} (МСК)` : `${fromKey} — ${toKey} (МСК)`
}

/** Keep the same user counts as the parent funnel; only the first visible step resets conversion. */
export function sliceFunnel(steps: ProductFunnelStep[], ids: string[]): ProductFunnelStep[] {
  const sliced = steps.filter((step) => ids.includes(step.id)).map((step, i) =>
    i === 0
      ? {
          ...step,
          conversion: step.users > 0 ? 1 : null,
          dropOff: 0,
          dropOffRate: null,
          worst: false,
          medianSecondsFromPrev: null,
        }
      : { ...step, worst: false },
  )
  let worstIndex = -1
  let worstDrop = 0
  for (let i = 1; i < sliced.length; i++) {
    if (sliced[i].dropOff > worstDrop) {
      worstDrop = sliced[i].dropOff
      worstIndex = i
    }
  }
  if (worstIndex >= 0 && worstDrop > 0) sliced[worstIndex].worst = true
  return sliced
}
