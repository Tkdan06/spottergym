import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'
import { SectionTitle } from '../components/SectionTitle'
import { useApp } from '../context/useApp'
import type { AdminAnalytics } from '../lib/adminAnalytics'
import { formatAdminDate, formatBytes, scanDeviceStorageHint } from '../lib/adminStats'
import { apiAdminFetchAnalytics } from '../lib/apiClient'
import './FeedbackPage.css'
import './AdminPlayersPage.css'

export function AdminStoragePage() {
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
      setError(err instanceof Error ? err.message : 'Не удалось загрузить память')
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
      <button type="button" className="back-link" onClick={() => navigate('/app/admin')}>
        <ArrowLeft size={18} /> Админка
      </button>

      <header className="admin-players-head">
        <div>
          <h1>Память</h1>
          <p className="muted">
            Фото на сервере и локальный кэш
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

      <section className="surface admin-rr-panel">
        <SectionTitle>Сервер</SectionTitle>
        <div className="admin-stat-grid">
          <article className="admin-stat-card">
            <span className="muted">Фото</span>
            <strong>{analytics?.totalPhotos ?? '—'}</strong>
            <p className="dim">У {analytics?.withPhotos ?? '—'} пользователей</p>
          </article>
          <article className="admin-stat-card">
            <span className="muted">Объём фото</span>
            <strong>{formatBytes(analytics?.photosBytes ?? 0)}</strong>
            <p className="dim">Сумма data URL в Postgres</p>
          </article>
          <article className="admin-stat-card">
            <span className="muted">Среднее на человека</span>
            <strong>
              {analytics && analytics.withPhotos > 0
                ? formatBytes(Math.round(analytics.photosBytes / analytics.withPhotos))
                : '—'}
            </strong>
            <p className="dim">Только у тех, у кого есть фото</p>
          </article>
        </div>
      </section>

      <section className="surface admin-rr-panel">
        <SectionTitle>Это устройство</SectionTitle>
        <div className="admin-stat-grid">
          <article className="admin-stat-card">
            <span className="muted">localStorage</span>
            <strong>{formatBytes(device.bytes)}</strong>
            <p className="dim">
              {device.keys} ключей spotter.* · не сервер
            </p>
          </article>
        </div>
      </section>
    </main>
  )
}
