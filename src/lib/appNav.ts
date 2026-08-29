/** Same-app path we can safely navigate to as a parent (never history.back). */
export function isInAppPath(value: unknown): value is string {
  if (typeof value !== 'string') return false
  if (!value.startsWith('/app')) return false
  if (value.startsWith('//') || value.includes('://')) return false
  return true
}

export function inAppFromState(state: unknown, fallback: string): string {
  const from =
    state && typeof state === 'object' && 'from' in state
      ? (state as { from: unknown }).from
      : undefined
  return isInAppPath(from) ? from : fallback
}

export function profileParentFromState(state: unknown): string {
  const from =
    state && typeof state === 'object' && 'from' in state
      ? (state as { from: unknown }).from
      : undefined
  if (isInAppPath(from) && !from.startsWith('/app/user/')) return from
  return '/app'
}
