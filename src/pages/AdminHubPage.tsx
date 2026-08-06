import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  Ban,
  BarChart3,
  MessagesSquare,
  Palette,
  RefreshCw,
  Shield,
  Users,
} from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { SectionTitle } from '../components/SectionTitle'
import { useApp } from '../context/useApp'
import {
  formatRetentionRate,
  retentionMap,
  type AdminAnalytics,
} from '../lib/adminAnalytics'
import { formatAdminDate, formatBytes } from '../lib/adminStats'
import { permissionSummary } from '../lib/adminPermissions'
import { apiAdminFetchAnalytics } from '../lib/apiClient'
import './FeedbackPage.css'
import './AdminPlayersPage.css'

export function AdminHubPage() {
  const navigate = useNavigate()
  const {
    user,
    blockedEmails,
    canManageAdmins,
    canBlockUsers,
    canViewUsers,
    canHandleTickets,
  } = useApp()
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!canViewUsers) return
    setLoading(true)
    setError('')
    try {
      setAnalytics(await apiAdminFetchAnalytics())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить метрики')
    } finally {
      setLoading(false)
    }
  }, [canViewUsers])

  useEffect(() => {
    void load()
  }, [load])

  if (!user?.isAdmin) return <Navigate to="/app/profile" replace />

  const roleLabel = user.isMasterAdmin
    ? 'Главный админ · Bogdan'
    : `Админ · ${permissionSummary(user.adminPermissions, false)}`

  const rr = retentionMap(analytics)

  return (
    <main className="page admin-page">
      <button type="button" className="back-link" onClick={() => navigate('/app/profile')}>
        <ArrowLeft size={18} /> Профиль
      </button>

      <header className="admin-players-head">
        <div>
          <h1 className="page-title">Админка</h1>
          <p className="muted">
            {roleLabel} · {user.email}
          </p>
          {analytics ? (
            <p className="dim" style={{ marginTop: 4 }}>
              Сервер · МСК · обновлено {formatAdminDate(analytics.generatedAt)}
              {loading ? ' · обновляем…' : ''}
            </p>
          ) : (
            <p className="dim" style={{ marginTop: 4 }}>
              {loading ? 'Загружаем метрики…' : 'Дашборд по данным сервера'}
            </p>
          )}
        </div>
        {canViewUsers ? (
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
        ) : null}
      </header>

      {error ? <p className="admin-inline-error">{error}</p> : null}

      {canViewUsers ? (
        <>
          <section className="admin-stat-grid" aria-label="Продукт">
            <article className="admin-stat-card">
              <span className="muted">Пользователи</span>
              <strong>{analytics?.users ?? '—'}</strong>
              <p className="dim">
                Онбординг {analytics?.onboarded ?? '—'} · в зале {analytics?.activeNow ?? '—'}
              </p>
            </article>
            <article className="admin-stat-card">
              <span className="muted">DAU</span>
              <strong>{analytics?.dau ?? '—'}</strong>
              <p className="dim">Активны сегодня (МСК)</p>
            </article>
            <article className="admin-stat-card">
              <span className="muted">MAU</span>
              <strong>{analytics?.mau ?? '—'}</strong>
              <p className="dim">Активны за 30 дней</p>
            </article>
            <article className="admin-stat-card">
              <span className="muted">Обращения</span>
              <strong>{analytics?.tickets.incoming ?? '—'}</strong>
              <p className="dim">
                В работе {analytics?.tickets.in_progress ?? '—'} · закрыто{' '}
                {analytics?.tickets.closed ?? '—'}
              </p>
            </article>
          </section>

          <section className="surface admin-rr-panel">
            <SectionTitle action={<Link to="/app/admin/analytics" className="muted">Подробнее</Link>}>
              Retention Day-N
            </SectionTitle>
            <p className="dim admin-rr-hint">
              Среднее по когортам регистрации (МСК): доля с lastSeen в день D+N
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

          <section className="admin-stat-grid" aria-label="Контент">
            <article className="admin-stat-card">
              <span className="muted">Фото на сервере</span>
              <strong>{analytics?.totalPhotos ?? '—'}</strong>
              <p className="dim">
                У {analytics?.withPhotos ?? '—'} чел. · {formatBytes(analytics?.photosBytes ?? 0)}
              </p>
            </article>
            <article className="admin-stat-card">
              <span className="muted">Блокировки</span>
              <strong>{analytics?.blockedEmails ?? blockedEmails.length}</strong>
              <p className="dim">Тренеров {analytics?.coaches ?? '—'}</p>
            </article>
          </section>
        </>
      ) : (
        <p className="muted">Нет права viewUsers — метрики скрыты. Доступны разделы по твоим правам.</p>
      )}

      <SectionTitle>Разделы</SectionTitle>
      <div className="admin-hub-grid">
        {canViewUsers ? (
          <>
            <Link to="/app/admin/players" className="admin-hub-card">
              <Users size={20} />
              <strong>Пользователи</strong>
              <p className="muted">
                Поиск, профиль, блок, сообщения · {analytics?.users ?? '—'} чел.
              </p>
            </Link>
            <Link to="/app/admin/analytics" className="admin-hub-card">
              <BarChart3 size={20} />
              <strong>Аналитика</strong>
              <p className="muted">Города, залы, фото, пол и возраст</p>
            </Link>
          </>
        ) : null}
        {canHandleTickets ? (
          <Link to="/app/admin/tickets" className="admin-hub-card">
            <MessagesSquare size={20} />
            <strong>Обращения</strong>
            <p className="muted">
              Входящие {analytics?.tickets.incoming ?? '—'} · в работе{' '}
              {analytics?.tickets.in_progress ?? '—'}
            </p>
          </Link>
        ) : null}
        {canManageAdmins ? (
          <Link to="/app/admin/users" className="admin-hub-card">
            <Shield size={20} />
            <strong>Админы и права</strong>
            <p className="muted">Назначать админов, полные или ограниченные права</p>
          </Link>
        ) : null}
        {canBlockUsers ? (
          <Link to="/app/admin/users#block" className="admin-hub-card">
            <Ban size={20} />
            <strong>Блокировки</strong>
            <p className="muted">Заблокировано email: {analytics?.blockedEmails ?? blockedEmails.length}</p>
          </Link>
        ) : null}
        <Link to="/app/admin/ui" className="admin-hub-card">
          <Palette size={20} />
          <strong>UI kit</strong>
          <p className="muted">Типографика, кнопки, цвета — эталон для новых экранов</p>
        </Link>
        <Link to="/app/feedback" className="admin-hub-card">
          <strong>Мои обращения</strong>
          <p className="muted">Как обычный пользователь</p>
        </Link>
      </div>
    </main>
  )
}
