import { Link } from 'react-router-dom'
import { useApp } from '../context/useApp'
import { displayName, experienceLabel, intentLabel } from '../data/mock'
import { profileImage, profileImageFallback } from '../lib/avatar'
import { breakLabel, isOnBreak } from '../lib/schedule'
import type { UserProfile } from '../types'
import { LikesRow } from './LikesRow'
import { SmartImage } from './SmartImage'
import './UserCard.css'

interface Props {
  user: UserProfile
  compact?: boolean
  rank?: number
  /** Первые карточки в списке — без lazy */
  priority?: boolean
}

export function UserCard({ user, compact, rank, priority = false }: Props) {
  const { user: me, getLikesFor } = useApp()
  const { count, likers } = getLikesFor(user.id)
  const isMe = Boolean(me && user.id === me.id)
  const name = displayName(user)
  const photo = profileImage(user)
  const isCoach = user.isCoach && user.privacy !== 'anonymous'
  const sports = Array.isArray(user.sports) ? user.sports : []
  const coachSports = isCoach && Array.isArray(user.coachSports) ? user.coachSports.slice(0, 2) : []
  const otherSports = (
    user.privacy === 'anonymous' ? [] : sports.filter((s) => !coachSports.includes(s))
  ).slice(0, isCoach ? 1 : 2)
  const isTop = rank === 1 && count > 0
  const onBreak = isOnBreak(user.breakUntil)
  const breakText = breakLabel(user.breakUntil)

  const profileTo = isMe ? '/app/profile' : `/app/user/${user.id}`

  return (
    <Link
      to={profileTo}
      className={`user-card ${compact ? 'compact' : ''} ${isMe ? 'is-me' : ''} ${isCoach ? 'is-coach' : ''}`}
      aria-label={isMe ? `${name} — это ты` : name}
    >
      {isMe ? <span className="me-tab">Ты</span> : null}

      <div className="user-card-aside">
        <div className="user-card-media">
          <SmartImage
            src={photo}
            fallbackSrc={profileImageFallback(user)}
            alt={name}
            size="avatar"
            priority={priority}
          />
        </div>
        {onBreak ? (
          <span className="presence-pill break" title={breakText}>
            Перерыв
          </span>
        ) : (
          <span className={`presence-pill ${user.isActive ? 'on' : 'off'}`}>
            <i className={user.isActive ? 'online-dot' : 'offline-dot'} aria-hidden />
            {user.isActive ? 'В зале' : 'Не в зале'}
          </span>
        )}
      </div>

      <div className="user-card-body">
        <div className="user-card-head">
          <h3>
            {rank ? <span className="rank-num">#{rank}</span> : null}
            <span className="user-card-name">{name}</span>
            {user.privacy !== 'anonymous' ? <span className="age">, {user.age}</span> : null}
          </h3>
          {isTop ? <span className="rank-badge">Топ зала</span> : null}
        </div>
        <p className="muted intent">
          {isCoach
            ? coachSports.length
              ? `Тренер · ${coachSports.join(', ')}`
              : 'Тренер'
            : intentLabel(user.intent)}
        </p>
        {!compact && user.privacy === 'open' && user.bio ? (
          <p className="bio">{user.bio}</p>
        ) : null}
        <div className="chip-grid">
          {user.privacy === 'anonymous' ? (
            <span className="chip small active">Анонимный профиль</span>
          ) : (
            <>
              {experienceLabel(user.experienceLevel) ? (
                <span className="chip small level">{experienceLabel(user.experienceLevel)}</span>
              ) : null}
              {isCoach ? <span className="chip small coach">Тренер</span> : null}
              {coachSports.map((tag) => (
                <span key={tag} className="chip small coach">
                  {tag}
                </span>
              ))}
              {otherSports.map((tag) => (
                <span key={tag} className="chip small active">
                  {tag}
                </span>
              ))}
            </>
          )}
          {user.lookingToMeet ? <span className="chip small">Открыт к общению</span> : null}
        </div>
        <LikesRow count={count} likers={likers} compact maxAvatars={3} />
      </div>
    </Link>
  )
}
