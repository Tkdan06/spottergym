import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'
import { SectionTitle } from '../components/SectionTitle'
import { useApp } from '../context/useApp'
import type { AdminAnalytics } from '../lib/adminAnalytics'
import { formatAdminDate } from '../lib/adminStats'
import { apiAdminFetchAnalytics } from '../lib/apiClient'
import './FeedbackPage.css'
import './AdminPlayersPage.css'

export function AdminGeographyPage() {
  const navigate = useNavigate()
  const { user, canViewUsers } = useApp()
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setAnalytics(await apiAdminFetchAnalytics())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить географию')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (!user?.isAdmin) return <Navigate to="/app/profile" replace />
  if (!canViewUsers) return <Navigate to="/app/admin" replace />

  return (
    <main className="page admin-page admin-players-page">
      <div className="subpage-top">
        <button type="button" className="back-link" onClick={() => navigate('/app/admin')}>
          <ArrowLeft size={18} /> Админка
        </button>

        <header className="admin-players-head">
          <div>
            <h1>География</h1>
            <p className="muted">
              Города и домашние залы
              {analytics ? ` · обновлено ${formatAdminDate(analytics.generatedAt)}` : ''}
              {loading ? ' · обновляем…' : ''}
            </p>
          </div>
          <button
            type="button"
            className="btn-icon-refresh"
            onClick={() => void load()}
            aria-label="Обновить"
            title="Обновить"
            disabled={loading}
          >
            <RefreshCw size={22} strokeWidth={2.4} />
          </button>
        </header>
      </div>

      {error ? <p className="admin-inline-error">{error}</p> : null}

      <section className="admin-stat-grid" aria-label="Сводка">
        <article className="admin-stat-card">
          <span className="muted">Городов</span>
          <strong>{analytics?.byCity.length ?? '—'}</strong>
          <p className="dim">С указанным городом в профиле</p>
        </article>
        <article className="admin-stat-card">
          <span className="muted">Залов</span>
          <strong>{analytics?.byGym.length ?? '—'}</strong>
          <p className="dim">С выбранным домашним залом</p>
        </article>
      </section>

      <section className="admin-breakdown">
        <div className="surface admin-breakdown-card">
          <SectionTitle>Города</SectionTitle>
          <ul>
            {(analytics?.byCity || []).slice(0, 40).map((c) => (
              <li key={c.city}>
                <span>{c.city}</span>
                <strong>{c.count}</strong>
              </li>
            ))}
            {!analytics?.byCity.length ? <li className="muted">Пока нет данных</li> : null}
          </ul>
        </div>
        <div className="surface admin-breakdown-card">
          <SectionTitle>Залы (домашние)</SectionTitle>
          <ul>
            {(analytics?.byGym || []).slice(0, 40).map((g) => (
              <li key={g.gymId}>
                <span>{g.label}</span>
                <strong>{g.count}</strong>
              </li>
            ))}
            {!analytics?.byGym.length ? <li className="muted">Пока нет данных</li> : null}
          </ul>
        </div>
      </section>
    </main>
  )
}
