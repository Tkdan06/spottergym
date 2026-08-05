import { useMemo, useState } from 'react'
import { ArrowLeft, Check, Clock3, MapPin, Star } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import {
  FloorFilters,
  matchesAge,
  type AgeFilter,
  type GenderFilter,
  type IntentFilter,
  type LevelFilter,
} from '../components/FloorFilters'
import { UserCard } from '../components/UserCard'
import { useApp } from '../context/useApp'
import { getGym, peopleInGym } from '../data/mock'
import { getGymHours } from '../lib/gymHours'
import { getHallRank, sortByLikes } from '../lib/likes'
import { isMemberOfGym } from '../lib/userGyms'
import './GymDetailPage.css'

export function GymDetailPage() {
  const { gymId = '' } = useParams()
  const { user, likes, joinGym, leaveGym, setHomeGym } = useApp()
  const [filter, setFilter] = useState<IntentFilter>('all')
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all')
  const [ageFilter, setAgeFilter] = useState<AgeFilter>('all')
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all')

  const gym = getGym(gymId)
  const people = useMemo(() => {
    let list = peopleInGym(gymId, user)
    if (filter === 'active') list = list.filter((p) => p.isActive)
    if (filter === 'dating') list = list.filter((p) => p.intent === 'dating' || p.intent === 'both')
    if (filter === 'buddy') list = list.filter((p) => p.intent === 'buddy' || p.intent === 'both')
    if (filter === 'coach') list = list.filter((p) => p.isCoach)
    if (genderFilter !== 'all') list = list.filter((p) => p.gender === genderFilter)
    if (ageFilter !== 'all') list = list.filter((p) => matchesAge(p.age, ageFilter))
    if (levelFilter !== 'all') list = list.filter((p) => p.experienceLevel === levelFilter)
    return sortByLikes(list, likes)
  }, [gymId, user, likes, filter, genderFilter, ageFilter, levelFilter])

  const isMine = isMemberOfGym(user, gymId)
  const isHome = user?.homeGymId === gymId
  const hours = gym ? getGymHours(gym) : null

  if (!gym) {
    return (
      <main className="page">
        <p>Зал не найден</p>
        <Link to="/app/discover">Назад</Link>
      </main>
    )
  }

  return (
    <main className="page gym-detail">
      <Link to="/app/discover" className="back-link">
        <ArrowLeft size={18} /> Залы
      </Link>

      <section className="gym-hero" style={{ backgroundImage: `url(${gym.image})` }}>
        <div className="gym-hero-content">
          <span className="pill pill-online">
            <span className="online-dot" />
            {gym.activeNow} сейчас
          </span>
          {isMine ? <span className="pill pill-accent">Твой зал</span> : null}
          <h1>{gym.name}</h1>
          <p className="row">
            <MapPin size={16} />
            {gym.city}, {gym.address}
          </p>
          <p className="dim">{gym.network}</p>
        </div>
      </section>

      {hours ? (
        <section className="gym-hours surface">
          <div className="gym-hours-head">
            <Clock3 size={18} />
            <h2>Часы работы</h2>
          </div>
          <ul className="gym-hours-list">
            <li>
              <span>Будни</span>
              <strong>{hours.weekdays}</strong>
            </li>
            <li>
              <span>Сб, Вс{hours.source === 'club' ? ' и праздники' : ''}</span>
              <strong>{hours.weekend}</strong>
            </li>
          </ul>
          <p className="dim gym-hours-note">
            {hours.source === 'club'
              ? 'По данным карточки клуба. Перед визитом лучше сверить на сайте сети.'
              : 'Типичный график сети. Перед визитом лучше сверить на сайте клуба.'}
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
              <p className="dim gym-hint">Нужен хотя бы один зал. Добавь другой, чтобы убрать этот.</p>
            ) : null}
          </>
        )}
        {isMine ? (
          <p className="muted gym-hint">Можно быть сразу в нескольких клубах — добавляй из каталога.</p>
        ) : (
          <p className="muted gym-hint">Зал появится в твоём списке, люди здесь станут ближе.</p>
        )}
      </section>

      <FloorFilters
        intent={filter}
        gender={genderFilter}
        age={ageFilter}
        level={levelFilter}
        onIntentChange={setFilter}
        onGenderChange={setGenderFilter}
        onAgeChange={setAgeFilter}
        onLevelChange={setLevelFilter}
      />

      <div className="section-title">
        <h2>Участники</h2>
        <span className="muted">по лайкам · {people.length}</span>
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
          <div className="empty-state">Пока никого по этому фильтру в клубе.</div>
        )}
      </div>
    </main>
  )
}
