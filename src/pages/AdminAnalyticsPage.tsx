import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { SectionTitle } from '../components/SectionTitle'
import { useApp } from '../context/useApp'
import {
  formatRetentionRate,
  retentionMap,
  type AdminAnalytics,
} from '../lib/adminAnalytics'
import { formatAdminDate, formatBytes, scanDeviceStorageHint } from '../lib/adminStats'
import { apiAdminFetchAnalytics } from '../lib/apiClient'
import './FeedbackPage.css'
import './AdminPlayersPage.css'

export function AdminAnalyticsPage() {
  const navigate = useNavigate()
  const { user, canViewUsers } = useApp()
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const device = scanDeviceStorageHint()

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setAnalytics(await apiAdminFetchAnalytics())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить аналитику')
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
          <h1>Аналитика</h1>
          <p className="muted">
            Сервер · МСК
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
          <span className="muted">Пользователи</span>
          <strong>{analytics?.users ?? '—'}</strong>
          <p className="dim">Онбординг {analytics?.onboarded ?? '—'}</p>
        </article>
        <article className="admin-stat-card">
          <span className="muted">DAU / MAU</span>
          <strong>
            {analytics?.dau ?? '—'} / {analytics?.mau ?? '—'}
          </strong>
          <p className="dim">Сегодня · 30 дней</p>
        </article>
        <article className="admin-stat-card">
          <span className="muted">В зале сейчас</span>
          <strong>{analytics?.activeNow ?? '—'}</strong>
          <p className="dim">Открытые чек-ины</p>
        </article>
        <article className="admin-stat-card">
          <span className="muted">Фото</span>
          <strong>{analytics?.totalPhotos ?? '—'}</strong>
          <p className="dim">
            У {analytics?.withPhotos ?? '—'} · {formatBytes(analytics?.photosBytes ?? 0)}
          </p>
        </article>
        <article className="admin-stat-card">
          <span className="muted">Пол / возраст</span>
          <strong>
            М {analytics?.byGender.male ?? '—'} · Ж {analytics?.byGender.female ?? '—'}
          </strong>
          <p className="dim">
            Средний возраст {analytics?.avgAge ?? '—'} · тренеров {analytics?.coaches ?? '—'}
          </p>
        </article>
        <article className="admin-stat-card">
          <span className="muted">Обращения</span>
          <strong>{analytics?.tickets.total ?? '—'}</strong>
          <p className="dim">
            Входящие {analytics?.tickets.incoming ?? '—'} · в работе{' '}
            {analytics?.tickets.in_progress ?? '—'}
          </p>
        </article>
      </section>

      <section className="surface admin-rr-panel">
        <SectionTitle>Retention Day-N</SectionTitle>
        <p className="dim admin-rr-hint">
          Классический Day-N по lastSeenAt. Среднее по завершённым когортам регистрации (окно 28
          дней).
        </p>
        <div className="admin-rr-grid">
          {[1, 3, 7, 14, 30].map((day) => {
            const row = rr.get(day)
            return (
              <article key={day} className="admin-stat-card admin-rr-card">
                <span className="muted">RR{day}</span>
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

      <section className="admin-breakdown">
        <div className="surface admin-breakdown-card">
          <SectionTitle>Города</SectionTitle>
          <ul>
            {(analytics?.byCity || []).slice(0, 20).map((c) => (
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
            {(analytics?.byGym || []).slice(0, 20).map((g) => (
              <li key={g.gymId}>
                <span>{g.label}</span>
                <strong>{g.count}</strong>
              </li>
            ))}
            {!analytics?.byGym.length ? <li className="muted">Пока нет данных</li> : null}
          </ul>
        </div>
      </section>

      <section className="surface admin-rr-panel">
        <SectionTitle>Память</SectionTitle>
        <div className="admin-stat-grid">
          <article className="admin-stat-card">
            <span className="muted">Фото (сервер)</span>
            <strong>{formatBytes(analytics?.photosBytes ?? 0)}</strong>
            <p className="dim">Сумма data URL в Postgres</p>
          </article>
          <article className="admin-stat-card">
            <span className="muted">localStorage (это устройство)</span>
            <strong>{formatBytes(device.bytes)}</strong>
            <p className="dim">
              {device.keys} ключей spotter.* · не сервер
            </p>
          </article>
        </div>
        <p className="dim" style={{ marginTop: 10 }}>
          Список пользователей и действия — в{' '}
          <Link to="/app/admin/players" className="text-link">
            Пользователях
          </Link>
          .
        </p>
      </section>
    </main>
  )
}
