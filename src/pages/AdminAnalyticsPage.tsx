import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'
import { SectionTitle } from '../components/SectionTitle'
import { useApp } from '../context/useApp'
import {
  formatRetentionRate,
  retentionMap,
  type AdminAnalytics,
} from '../lib/adminAnalytics'
import { formatAdminDate } from '../lib/adminStats'
import { apiAdminFetchAnalytics } from '../lib/apiClient'
import './FeedbackPage.css'
import './AdminPlayersPage.css'

const RR_DAYS = [1, 3, 7, 14, 30, 60] as const

export function AdminAnalyticsPage() {
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
      setError(err instanceof Error ? err.message : 'Не удалось загрузить retention')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (!user?.isAdmin) return <Navigate to="/app/profile" replace />
  if (!canViewUsers) return <Navigate to="/app/admin" replace />

  const rr = retentionMap(analytics)

  return (
    <main className="page admin-page admin-players-page">
      <button type="button" className="back-link" onClick={() => navigate('/app/admin')}>
        <ArrowLeft size={18} /> Админка
      </button>

      <header className="admin-players-head">
        <div>
          <h1>Retention</h1>
          <p className="muted">
            Активность и Day-N · МСК
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

      {error ? <p className="admin-inline-error">{error}</p> : null}

      <section className="admin-stat-grid" aria-label="Активность">
        <article className="admin-stat-card">
          <span className="muted">DAU / MAU</span>
          <strong>
            {analytics?.dau ?? '—'} / {analytics?.mau ?? '—'}
          </strong>
          <p className="dim">Заходили сегодня · 30 дней</p>
        </article>
        <article className="admin-stat-card">
          <span className="muted">В зале сегодня</span>
          <strong>{analytics?.checkedInToday ?? '—'}</strong>
          <p className="dim">
            Чекин · сейчас {analytics?.activeNow ?? '—'} · онбординг{' '}
            {analytics?.onboarded ?? '—'}
          </p>
        </article>
      </section>

      <section className="surface admin-rr-panel">
        <SectionTitle>Retention Day-N</SectionTitle>
        <p className="dim admin-rr-hint">
          Доля когорты регистрации с lastSeen в день D+N. Среднее по завершённым когортам (окно 28
          дней, МСК).
        </p>
        <div className="admin-rr-grid admin-rr-grid-full">
          {RR_DAYS.map((day) => {
            const row = rr.get(day)
            return (
              <article key={day} className="admin-stat-card admin-rr-card">
                <span className="muted">R{day}</span>
                <strong>{formatRetentionRate(row?.rate ?? null)}</strong>
                <p className="dim">
                  {row && row.cohorts > 0
                    ? `${row.cohorts} когорт · ${row.retained}/${row.cohortUsers}`
                    : 'мало данных'}
                </p>
              </article>
            )
          })}
        </div>
      </section>
    </main>
  )
}
