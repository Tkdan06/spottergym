import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Search } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CityCarousel } from '../components/CityCarousel'
import { ElsewhereGymBanner } from '../components/ElsewhereGymBanner'
import { GymCard } from '../components/GymCard'
import { SoftLoader, SOFT_LOADER_DELAY_MS } from '../components/SoftLoader'
import { useApp } from '../context/useApp'
import { GYMS, NETWORKS } from '../data/mock'
import { apiFetchGyms } from '../lib/apiClient'
import { isDemoAccount } from '../lib/demoAccount'
import {
  buildElsewhereSuggestions,
  ELSEWHERE_QUERY_MIN,
  searchElsewhereLocal,
  type ElsewhereSuggestion,
} from '../lib/elsewhereGyms'
import { loadCityGyms, peekCityGyms } from '../lib/gymCatalog'
import { gymMatchesQuery } from '../lib/gymSearch'
import { networkHallCounts, sortGymsInCity } from '../lib/gymRank'
import { buildRealGymStatsMap } from '../lib/gymStats'
import { searchFieldProps } from '../lib/inputAttrs'
import { isMemberOfGym } from '../lib/userGyms'
import type { Gym } from '../types'
import './DiscoverPage.css'

function filterCityGyms(list: Gym[], city: string, network: string, query: string) {
  const q = query.trim()
  return list.filter((g) => {
    if (g.city !== city) return false
    if (network !== 'Все сети' && g.network !== network) return false
    return gymMatchesQuery(g, q)
  })
}

export function DiscoverPage() {
  const { user, apiOnline } = useApp()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const from = searchParams.get('from')
  const fromSettings = from === 'settings'
  const fromHome = from === 'home'
  const [city, setCity] = useState(user?.city || 'Москва')
  const [network, setNetwork] = useState<(typeof NETWORKS)[number]>('Все сети')
  const [query, setQuery] = useState('')
  const [remoteGyms, setRemoteGyms] = useState<Gym[] | null>(() =>
    isDemoAccount(user?.email) ? null : peekCityGyms(user?.city || city),
  )
  const [liveFailed, setLiveFailed] = useState(false)
  const [elsewhereRemote, setElsewhereRemote] = useState<Gym[] | null>(null)

  const demoStats = isDemoAccount(user?.email)
  const gymLink = (gymId: string) => {
    if (fromSettings) return `/app/gym/${gymId}?from=settings`
    if (fromHome) return `/app/gym/${gymId}?from=home`
    return `/app/gym/${gymId}`
  }

  useEffect(() => {
    if (demoStats) {
      setRemoteGyms(null)
      setLiveFailed(false)
      return
    }
    const peek = peekCityGyms(city)
    setRemoteGyms(peek)
    setLiveFailed(false)
    let cancelled = false
    void loadCityGyms(city)
      .then((list) => {
        if (!cancelled) setRemoteGyms(list)
      })
      .catch(() => {
        if (!cancelled && !peek) setLiveFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [demoStats, city, apiOnline])

  const cityGyms = useMemo(() => {
    if (demoStats || liveFailed) {
      return GYMS.filter((g) => g.city === city)
    }
    return remoteGyms ? remoteGyms.filter((g) => g.city === city) : null
  }, [demoStats, liveFailed, remoteGyms, city])

  const catalog = useMemo(() => {
    if (!cityGyms) return []
    return filterCityGyms(cityGyms, city, network, query)
  }, [cityGyms, city, network, query])

  const waitingLiveCatalog = Boolean(!demoStats && cityGyms === null)

  const liveStats = useMemo(() => {
    if (demoStats) {
      const map: Record<string, { membersCount: number; activeNow: number }> = {}
      for (const g of catalog) {
        map[g.id] = { membersCount: g.membersCount, activeNow: g.activeNow }
      }
      return map
    }
    if (remoteGyms) {
      const map: Record<string, { membersCount: number; activeNow: number }> = {}
      for (const g of remoteGyms) {
        map[g.id] = { membersCount: g.membersCount, activeNow: g.activeNow }
      }
      return map
    }
    return buildRealGymStatsMap(
      catalog.map((g) => g.id),
      user,
    )
  }, [demoStats, remoteGyms, catalog, user])

  const gyms = useMemo(() => {
    const hallCounts = networkHallCounts(cityGyms || catalog)
    return sortGymsInCity(
      catalog,
      (g) => liveStats[g.id]?.membersCount ?? 0,
      (g) => hallCounts.get(g.network || '') || 0,
    )
  }, [catalog, cityGyms, liveStats])

  const elsewhereQuery = query.trim()
  const needElsewhere =
    gyms.length === 0 && elsewhereQuery.length >= ELSEWHERE_QUERY_MIN

  useEffect(() => {
    if (!needElsewhere) {
      setElsewhereRemote(null)
      return
    }
    if (!apiOnline || demoStats) {
      setElsewhereRemote(null)
      return
    }
    let cancelled = false
    void apiFetchGyms({
      q: elsewhereQuery,
      elsewhere: true,
      excludeCity: city,
    })
      .then((list) => {
        if (!cancelled) setElsewhereRemote(list)
      })
      .catch(() => {
        if (!cancelled) setElsewhereRemote(null)
      })
    return () => {
      cancelled = true
    }
  }, [needElsewhere, apiOnline, demoStats, elsewhereQuery, city])

  const elsewhereSuggestions: ElsewhereSuggestion[] = useMemo(() => {
    if (!needElsewhere) return []
    const source =
      apiOnline && !demoStats && elsewhereRemote
        ? elsewhereRemote
        : searchElsewhereLocal(elsewhereQuery, city)
    return buildElsewhereSuggestions(source)
  }, [needElsewhere, apiOnline, demoStats, elsewhereRemote, elsewhereQuery, city])

  const switchCityFromSearch = (next: string) => {
    if (next === city) return
    setCity(next)
    setNetwork('Все сети')
  }

  const pageHeader = (
    <header className="page-header discover-header">
      <div className="page-header-text">
        <h1 className="page-title">
          {fromSettings || fromHome ? 'Каталог залов' : 'Залы'}
        </h1>
        {fromSettings ? (
          <p className="muted discover-settings-lead">
            Выбери город и клуб — добавишь в «Мои залы», потом вернёшься в настройки.
          </p>
        ) : null}
        {fromHome ? (
          <p className="muted discover-settings-lead">
            Выбери клуб — откроется страница зала, там можно сделать его своим.
          </p>
        ) : null}
      </div>
    </header>
  )

  return (
    <main className="page discover-page">
      {fromSettings || fromHome ? (
        <div className="subpage-top">
          <button
            type="button"
            className="back-link"
            onClick={() => navigate(fromHome ? '/app' : '/app/settings')}
          >
            <ArrowLeft size={18} /> {fromHome ? 'Мой зал' : 'Настройки'}
          </button>
          {pageHeader}
        </div>
      ) : (
        pageHeader
      )}

      {/* 1 search → 2 city → 3 network — one job per row (Material / progressive disclosure) */}
      <div className="discover-toolbar">
        <label className="app-search">
          <Search size={16} aria-hidden />
          <input
            {...searchFieldProps}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Клуб, район или адрес"
            aria-label="Поиск клуба по названию или адресу"
          />
        </label>

        <CityCarousel
          value={city}
          onChange={(next) => {
            setCity(next)
            setQuery('')
          }}
          variant="compact"
          label="Город"
        />

        <div className="filter-row discover-networks" role="toolbar" aria-label="Сети">
          {NETWORKS.map((n) => (
            <button
              key={n}
              type="button"
              className={`chip ${network === n ? 'active' : ''}`}
              onClick={() => setNetwork(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="section-title">
        <h2 className="section-heading">Клубы</h2>
        <span className="muted">{waitingLiveCatalog ? '…' : gyms.length}</span>
      </div>

      <div className="card-list card-list--cards">
        {elsewhereSuggestions.length ? (
          <ElsewhereGymBanner
            suggestions={elsewhereSuggestions}
            onSwitchCity={switchCityFromSearch}
          />
        ) : null}
        {waitingLiveCatalog ? (
          <SoftLoader delayMs={SOFT_LOADER_DELAY_MS} label="Загружаем клубы…" />
        ) : gyms.length ? (
          gyms.map((gym, index) => (
            <GymCard
              key={gym.id}
              gym={gym}
              mine={isMemberOfGym(user, gym.id)}
              showDemoStats={demoStats}
              membersCount={liveStats[gym.id]?.membersCount}
              activeNow={liveStats[gym.id]?.activeNow}
              priority={index < 4}
              to={gymLink(gym.id)}
            />
          ))
        ) : (
          <div className="empty-copy" role="status">
            <p className="empty-copy-title">
              {elsewhereSuggestions.length
                ? 'В этом городе такого клуба нет'
                : 'Пока нет клубов'}
            </p>
            <p className="empty-copy-lead">
              {elsewhereSuggestions.length
                ? 'Смени город по подсказке выше'
                : 'Смени город или фильтр'}
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
