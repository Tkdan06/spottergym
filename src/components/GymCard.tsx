import { MapPin, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatGymAddress } from '../data/mock'
import { formatMembersInSpotter } from '../lib/presenceCopy'
import type { Gym } from '../types'
import { GymMineBadge, GymPresenceBadge } from './GymBadges'
import { SmartImage } from './SmartImage'
import './GymCard.css'

interface Props {
  gym: Gym
  selected?: boolean
  mine?: boolean
  onSelect?: () => void
  to?: string
  /** Фейковые цифры из каталога — только для demo@demo.ru */
  showDemoStats?: boolean
  /** Реальные счётчики (для обычных аккаунтов) */
  membersCount?: number
  activeNow?: number
  /** Первые карточки в списке — без lazy */
  priority?: boolean
}

export function GymCard({
  gym,
  selected,
  mine,
  onSelect,
  to,
  showDemoStats = false,
  membersCount: realMembers,
  activeNow: realActive,
  priority = false,
}: Props) {
  const activeNow = showDemoStats ? gym.activeNow : (realActive ?? 0)
  const membersCount = showDemoStats ? gym.membersCount : (realMembers ?? 0)

  const content = (
    <>
      <div className="gym-card-media">
        <SmartImage src={gym.image} alt={gym.name} size="card" priority={priority} />
        <GymPresenceBadge activeNow={activeNow} surface="card" />
      </div>
      <div className="gym-card-body">
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <span className="chip small active network-tag">{gym.network}</span>
          {mine || selected ? <GymMineBadge surface="chip" /> : null}
        </div>
        <h3>{gym.name}</h3>
        <p className="muted row">
          <MapPin size={14} aria-hidden />
          {formatGymAddress(gym)}
        </p>
        <p className="dim row">
          <Users size={14} aria-hidden />
          {formatMembersInSpotter(membersCount)}
        </p>
      </div>
    </>
  )

  if (to) {
    return (
      <Link to={to} className={`gym-card ${selected ? 'selected' : ''}`}>
        {content}
      </Link>
    )
  }

  return (
    <button type="button" className={`gym-card ${selected ? 'selected' : ''}`} onClick={onSelect}>
      {content}
    </button>
  )
}
