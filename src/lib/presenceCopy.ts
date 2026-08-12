/** Unified presence / membership labels across Home, Gym detail, GymCard. */

export function formatActiveNowLabel(count: number) {
  const n = Math.max(0, Math.floor(count))
  return n > 0 ? `${n} сейчас в зале` : 'Пусто'
}

export function formatMembersInSpotter(count: number) {
  const n = Math.max(0, Math.floor(count))
  return n > 0 ? `${n} в Spotter` : 'Пока никого в Spotter'
}
