import { ArrowLeft, Heart, MessageCircle } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { PresenceBadge } from '../components/PresenceBadge'
import { useApp } from '../context/useApp'
import { displayName, formatGymLabel, getContactGym, getUserGyms } from '../data/mock'
import { profileImage } from '../lib/avatar'
import type { UserProfile } from '../types'
import './LikedPage.css'

function LikedRow({
  person,
  myGymIds,
  onMessage,
  onUnlike,
}: {
  person: UserProfile
  myGymIds: string[]
  onMessage: () => void
  onUnlike: () => void
}) {
  const name = displayName(person)
  const isAnon = person.privacy === 'anonymous'
  const gym = getContactGym(person, myGymIds)
  const gymLabel = formatGymLabel(gym)
  const allGyms = getUserGyms(person)
  const gymHint =
    gymLabel ||
    (allGyms[0]
      ? formatGymLabel(allGyms[0])
      : isAnon
        ? 'Зал скрыт'
        : 'Зал не указан')

  return (
    <article className="liked-row">
      <Link to={`/app/user/${person.id}`} className="liked-main">
        <div className="avatar-wrap">
          <img src={profileImage(person)} alt={name} />
          {person.isActive ? <span className="online-dot abs" /> : null}
        </div>
        <div className="liked-body">
          <div className="row">
            <strong>
              {name}
              {!isAnon ? <span className="age">, {person.age}</span> : null}
            </strong>
            <PresenceBadge active={person.isActive} compact />
          </div>
          <p className="gym-line">{gymHint}</p>
          <p className="muted preview">
            {isAnon
              ? 'Анонимный профиль'
              : person.isCoach
                ? person.coachSports.length
                  ? `Тренер · ${person.coachSports.join(', ')}`
                  : 'Тренер'
                : person.bio || 'Открыть профиль'}
          </p>
        </div>
      </Link>
      <div className="liked-actions">
        <button
          type="button"
          className="liked-action primary"
          onClick={onMessage}
          aria-label={`Написать ${name}`}
          title="Написать"
        >
          <MessageCircle size={18} />
        </button>
        <button
          type="button"
          className="liked-action liked"
          onClick={onUnlike}
          aria-label={`Убрать лайк у ${name}`}
          title="Убрать лайк"
        >
          <Heart size={18} fill="currentColor" />
        </button>
      </div>
    </article>
  )
}

export function LikedPage() {
  const { user, getMyLikedUsers, toggleLike, startConversation } = useApp()
  const navigate = useNavigate()
  const liked = getMyLikedUsers()

  if (!user) return null

  return (
    <main className="page liked-page">
      <button type="button" className="back-link" onClick={() => navigate('/app/profile')}>
        <ArrowLeft size={18} /> Профиль
      </button>

      <header className="liked-header">
        <h1>Мои лайки</h1>
        <p className="muted">
          Все, кого ты отметил — из любых залов. Можно открыть профиль или написать.
        </p>
        <p className="liked-count">
          {liked.length
            ? `${liked.length} ${
                liked.length === 1 ? 'человек' : liked.length < 5 ? 'человека' : 'человек'
              }`
            : 'Пока пусто'}
        </p>
      </header>

      {liked.length ? (
        <div className="liked-list">
          {liked.map((person) => (
            <LikedRow
              key={person.id}
              person={person}
              myGymIds={user.gymIds}
              onMessage={() => {
                const id = startConversation(person.id, 'Привет! Увидел тебя в Spotter.')
                navigate(`/app/messages/${id}`)
              }}
              onUnlike={() => toggleLike(person.id)}
            />
          ))}
        </div>
      ) : (
        <section className="liked-empty surface">
          <Heart size={28} className="liked-empty-icon" />
          <h2>Ты ещё никого не лайкнул</h2>
          <p className="muted">
            Отмечай людей на этаже или в профиле — они появятся здесь, даже если зал другой.
          </p>
          <Link to="/app" className="btn btn-primary">
            На этаж
          </Link>
        </section>
      )}
    </main>
  )
}
