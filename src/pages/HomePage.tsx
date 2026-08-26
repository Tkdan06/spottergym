import { useMemo, useState } from 'react'
import { Bell, ChartNoAxesColumn, ChevronRight, ClipboardList, MapPin } from 'lucide-react'
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
import { InviteFriendsButton } from '../components/InviteFriendsButton'
import { SoftLoader } from '../components/SoftLoader'
import { UserCard } from '../components/UserCard'
import { useApp } from '../context/useApp'
import { getGym, getUserGyms } from '../data/mock'
import { getHallRank, sortByLikes } from '../lib/likes'
import { useCheckInElapsed } from '../hooks/useCheckInElapsed'
import { useGymPeople } from '../hooks/useGymPeople'
import { getCheckInStartedAt, getCheckedInGymId } from '../lib/presence'
import './HomePage.css'

function shortGymName(name: string) {
  return name
    .replace(/^DDX\s+/i, '')
    .replace(/^Spirit\.?\s*Fitness\s*/i, '')
    .replace(/^World Class\s+/i, '')
    .replace(/^Encore\s+/i, '')
    .replace(/^Crocus Fitness\s+/i, '')
    .replace(/^XFIT\s+/i, '')
    .replace(/^Alex Fitness\s+/i, '')
    .replace(/^Fitness 24\s+/i, '')
    .trim()
}

export function HomePage() {
  const { user, likes, likeCounts, setHomeGym, unreadNotifications, blockedUserIds, apiOnline } =
    useApp()
  const [filter, setFilter] = useState<IntentFilter>('all')
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all')
  const [ageFilter, setAgeFilter] = useState<AgeFilter>('all')
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all')

  const myGyms = useMemo(() => (user ? getUserGyms(user) : []), [user])
  const floorGymId = user?.homeGymId || user?.gymIds[0] || ''
  const gym = floorGymId ? getGym(floorGymId) : undefined
  const checkedInId = user ? getCheckedInGymId(user) : ''
  const hasGym = Boolean(gym)

  const {
    people: floorPeople,
    loading: peopleLoading,
    showLoader,
    fromApi: peopleFromApi,
    error: peopleError,
    retry: retryPeople,
  } = useGymPeople({
    gymId: floorGymId,
    user,
    apiOnline,
    mode: 'floor',
    blockedUserIds,
  })
  const peopleLoadFailed = Boolean(peopleError && !peopleLoading && !showLoader && !peopleFromApi)

  const people = useMemo(() => {
    let list = floorPeople
    if (filter === 'active') list = list.filter((p) => p.isActive)
    if (filter === 'dating') list = list.filter((p) => p.intent === 'dating' || p.intent === 'both')
    if (filter === 'buddy') list = list.filter((p) => p.intent === 'buddy' || p.intent === 'both')
    if (filter === 'coach') list = list.filter((p) => p.isCoach)
    if (genderFilter !== 'all') list = list.filter((p) => p.gender === genderFilter)
    if (ageFilter !== 'all') list = list.filter((p) => matchesAge(p.age, ageFilter))
    if (levelFilter !== 'all') list = list.filter((p) => p.experienceLevel === levelFilter)
    return sortByLikes(list, likes, likeCounts)
  }, [floorPeople, filter, genderFilter, ageFilter, levelFilter, likes, likeCounts])

  const youHere = Boolean(
    user && hasGym && checkedInId === gym!.id && user.isActive,
  )
  const sessionStartedAt = youHere && user ? getCheckInStartedAt(user) : ''
  const sessionElapsed = useCheckInElapsed(sessionStartedAt, youHere)

  if (!user) {
    return (
      <main className="page home-page">
        <p className="muted">Загружаем…</p>
      </main>
    )
  }

  const activeNow = floorPeople.filter((p) => p.isActive).length
  const multi = myGyms.length > 1
  const gymLabel = hasGym ? shortGymName(gym!.name) || gym!.name : ''

  return (
    <main className="page home-page">
      <header className="page-header home-top">
        <h1 className="page-title">Мой зал</h1>
        <div className="page-header-actions">
          <Link to="/app/notifications" className="icon-btn home-bell" aria-label="Уведомления">
            <Bell size={20} />
            {unreadNotifications > 0 ? <i className="nav-badge">{unreadNotifications}</i> : null}
          </Link>
        </div>
      </header>

      {!hasGym ? (
        <section className="home-empty-floor" aria-label="Нет выбранного зала">
          <div className="home-empty-icon" aria-hidden>
            <MapPin size={28} />
          </div>
          <h2>Добавь свой клуб</h2>
          <p className="muted">
            Выбери зал в каталоге — здесь появятся люди рядом. Если клуба нет в списке, запроси
            добавление — добавим.
          </p>
          <Link to="/app/discover?from=home" className="btn btn-primary btn-block">
            Выбрать зал
          </Link>
          <div className="home-empty-more">
            <Link to="/app/feedback?topic=gym" className="section-action">
              Запросить добавление зала
            </Link>
            <InviteFriendsButton userId={user.id} className="section-action">
              Пригласить друзей
            </InviteFriendsButton>
          </div>
        </section>
      ) : (
        <>
          <section className="home-gym-block" aria-label="Текущий зал">
            <div className="home-gym-block-head">
              <div className="home-gym-network-row">
                <p className="home-gym-network">{gym!.network}</p>
                <p className="home-status">
                  <span className={`home-status-live${activeNow > 0 ? ' is-live' : ''}`}>
                    {activeNow > 0 ? `${activeNow} в зале` : 'Никого в зале'}
                  </span>
                  {youHere ? (
                    <span className="home-status-you"> · {sessionElapsed || '0:00'}</span>
                  ) : null}
                </p>
              </div>
              <Link
                to={`/app/gym/${gym!.id}`}
                className="home-gym-title-link"
                aria-label={`${gymLabel}, о зале`}
              >
                <h2 className="home-gym-title">{gymLabel}</h2>
                <ChevronRight className="home-gym-title-chevron" size={20} aria-hidden />
              </Link>
            </div>

            <div className="home-gym-checkin">
              <CheckInControl preferredGymId={floorGymId} block />
            </div>

            <nav className="entry-tools entry-tools--2" aria-label="Дневник и активность">
              <Link to="/app/workouts" className="entry-link">
                <ClipboardList size={18} aria-hidden />
                <span>Тренировки</span>
                <ChevronRight size={16} aria-hidden />
              </Link>
              <Link to="/app/activity" className="entry-link">
                <ChartNoAxesColumn size={18} aria-hidden />
                <span>Активность</span>
                <ChevronRight size={16} aria-hidden />
              </Link>
            </nav>

            {multi ? (
              <div className="floor-gym-switch-wrap">
                <div className="floor-gym-switch" role="listbox" aria-label="Твои залы">
                  {myGyms.map((g) => {
                    const active = g.id === floorGymId
                    const here = Boolean(user.isActive && g.id === checkedInId)
                    return (
                      <button
                        key={g.id}
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={`floor-gym-chip ${active ? 'active' : ''} ${here ? 'here' : ''}`}
                        onClick={() => {
                          void Promise.resolve(setHomeGym(g.id)).catch(() => undefined)
                        }}
                      >
                        <span className="floor-gym-chip-name">{shortGymName(g.name) || g.name}</span>
                        {here ? (
                          <span className="floor-gym-chip-dot" aria-label="ты в этом зале" />
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </section>

          <section className="home-people" aria-label="Люди в зале">
            <div className="section-title home-people-head">
              <h2 className="section-heading">Люди в зале</h2>
              <span className="home-people-count">
                {peopleLoading && !showLoader ? '…' : people.length}
              </span>
            </div>

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

            <div className="card-list card-list--cards">
              {showLoader ? (
                <SoftLoader label="Загружаем людей в зале…" />
              ) : peopleLoadFailed ? (
                <div className="empty-copy-actions">
                  <div className="empty-copy" role="alert">
                    <p className="empty-copy-title">Не удалось загрузить людей</p>
                    <p className="empty-copy-lead">{peopleError}</p>
                  </div>
                  <button type="button" className="btn btn-soft btn-block" onClick={retryPeople}>
                    Повторить
                  </button>
                </div>
              ) : peopleLoading ? null : people.length ? (
                people.map((person, index) => (
                  <UserCard
                    key={person.id}
                    user={person}
                    rank={getHallRank(person.id, people, likes, likeCounts)}
                    priority={index < 4}
                  />
                ))
              ) : (
                <div className="empty-copy-actions">
                  <div className="empty-copy" role="status">
                    <p className="empty-copy-title">Пока никого по этому фильтру</p>
                    <p className="empty-copy-lead">Загляни позже или смени фильтр</p>
                  </div>
                  <InviteFriendsButton
                    userId={user.id}
                    gymName={gymLabel}
                    className="btn btn-soft btn-sm btn-block"
                  >
                    Поделиться ссылкой
                  </InviteFriendsButton>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  )
}
