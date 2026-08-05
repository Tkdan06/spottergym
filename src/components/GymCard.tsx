import { MapPin, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Gym } from '../types'
import './GymCard.css'

interface Props {
  gym: Gym
  selected?: boolean
  mine?: boolean
  onSelect?: () => void
  to?: string
}

export function GymCard({ gym, selected, mine, onSelect, to }: Props) {
  const content = (
    <>
      <div className="gym-card-media">
        <img src={gym.image} alt={gym.name} />
        <span className="pill pill-online">
          <span className="online-dot" />
          {gym.activeNow} сейчас
        </span>
      </div>
      <div className="gym-card-body">
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <span className="chip small active network-tag">{gym.network}</span>
          {mine || selected ? <span className="chip small">Твой</span> : null}
        </div>
        <h3>{gym.name}</h3>
        <p className="muted row">
          <MapPin size={14} />
          {[gym.district, gym.address].filter(Boolean).join(' · ')}
        </p>
        <p className="dim row">
          <Users size={14} />
          {gym.membersCount} в Spotter
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
