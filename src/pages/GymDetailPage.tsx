import { useEffect, useMemo, useState } from 'react'
import { Check, MapPin, Star } from 'lucide-react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { GymMineBadge, GymPresenceBadge } from '../components/GymBadges'
import { InviteFriendsButton } from '../components/InviteFriendsButton'
import { SectionTitle } from '../components/SectionTitle'
import { SmartImage } from '../components/SmartImage'
import { SoftLoader } from '../components/SoftLoader'
import { SubpageBack } from '../components/SubpageHeader'
import { UserCard } from '../components/UserCard'
import { useApp } from '../context/useApp'
import {
  formatGymAddressLines,
  getGym,
  gymTitleLines,
  shortGymName,
} from '../data/mock'
import { ApiError, apiFetchGym } from '../lib/apiClient'
import { isDemoAccount } from '../lib/demoAccount'
import { gymWithoutSeedStats, peekGym } from '../lib/gymCatalog'
import { gymCoverSrc } from '../lib/imageUrl'
import { getGymHours } from '../lib/gymHours'
import { useGymPeople } from '../hooks/useGymPeople'
import { getHallRank, sortByLikes } from '../lib/likes'
import { formatMembersInSpotter } from '../lib/presenceCopy'
import { isMemberOfGym } from '../lib/userGyms'
import { trackApp } from '../lib/appTrack'
import type { Gym } from '../types'
import './GymDetailPage.css'

function gymForDetailPage(
  gymId: string,
  city: string | undefined,
  allowSeedStats: boolean,
): Gym | undefined {
  const local = getGym(gymId)
  const live = peekGym(gymId, [city, local?.city])
  if (live) return live
  if (!local) return undefined
  return allowSeedStats ? local : gymWithoutSeedStats(local)
}

export function GymDetailPage() {
  const { gymId = '' } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const from = searchParams.get('from')
  const fromSettings = from === 'settings'
  const fromHome = from === 'home'
  const { user, joinGym, leaveGym, setHomeGym, likes, likeCounts, blockedUserIds, apiOnline } =
    useApp()
  const demoStats = isDemoAccount(user?.email)

  const [gym, setGym] = useState<Gym | undefined>(() =>
    gymId ? gymForDetailPage(gymId, user?.city, demoStats) : undefined,
  )
  const [gymLoading, setGymLoading] = useState(false)
  const [gymMissing, setGymMissing] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionBusy, setActionBusy] = useState(false)

  useEffect(() => {
    if (!gymId) {
      setGym(undefined)
      setGymMissing(true)
      setGymLoading(false)
      return
    }

    const initial = gymForDetailPage(gymId, user?.city, demoStats)
    if (initial) {
      setGym(initial)
      setGymMissing(false)
    }

    if (!apiOnline) {
      setGymLoading(false)
      setGymMissing(!initial)
      return
    }

    let cancelled = false
    if (!initial) setGymLoading(true)

    void apiFetchGym(gymId)
      .then((remote) => {
        if (cancelled) return
        setGym(remote)
        setGymMissing(false)
      })
      .catch(() => {
        if (cancelled) return
        if (!initial) {
          setGym(undefined)
          setGymMissing(true)
        }
      })
      .finally(() => {
        if (!cancelled) setGymLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [gymId, apiOnline, user?.city, demoStats])

  useEffect(() => {
    if (!gym) return
    const short = shortGymName(gym.name, gym.network) || gym.name
    const prev = document.title
    document.title = `${short} · SPOTTER`
    return () => {
      document.title = prev
    }
  }, [gym])

  const isMine = isMemberOfGym(user, gymId)
  const isHome = user?.homeGymId === gymId
  const hours = gym ? getGymHours(gym) : null

  const {
    people: floorPeople,
    loading: peopleLoading,
    showLoader,
    fromApi,
    error: peopleError,
    retry: retryPeople,
    hasMore: peopleHasMore,
    loadingMore: peopleLoadingMore,
    loadMore: loadMorePeople,
  } = useGymPeople({
    gymId,
    user,
    apiOnline,
    mode: 'gymPage',
    blockedUserIds,
  })

  useEffect(() => {
    if (fromApi) trackApp('people_list_viewed', { surface: 'gym' })
  }, [fromApi])

  const people = useMemo(
    () => sortByLikes(floorPeople, likes, likeCounts),
    [floorPeople, likes, likeCounts],
  )

  const activeFromPeople = people.filter((p) => p.isActive).length
  /** Live list after fetch; until then — API/catalog cache, never gyms.json seeds */
  const activeCount = !demoStats && fromApi ? activeFromPeople : gym?.activeNow ?? 0

  const goBack = () => {
    if (fromSettings) {
      navigate('/app/discover?from=settings')
      return
    }
    if (fromHome) {
      navigate('/app')
      return
    }
    navigate('/app/discover')
  }

  const runMembership = async (action: () => void | Promise<void>, failLabel: string) => {
    setActionError('')
    setActionBusy(true)
    try {
      await action()
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : failLabel
      setActionError(message || failLabel)
    } finally {
      setActionBusy(false)
    }
  }

  if (gymLoading && !gym) {
    return (
      <main className="page gym-detail">
        <SubpageBack onClick={goBack} />
        <SoftLoader label="Загружаем зал…" />
      </main>
    )
  }

  if (!gym || gymMissing) {
    return (
      <main className="page">
        <p>Зал не найден</p>
        <SubpageBack onClick={goBack} />
      </main>
    )
  }

  const showPeopleError = Boolean(peopleError && !showLoader && !peopleLoading)
  /** First load failed — don't pretend the club is empty */
  const showPeopleErrorBlock = showPeopleError && !fromApi
  const showEmptyInvite =
    !showLoader && !peopleLoading && !peopleError && people.length === 0

  return (
    <main className="page gym-detail">
      <SubpageBack onClick={goBack} />

      <section className="gym-hero">
          <SmartImage
            src={gymCoverSrc(gym)}
            alt=""
            size="hero"
            priority
            className="gym-hero-bg"
            aria-hidden
          />
          <div className="gym-hero-content">
            <div className="gym-hero-top">
              <p className="gym-hero-network">{gym.network}</p>
              <div className="gym-hero-badges">
                {isMine ? <GymMineBadge surface="hero" /> : null}
                <GymPresenceBadge activeNow={activeCount} surface="hero" />
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
          <SectionTitle className="gym-hours-title">Часы работы</SectionTitle>
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
            Типичный график сети — не онлайн-статус клуба.
            <br />
            Перед визитом сверь на сайте сети.
          </p>
        </section>
      ) : null}

      <section className="gym-actions">
        {actionError ? (
          <p className="gym-action-error" role="alert">
            {actionError}
          </p>
        ) : null}
        {!isMine ? (
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={actionBusy}
            aria-busy={actionBusy}
            onClick={() =>
              void runMembership(
                () => joinGym(gymId, !user?.homeGymId),
                'Не удалось добавить зал',
              )
            }
          >
            <Check size={18} />
            Сделать своим залом
          </button>
        ) : (
          <>
            {fromSettings ? (
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={() => navigate('/app/settings')}
              >
                К настройкам
              </button>
            ) : null}
            {fromHome ? (
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={() => navigate('/app')}
              >
                На главную
              </button>
            ) : null}
            {!isHome ? (
              <button
                type="button"
                className="btn btn-soft btn-block"
                disabled={actionBusy}
                aria-busy={actionBusy}
                onClick={() =>
                  void runMembership(() => setHomeGym(gymId), 'Не удалось сменить домашний зал')
                }
              >
                <Star size={18} />
                Открывать на главной
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-ghost btn-block"
              onClick={() =>
                void runMembership(() => leaveGym(gymId), 'Не удалось убрать зал')
              }
              disabled={actionBusy || (user?.gymIds.length ?? 0) <= 1}
              aria-busy={actionBusy}
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
        <SectionTitle
          action={
            <span className="muted">
              {showPeopleErrorBlock
                ? 'ошибка'
                : peopleLoading && !showLoader
                  ? '…'
                  : showLoader
                    ? 'загрузка'
                    : people.length
                      ? formatMembersInSpotter(people.length)
                      : 'Пока никого'}
            </span>
          }
        >
          Люди в этом зале
        </SectionTitle>
        <div className="card-list card-list--cards">
          {showLoader ? (
            <SoftLoader label="Загружаем людей в зале…" />
          ) : showPeopleErrorBlock ? (
            <div className="empty-copy-actions">
              <div className="empty-copy" role="alert">
                <p className="empty-copy-title">Не удалось загрузить людей</p>
                <p className="empty-copy-lead">{peopleError}</p>
              </div>
              <button type="button" className="btn btn-primary btn-block" onClick={retryPeople}>
                Повторить
              </button>
            </div>
          ) : peopleLoading ? null : people.length ? (
            <>
              {showPeopleError ? (
                <div className="gym-people-refresh-error" role="status">
                  <p className="dim">{peopleError}</p>
                  <button type="button" className="btn btn-ghost" onClick={retryPeople}>
                    Обновить
                  </button>
                </div>
              ) : null}
              {people.map((person, index) => (
                <UserCard
                  key={person.id}
                  user={person}
                  rank={getHallRank(person.id, people, likes, likeCounts)}
                  priority={index < 4}
                  backTo={`/app/gym/${gymId}${from ? `?from=${from}` : ''}`}
                />
              ))}
              {peopleHasMore ? (
                <button
                  type="button"
                  className="btn btn-soft btn-sm btn-block"
                  disabled={peopleLoadingMore}
                  onClick={() => void loadMorePeople()}
                >
                  {peopleLoadingMore ? 'Загружаем…' : 'Показать ещё'}
                </button>
              ) : null}
            </>
          ) : showEmptyInvite ? (
            <div className="empty-copy-actions">
              <div className="empty-copy" role="status">
                <p className="empty-copy-title">Пока никого в Spotter</p>
                <p className="empty-copy-lead">Пригласи друзей — пусть зайдут и появятся здесь</p>
              </div>
              {user ? (
                <InviteFriendsButton
                  userId={user.id}
                  gymName={shortGymName(gym.name, gym.network) || gym.name}
                  className="btn btn-primary btn-block"
                >
                  Пригласить в зал
                </InviteFriendsButton>
              ) : null}
            </div>
          ) : null}
        </div>
        {!isMine ? (
          <p className="muted gym-hint">Добавь зал в свои — и эти люди появятся у тебя в зале</p>
        ) : null}
      </section>
    </main>
  )
}
