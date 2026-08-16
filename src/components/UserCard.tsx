import { useState } from 'react'
import { Heart } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/useApp'
import { displayName, experienceLabel, intentLabel } from '../data/mock'
import { profileImage, profileImageFallback } from '../lib/avatar'
import { breakLabel, isOnBreak } from '../lib/schedule'
import type { UserProfile } from '../types'
import { LikesRow } from './LikesRow'
import { ReferralBadge, referralChromeClass } from './ReferralBadge'
import { SmartImage } from './SmartImage'
import './UserCard.css'

interface Props {
  user: UserProfile
  compact?: boolean
  rank?: number
  /** Первые карточки в списке — без lazy */
  priority?: boolean
  /** Лайк прямо с карточки (не для своего профиля) */
  enableLike?: boolean
}

export function UserCard({
  user,
  compact,
  rank,
  priority = false,
  enableLike = true,
}: Props) {
  const navigate = useNavigate()
  const { user: me, getLikesFor, toggleLike } = useApp()
  const { count, likers, likedByMe } = getLikesFor(user.id)
  const [likeError, setLikeError] = useState('')
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

  const goProfile = () => {
    navigate(profileTo, { state: isMe ? undefined : { person: user } })
  }

  return (
    <article
      className={`user-card ${compact ? 'compact' : ''} ${isMe ? 'is-me' : ''} ${isCoach ? 'is-coach' : ''} ${referralChromeClass(user)}`}
      role="link"
      tabIndex={0}
      aria-label={isMe ? `${name} — это ты` : name}
      onClick={goProfile}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          goProfile()
        }
      }}
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
          <ReferralBadge user={user} size="sm" />
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
        <div className="user-card-likes">
          <LikesRow count={count} likers={likers} compact maxAvatars={3} />
          {enableLike && !isMe && me ? (
            <button
              type="button"
              className={`user-card-like-btn ${likedByMe ? 'liked' : ''}`}
              aria-pressed={likedByMe}
              aria-label={likedByMe ? 'Убрать лайк' : 'Лайк'}
              title={likeError || undefined}
              onClick={(e) => {
                e.stopPropagation()
                setLikeError('')
                void Promise.resolve(toggleLike(user.id)).catch((err: unknown) => {
                  setLikeError(err instanceof Error ? err.message : 'Не удалось поставить лайк')
                })
              }}
            >
              <Heart size={16} fill={likedByMe ? 'currentColor' : 'none'} aria-hidden />
            </button>
          ) : null}
        </div>
        {likeError ? (
          <p className="feedback-error user-card-like-error" role="alert">
            {likeError}
          </p>
        ) : null}
      </div>
    </article>
  )
}
