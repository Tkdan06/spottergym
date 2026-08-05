import { useState } from 'react'
import { useApp } from '../context/useApp'
import { getGym, getUserGyms } from '../data/mock'
import { getCheckedInGymId } from '../lib/presence'
import './CheckInControl.css'

interface Props {
  /** Предпочтительный зал (например, открытый сейчас на Этаже) */
  preferredGymId?: string
  compact?: boolean
  className?: string
}

function shortGymName(name: string) {
  return name
    .replace(/^DDX\s+/i, '')
    .replace(/^Spirit\.?\s*Fitness\s+/i, '')
    .replace(/^World Class\s+/i, '')
    .trim()
}

export function CheckInControl({ preferredGymId, compact, className = '' }: Props) {
  const { user, checkIn, checkOut } = useApp()
  const [picking, setPicking] = useState(false)

  if (!user) return null

  const gyms = getUserGyms(user)
  const checkedId = getCheckedInGymId(user)
  const checkedGym = checkedId ? getGym(checkedId) : undefined
  const preferred =
    (preferredGymId && user.gymIds.includes(preferredGymId) && preferredGymId) ||
    user.homeGymId ||
    user.gymIds[0] ||
    ''

  if (!gyms.length) {
    return (
      <button type="button" className={`btn btn-primary ${className}`} disabled>
        Сначала выбери зал
      </button>
    )
  }

  if (user.isActive) {
    return (
      <div className={`checkin-control ${compact ? 'compact' : ''} ${className}`}>
        <button type="button" className="btn btn-soft" onClick={() => checkOut()}>
          {compact ? 'Уйти' : 'Уйти из зала'}
        </button>
        {gyms.length > 1 ? (
          <button
            type="button"
            className="btn btn-ghost checkin-switch"
            onClick={() => setPicking((v) => !v)}
          >
            {picking ? 'Скрыть' : 'Сменить зал'}
          </button>
        ) : null}
        {picking ? (
          <div className="checkin-picker">
            <p className="muted">Где ты сейчас?</p>
            <div className="chip-grid">
              {gyms.map((gym) => (
                <button
                  key={gym.id}
                  type="button"
                  className={`chip ${checkedId === gym.id ? 'active' : ''}`}
                  onClick={() => {
                    checkIn(gym.id)
                    setPicking(false)
                  }}
                >
                  {shortGymName(gym.name) || gym.name}
                </button>
              ))}
            </div>
          </div>
        ) : checkedGym && !compact ? (
          <p className="dim checkin-hint">Сейчас: {shortGymName(checkedGym.name) || checkedGym.name}</p>
        ) : null}
      </div>
    )
  }

  if (gyms.length === 1) {
    return (
      <button
        type="button"
        className={`btn btn-primary ${className}`}
        onClick={() => checkIn(gyms[0].id)}
      >
        {compact ? 'Я в зале' : 'Я в зале'}
      </button>
    )
  }

  if (!picking) {
    return (
      <div className={`checkin-control ${compact ? 'compact' : ''} ${className}`}>
        <button type="button" className="btn btn-primary" onClick={() => setPicking(true)}>
          Я в зале
        </button>
        {!compact && preferred ? (
          <p className="dim checkin-hint">Выбери клуб — у тебя их {gyms.length}</p>
        ) : null}
      </div>
    )
  }

  return (
    <div className={`checkin-control open ${compact ? 'compact' : ''} ${className}`}>
      <div className="checkin-picker">
        <div className="checkin-picker-head">
          <p className="muted">В каком зале ты сейчас?</p>
          <button type="button" className="text-btn" onClick={() => setPicking(false)}>
            Отмена
          </button>
        </div>
        <div className="chip-grid">
          {gyms.map((gym) => (
            <button
              key={gym.id}
              type="button"
              className={`chip ${preferred === gym.id ? 'active' : ''}`}
              onClick={() => {
                checkIn(gym.id)
                setPicking(false)
              }}
            >
              {shortGymName(gym.name) || gym.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
