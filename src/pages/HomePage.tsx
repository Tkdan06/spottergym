import { useMemo, useState } from 'react'
import { Bell, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CheckInControl } from '../components/CheckInControl'
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
import { getGym, getUserGyms, peopleInGym } from '../data/mock'
import { getHallRank, sortByLikes } from '../lib/likes'
import { getCheckedInGymId } from '../lib/presence'
import type { Gym } from '../types'
import './HomePage.css'

function shortGymName(name: string) {
  return name
    .replace(/^DDX\s+/i, '')
    .replace(/^Spirit\.?\s*Fitness\s*/i, '')
    .replace(/^World Class\s+/i, '')
    .trim()
}

export function HomePage() {
  const { user, likes, setHomeGym, unreadNotifications } = useApp()
  const [filter, setFilter] = useState<IntentFilter>('all')
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all')
  const [ageFilter, setAgeFilter] = useState<AgeFilter>('all')
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all')

  const myGyms = useMemo(() => (user ? getUserGyms(user) : []), [user])
  const floorGymId = user?.homeGymId || user?.gymIds[0] || ''
  const gym = floorGymId ? getGym(floorGymId) : undefined
  const checkedInId = user ? getCheckedInGymId(user) : ''

  const people = useMemo(() => {
    if (!floorGymId) return []
    let list = peopleInGym(floorGymId, user)
    if (filter === 'active') list = list.filter((p) => p.isActive)
    if (filter === 'dating') list = list.filter((p) => p.intent === 'dating' || p.intent === 'both')
    if (filter === 'buddy') list = list.filter((p) => p.intent === 'buddy' || p.intent === 'both')
    if (filter === 'coach') list = list.filter((p) => p.isCoach)
    if (genderFilter !== 'all') list = list.filter((p) => p.gender === genderFilter)
    if (ageFilter !== 'all') list = list.filter((p) => matchesAge(p.age, ageFilter))
    if (levelFilter !== 'all') list = list.filter((p) => p.experienceLevel === levelFilter)
    return sortByLikes(list, likes)
  }, [floorGymId, filter, genderFilter, ageFilter, levelFilter, user, likes])

  if (!user) return null

  const activeNow = people.filter((p) => p.isActive).length

  return (
    <main className="page home-page">
      <header className="home-header">
        <div>
          <p className="muted">
            {myGyms.length > 1 ? `Твои залы · ${myGyms.length}` : 'Твой зал'}
          </p>
          <h1>{gym ? shortGymName(gym.name) || gym.name : 'Выбери зал'}</h1>
          <p className="dim">
            {gym
              ? `${gym.network} · ${activeNow} сейчас на тренировке`
              : 'Зайди в каталог и добавь клуб к своим'}
          </p>
        </div>
        <div className="home-actions">
          <Link to="/app/notifications" className="icon-btn home-bell" aria-label="Уведомления">
            <Bell size={20} />
            {unreadNotifications > 0 ? <i className="nav-badge">{unreadNotifications}</i> : null}
          </Link>
          <CheckInControl preferredGymId={floorGymId} compact />
        </div>
      </header>

      {gym ? (
        <FloorGymHero
          gym={gym}
          myGyms={myGyms}
          floorGymId={floorGymId}
          checkedInId={checkedInId}
          onSelectGym={setHomeGym}
          activeNow={activeNow}
        />
      ) : (
        <Link to="/app/discover" className="home-banner home-banner-empty">
          <div className="home-banner-content">
            <span className="pill pill-accent">Floor live</span>
            <p>Добавь зал — и здесь появится этаж с людьми рядом.</p>
          </div>
        </Link>
      )}

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

      <section>
        <div className="section-title">
          <h2>Люди в зале</h2>
          <Link to="/app/discover" className="muted">
            {myGyms.length ? 'Добавить зал' : 'Выбрать зал'}
          </Link>
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
            <div className="empty-state">
              {gym
                ? 'Пока никого по этому фильтру. Загляни позже или смени фильтр.'
                : 'Добавь зал из каталога — и здесь появятся люди.'}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

function FloorGymHero({
  gym,
  myGyms,
  floorGymId,
  checkedInId,
  onSelectGym,
  activeNow,
}: {
  gym: Gym
  myGyms: Gym[]
  floorGymId: string
  checkedInId: string
  onSelectGym: (gymId: string) => void
  activeNow: number
}) {
  const multi = myGyms.length > 1

  return (
    <section
      className={`floor-gym-hero ${multi ? 'multi' : ''}`}
      style={{ backgroundImage: `url(${gym.image})` }}
      aria-label={multi ? 'Выбор зала на этаже' : 'Текущий зал'}
    >
      <div className="floor-gym-hero-shade" />

      <div className="floor-gym-hero-body">
        <div className="floor-gym-hero-copy">
          <span className="pill pill-accent">Floor live</span>
          <p>Смотри, кто рядом прямо сейчас — и пиши без неловкого «привет у зеркала».</p>
          <p className="floor-gym-hero-stats">
            <span className="floor-gym-hero-live">{activeNow} в зале</span>
            <span className="floor-gym-hero-place">
              {' '}
              · {shortGymName(gym.name) || gym.name}
              {checkedInId === gym.id ? ' · ты тут' : ''}
            </span>
          </p>
        </div>

        <Link to={`/app/gym/${gym.id}`} className="floor-gym-hero-link">
          О зале <ChevronRight size={16} />
        </Link>
      </div>

      {multi ? (
        <div className="floor-gym-picker" role="listbox" aria-label="Мои залы">
          {myGyms.map((g) => {
            const active = g.id === floorGymId
            const here = g.id === checkedInId
            return (
              <button
                key={g.id}
                type="button"
                role="option"
                aria-selected={active}
                className={`floor-gym-pick ${active ? 'active' : ''} ${here ? 'here' : ''}`}
                onClick={() => onSelectGym(g.id)}
                style={{ backgroundImage: `url(${g.image})` }}
              >
                <span className="floor-gym-pick-shade" />
                <span className="floor-gym-pick-name">{shortGymName(g.name) || g.name}</span>
                {here ? <span className="floor-gym-pick-here">тут</span> : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
