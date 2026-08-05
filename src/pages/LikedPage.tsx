import { ArrowLeft, Heart, MessageCircle } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { PresenceBadge } from '../components/PresenceBadge'
import { useApp } from '../context/useApp'
import { displayName, formatGymLabel, getContactGym, getUserGyms } from '../data/mock'
import { profileImage } from '../lib/avatar'
import { hasLiked } from '../lib/likes'
import type { UserProfile } from '../types'
import './LikedPage.css'

export type LikesMode = 'received' | 'sent'

function LikedRow({
  person,
  myGymIds,
  likedByMe,
  onMessage,
  onToggleLike,
  likeMode,
}: {
  person: UserProfile
  myGymIds: string[]
  likedByMe: boolean
  onMessage: () => void
  onToggleLike: () => void
  likeMode: LikesMode
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

  const likeLabel =
    likeMode === 'received'
      ? likedByMe
        ? `Убрать лайк у ${name}`
        : `Лайкнуть в ответ ${name}`
      : `Убрать лайк у ${name}`

  return (
    <article className="liked-row">
      <Link to={`/app/user/${person.id}`} className="liked-main">
        <div className="avatar-wrap">
          <img src={profileImage(person)} alt={name} />
        </div>
        <div className="liked-body">
          <div className="liked-title-line">
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
          className={`liked-action ${likedByMe ? 'liked' : ''}`}
          onClick={onToggleLike}
          aria-label={likeLabel}
          title={
            likeMode === 'received'
              ? likedByMe
                ? 'Взаимный лайк'
                : 'Лайк в ответ'
              : 'Убрать лайк'
          }
        >
          <Heart size={18} fill={likedByMe ? 'currentColor' : 'none'} />
        </button>
      </div>
    </article>
  )
}

export function LikedPage({ mode = 'received' }: { mode?: LikesMode }) {
  const {
    user,
    likes,
    getLikesFor,
    getMyLikedUsers,
    toggleLike,
    startConversation,
    blockedUserIds,
  } = useApp()
  const navigate = useNavigate()

  if (!user) return null

  const listPath = mode === 'received' ? '/app/likes' : '/app/likes/sent'
  const people =
    mode === 'received'
      ? getLikesFor(user.id).likers.filter((p) => !blockedUserIds.includes(p.id))
      : getMyLikedUsers().filter((p) => !blockedUserIds.includes(p.id))

  return (
    <main className="page liked-page">
      <button type="button" className="back-link" onClick={() => navigate('/app/profile')}>
        <ArrowLeft size={18} /> Профиль
      </button>

      <header className="page-header liked-header">
        <div className="page-header-text">
          <h1 className="page-title">Лайки</h1>
          <div className="liked-tabs" role="tablist" aria-label="Лайки">
            <Link
              to="/app/likes"
              role="tab"
              aria-selected={mode === 'received'}
              className={`liked-tab ${mode === 'received' ? 'active' : ''}`}
            >
              Кто лайкнул
            </Link>
            <Link
              to="/app/likes/sent"
              role="tab"
              aria-selected={mode === 'sent'}
              className={`liked-tab ${mode === 'sent' ? 'active' : ''}`}
            >
              Кого я лайкнул
            </Link>
          </div>
          <p className="liked-count">
            {people.length
              ? `${people.length} ${
                  people.length === 1 ? 'человек' : people.length < 5 ? 'человека' : 'человек'
                }`
              : 'Пока пусто'}
          </p>
        </div>
      </header>

      {people.length ? (
        <div className="liked-list">
          {people.map((person) => {
            const likedByMe = hasLiked(likes, person.id, user.id)
            return (
              <LikedRow
                key={person.id}
                person={person}
                myGymIds={user.gymIds}
                likedByMe={likedByMe}
                likeMode={mode}
                onMessage={() => {
                  void startConversation(person.id, 'Привет! Увидел тебя в Spotter.').then(
                    (id) => {
                      navigate(`/app/messages/${id}`, { state: { from: listPath } })
                    },
                  )
                }}
                onToggleLike={() => toggleLike(person.id)}
              />
            )
          })}
        </div>
      ) : (
        <section className="liked-empty surface">
          <div className="empty-copy" role="status">
            <p className="empty-copy-title">
              {mode === 'received' ? 'Пока никто не лайкнул' : 'Ты ещё никого не лайкнул'}
            </p>
            <p className="empty-copy-lead">
              {mode === 'received'
                ? 'Как только кто-то отметит тебя — появится здесь'
                : 'Отмечай людей в зале или в профиле — появятся здесь'}
            </p>
          </div>
          <Link to="/app" className="btn btn-primary">
            В зал
          </Link>
        </section>
      )}
    </main>
  )
}
