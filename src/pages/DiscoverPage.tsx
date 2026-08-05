import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { CityCarousel } from '../components/CityCarousel'
import { GymCard } from '../components/GymCard'
import { useApp } from '../context/useApp'
import { GYMS, NETWORKS } from '../data/mock'
import { isMemberOfGym } from '../lib/userGyms'
import './DiscoverPage.css'

export function DiscoverPage() {
  const { user } = useApp()
  const [city, setCity] = useState(user?.city || 'Москва')
  const [network, setNetwork] = useState<(typeof NETWORKS)[number]>('Все сети')
  const [query, setQuery] = useState('')

  const gyms = useMemo(() => {
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
  }, [city, network, query, user])

  return (
    <main className="page discover-page">
      <header className="discover-header">
        <h1>Залы</h1>
        <p className="muted">Город, поиск и сети — дальше список клубов.</p>
      </header>

      <div className="discover-filters">
        <CityCarousel
          value={city}
          onChange={(next) => {
            setCity(next)
            setQuery('')
          }}
          label="Город"
          afterStrip={
            <label className="discover-search">
              <Search size={16} aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Клуб, район или адрес"
                aria-label="Поиск клуба по названию или адресу"
              />
            </label>
          }
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
              to={`/app/gym/${gym.id}`}
            />
          ))
        ) : (
          <div className="empty-state">В этом городе нет клубов по выбранному фильтру.</div>
        )}
      </div>
    </main>
  )
}
