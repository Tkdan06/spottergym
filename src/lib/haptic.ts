/** Короткие паттерны Vibration API. На iOS Safari / iOS PWA не работает. */
export type HapticKind = 'tap' | 'checkin' | 'checkout' | 'save'

const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 12,
  checkin: [14, 28, 18],
  checkout: [10, 40, 10],
  save: 14,
}

export function haptic(kind: HapticKind = 'tap') {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    navigator.vibrate(PATTERNS[kind])
  } catch {
    /* нет поддержки / запрещено */
  }
}
