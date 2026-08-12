import { formatActiveNowLabel } from '../lib/presenceCopy'
import './GymBadges.css'

type BadgeSurface = 'hero' | 'card'

export function GymPresenceBadge({
  activeNow,
  surface = 'hero',
}: {
  activeNow: number
  surface?: BadgeSurface
}) {
  const online = activeNow > 0
  return (
    <span
      className={`gym-presence-badge gym-presence-badge--${surface} ${
        online ? 'gym-presence-badge--online' : 'gym-presence-badge--off'
      }`}
    >
      {online ? <span className="online-dot" aria-hidden /> : null}
      <span className="gym-presence-badge-label">{formatActiveNowLabel(activeNow)}</span>
    </span>
  )
}

export function GymMineBadge({
  surface = 'hero',
  label = 'Твой',
}: {
  surface?: BadgeSurface | 'chip'
  label?: string
}) {
  return (
    <span className={`gym-mine-badge gym-mine-badge--${surface === 'card' ? 'chip' : surface}`}>
      {label}
    </span>
  )
}
