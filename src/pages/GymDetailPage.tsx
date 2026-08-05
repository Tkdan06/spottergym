import { useMemo } from 'react'
import { ArrowLeft, Check, Clock3, MapPin, Star } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { InviteFriendsButton } from '../components/InviteFriendsButton'
import { UserCard } from '../components/UserCard'
import { useApp } from '../context/useApp'
import {
  formatGymAddressLines,
  getGym,
  gymTitleLines,
  shortGymName,
} from '../data/mock'
import { getGymHours } from '../lib/gymHours'
import { useGymPeople } from '../hooks/useGymPeople'
import { getHallRank, sortByLikes } from '../lib/likes'
import { isMemberOfGym } from '../lib/userGyms'
import './GymDetailPage.css'

export function GymDetailPage() {
  const { gymId = '' } = useParams()
  const navigate = useNavigate()
  const { user, joinGym, leaveGym, setHomeGym, likes, blockedUserIds, apiOnline } = useApp()
  const gym = getGym(gymId)
  const isMine = isMemberOfGym(user, gymId)
  const isHome = user?.homeGymId === gymId
  const hours = gym ? getGymHours(gym) : null

  const { people: floorPeople } = useGymPeople({
    gymId,
    user,
    apiOnline,
    mode: 'gymPage',
    blockedUserIds,
  })

  const people = useMemo(() => sortByLikes(floorPeople, likes), [floorPeople, likes])

  const activeCount = people.filter((p) => p.isActive).length

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/app')
  }

  if (!gym) {
    return (
      <main className="page">
        <p>Зал не найден</p>
        <button type="button" className="back-link" onClick={goBack}>
          <ArrowLeft size={18} /> Назад
        </button>
      </main>
    )
  }

  return (
    <main className="page gym-detail">
      <button type="button" className="back-link" onClick={goBack}>
        <ArrowLeft size={18} /> Назад
      </button>

      <section className="gym-hero" style={{ backgroundImage: `url(${gym.image})` }}>
        <div className="gym-hero-content">
          <div className="gym-hero-top">
            <p className="gym-hero-network">{gym.network}</p>
            <div className="gym-hero-badges">
              {isMine ? <span className="gym-hero-badge gym-hero-badge--mine">Твой</span> : null}
              <span
                className={`gym-hero-badge ${activeCount > 0 ? 'gym-hero-badge--online' : 'gym-hero-badge--off'}`}
              >
                {activeCount > 0 ? <span className="online-dot" /> : null}
                {activeCount > 0 ? `${activeCount} в зале` : 'Пусто'}
              </span>
            </div>
          </div>
          <h1 className="gym-hero-title" aria-label={gym.name}>
            {gymTitleLines(gym.name, gym.network).map((line, index) => (
              <span key={`${index}-${line}`} className="gym-hero-title-line">
                {line}
              </span>
            ))}
          </h1>
          <p className="gym-hero-address">
            <MapPin size={18} strokeWidth={2.25} aria-hidden />
            <span className="gym-hero-address-text">
              {formatGymAddressLines(gym).map((line, index) => (
                <span key={`${index}-${line}`} className="gym-hero-address-line">
                  {line}
                </span>
              ))}
            </span>
          </p>
        </div>
      </section>

      {hours ? (
        <section className="gym-hours surface">
          <div className="gym-hours-head">
            <Clock3 size={18} />
            <h2>Часы работы</h2>
          </div>
          <ul className="gym-hours-list">
            {hours.weekdays === hours.weekend ? (
              <li>
                <span>Ежедневно</span>
                <strong>{hours.weekdays}</strong>
              </li>
            ) : (
              <>
                <li>
                  <span>Будни</span>
                  <strong>{hours.weekdays}</strong>
                </li>
                <li>
                  <span>Сб, Вс{hours.source === 'club' ? ' и праздники' : ''}</span>
                  <strong>{hours.weekend}</strong>
                </li>
              </>
            )}
          </ul>
          <p className="dim gym-hours-note">
            Типичный график сети
            <br />
            Перед визитом сверь на сайте сети
          </p>
        </section>
      ) : null}

      <section className="gym-actions">
        {!isMine ? (
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => joinGym(gymId, !user?.homeGymId)}
          >
            <Check size={18} />
            Сделать своим залом
          </button>
        ) : (
          <>
            {!isHome ? (
              <button
                type="button"
                className="btn btn-soft btn-block"
                onClick={() => setHomeGym(gymId)}
              >
                <Star size={18} />
                Открывать на главной
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-ghost btn-block"
              onClick={() => leaveGym(gymId)}
              disabled={(user?.gymIds.length ?? 0) <= 1}
            >
              Убрать из своих
            </button>
            {(user?.gymIds.length ?? 0) <= 1 ? (
              <p className="dim gym-hint">Чтобы убрать — сначала добавь другой зал</p>
            ) : null}
          </>
        )}
      </section>

      <section className="gym-people">
        <div className="section-title">
          <h2>Люди в этом зале</h2>
          <span className="muted">
            {people.length ? `${people.length} в клубе` : 'Пока никого'}
          </span>
        </div>
        <div className="card-list">
          {people.length ? (
            people.map((person) => (
              <UserCard
                key={person.id}
                user={person}
                rank={getHallRank(person.id, people, likes)}
              />
            ))
          ) : (
            <div className="empty-copy-actions">
              <div className="empty-copy" role="status">
                <p className="empty-copy-title">Пока никого в Spotter</p>
                <p className="empty-copy-lead">Пригласи друзей — пусть зайдут и появятся здесь</p>
              </div>
              {user ? (
                <InviteFriendsButton
                  userId={user.id}
                  gymName={shortGymName(gym.name, gym.network) || gym.name}
                  className="btn btn-soft btn-block"
                >
                  Поделиться ссылкой
                </InviteFriendsButton>
              ) : null}
            </div>
          )}
        </div>
        {!isMine ? (
          <p className="muted gym-hint">Добавь зал в свои — и эти люди появятся у тебя в зале</p>
        ) : null}
      </section>
    </main>
  )
}
