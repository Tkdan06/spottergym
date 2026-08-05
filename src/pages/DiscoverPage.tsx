import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { CityCarousel } from '../components/CityCarousel'
import { GymCard } from '../components/GymCard'
import { useApp } from '../context/useApp'
import { GYMS, NETWORKS } from '../data/mock'
import { apiFetchGyms } from '../lib/apiClient'
import { isDemoAccount } from '../lib/demoAccount'
import { buildRealGymStatsMap } from '../lib/gymStats'
import { searchFieldProps } from '../lib/inputAttrs'
import { isMemberOfGym } from '../lib/userGyms'
import type { Gym } from '../types'
import './DiscoverPage.css'

export function DiscoverPage() {
  const { user, apiOnline } = useApp()
  const [city, setCity] = useState(user?.city || 'Москва')
  const [network, setNetwork] = useState<(typeof NETWORKS)[number]>('Все сети')
  const [query, setQuery] = useState('')
  const [remoteGyms, setRemoteGyms] = useState<Gym[] | null>(null)

  const demoStats = isDemoAccount(user?.email)

  useEffect(() => {
    if (!apiOnline || demoStats) {
      setRemoteGyms(null)
      return
    }
    let cancelled = false
    void apiFetchGyms({ city, network, q: query || undefined })
      .then((list) => {
        if (!cancelled) setRemoteGyms(list)
      })
      .catch(() => {
        if (!cancelled) setRemoteGyms(null)
      })
    return () => {
      cancelled = true
    }
  }, [apiOnline, demoStats, city, network, query])

  const gyms = useMemo(() => {
    if (remoteGyms) {
      return [...remoteGyms].sort((a, b) => {
        const am = isMemberOfGym(user, a.id) ? 0 : 1
        const bm = isMemberOfGym(user, b.id) ? 0 : 1
        if (am !== bm) return am - bm
        return a.name.localeCompare(b.name, 'ru')
      })
    }
    const q = query.toLowerCase().trim()
    return GYMS.filter((g) => {
      if (g.city !== city) return false
      if (network !== 'Все сети' && g.network !== network) return false
      if (!q) return true
      return `${g.name} ${g.network} ${g.district} ${g.address}`.toLowerCase().includes(q)
    }).sort((a, b) => {
      const am = isMemberOfGym(user, a.id) ? 0 : 1
      const bm = isMemberOfGym(user, b.id) ? 0 : 1
      if (am !== bm) return am - bm
      return a.name.localeCompare(b.name, 'ru')
    })
  }, [remoteGyms, city, network, query, user])

  const liveStats = useMemo(() => {
    if (demoStats) return {}
    if (remoteGyms) {
      const map: Record<string, { membersCount: number; activeNow: number }> = {}
      for (const g of remoteGyms) {
        map[g.id] = { membersCount: g.membersCount, activeNow: g.activeNow }
      }
      return map
    }
    return buildRealGymStatsMap(
      gyms.map((g) => g.id),
      user,
    )
  }, [demoStats, remoteGyms, gyms, user])

  return (
    <main className="page discover-page">
      <header className="page-header discover-header">
        <h1 className="page-title">Залы</h1>
      </header>

      {/* 1 search → 2 city → 3 network — one job per row (Material / progressive disclosure) */}
      <div className="discover-toolbar">
        <label className="discover-search">
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
        <h2>Клубы</h2>
        <span className="muted">{gyms.length}</span>
      </div>

      <div className="card-list">
        {gyms.length ? (
          gyms.map((gym) => (
            <GymCard
              key={gym.id}
              gym={gym}
              mine={isMemberOfGym(user, gym.id)}
              showDemoStats={demoStats}
              membersCount={liveStats[gym.id]?.membersCount}
              activeNow={liveStats[gym.id]?.activeNow}
              to={`/app/gym/${gym.id}`}
            />
          ))
        ) : (
          <div className="empty-copy" role="status">
            <p className="empty-copy-title">Пока нет клубов</p>
            <p className="empty-copy-lead">Смени город или фильтр</p>
          </div>
        )}
      </div>
    </main>
  )
}
