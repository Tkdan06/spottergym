import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  BarChart3,
  Bell,
  HardDrive,
  KeyRound,
  MapPin,
  Megaphone,
  MessagesSquare,
  Palette,
  Power,
  RefreshCw,
  Shield,
  UserPlus,
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
import {
  apiAdminEmergencyShutdown,
  apiAdminFetchAnalytics,
} from '../lib/apiClient'
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
    canMessageUsers,
  } = useApp()
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [killPassword, setKillPassword] = useState('')
  const [killConfirm, setKillConfirm] = useState('')
  const [killBusy, setKillBusy] = useState(false)
  const [killError, setKillError] = useState('')
  const [killOpen, setKillOpen] = useState(false)

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
  const blockedCount = analytics?.blockedEmails ?? blockedEmails.length

  return (
    <main className="page admin-page">
      <div className="subpage-top">
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
      </div>

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
              <p className="dim">
                Фото {analytics?.totalPhotos ?? '—'} · блок {blockedCount}
              </p>
            </article>
            <Link to="/app/admin/players?filter=seenToday" className="admin-stat-card">
              <span className="muted">DAU / MAU</span>
              <strong>
                {analytics?.dau ?? '—'} / {analytics?.mau ?? '—'}
              </strong>
              <p className="dim">Заходили сегодня · 30 дней (МСК)</p>
            </Link>
            <Link to="/app/admin/players?filter=checkedInToday" className="admin-stat-card">
              <span className="muted">В зале сегодня</span>
              <strong>{analytics?.checkedInToday ?? '—'}</strong>
              <p className="dim">
                Нажали «Я в зале» · сейчас {analytics?.activeNow ?? '—'}
              </p>
            </Link>
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
            <SectionTitle
              action={
                <Link to="/app/admin/analytics" className="section-action">
                  Подробнее
                </Link>
              }
            >
              Retention
            </SectionTitle>
            <p className="dim admin-rr-hint">
              Day-N по lastSeen (МСК). Полный ряд — в подробностях.
            </p>
            <div className="admin-rr-grid admin-rr-grid-compact">
              {[1, 7].map((day) => {
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

          <Link to="/app/admin/password-resets" className="surface admin-inline-metric">
            <div>
              <strong>Сброс пароля</strong>
              <p className="dim">
                24ч {analytics?.passwordResets?.last24h ?? '—'} · 7д{' '}
                {analytics?.passwordResets?.last7d ?? '—'} · сменили{' '}
                {analytics?.passwordResets?.completed7d ?? '—'} · email{' '}
                {analytics?.passwordResets?.uniqueEmails7d ?? '—'}
                {analytics?.passwordResets && analytics.passwordResets.noAccount7d > 0
                  ? ` · нет аккаунта ${analytics.passwordResets.noAccount7d}`
                  : ''}
              </p>
            </div>
            <span className="muted">Подробнее</span>
          </Link>
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
                Поиск, профиль, блок · {analytics?.users ?? '—'} чел. · блок {blockedCount}
              </p>
            </Link>
            <Link to="/app/admin/players?filter=seenToday" className="admin-hub-card">
              <Users size={20} />
              <strong>Заходили сегодня</strong>
              <p className="muted">
                DAU {analytics?.dau ?? '—'} · любой вход в аккаунт (не только чекин)
              </p>
            </Link>
            <Link to="/app/admin/players?filter=checkedInToday" className="admin-hub-card">
              <Users size={20} />
              <strong>В зале сегодня</strong>
              <p className="muted">
                Чекин {analytics?.checkedInToday ?? '—'} · сейчас в зале{' '}
                {analytics?.activeNow ?? '—'}
              </p>
            </Link>
            <Link to="/app/admin/analytics" className="admin-hub-card">
              <BarChart3 size={20} />
              <strong>Retention</strong>
              <p className="muted">DAU / MAU и полный ряд R1–R60</p>
            </Link>
            <Link to="/app/admin/geography" className="admin-hub-card">
              <MapPin size={20} />
              <strong>География</strong>
              <p className="muted">
                Города и домашние залы · {analytics?.byCity.length ?? '—'} городов
              </p>
            </Link>
            <Link to="/app/admin/storage" className="admin-hub-card">
              <HardDrive size={20} />
              <strong>Память</strong>
              <p className="muted">
                Фото {analytics?.totalPhotos ?? '—'} · {formatBytes(analytics?.photosBytes ?? 0)}
              </p>
            </Link>
            <Link to="/app/admin/password-resets" className="admin-hub-card">
              <KeyRound size={20} />
              <strong>Сброс пароля</strong>
              <p className="muted">
                7д {analytics?.passwordResets?.last7d ?? '—'} запросов · спам и забывчивость
              </p>
            </Link>
            <Link to="/app/admin/referrals" className="admin-hub-card">
              <UserPlus size={20} />
              <strong>Рефералы</strong>
              <p className="muted">Круг Spotter · кто кого · статусы Друг→GymBro Spotter</p>
            </Link>
            <Link to="/app/admin/landing" className="admin-hub-card">
              <Megaphone size={20} />
              <strong>Лендинг /lp</strong>
              <p className="muted">Визиты, скролл, CTA и регистрации с рекламы</p>
            </Link>
          </>
        ) : null}
        {canMessageUsers ? (
          <Link to="/app/admin/broadcasts" className="admin-hub-card">
            <Bell size={20} />
            <strong>Рассылка</strong>
            <p className="muted">Сообщение всем в колокольчик · доставка и прочтения</p>
          </Link>
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
        {canManageAdmins || canBlockUsers ? (
          <Link to="/app/admin/users" className="admin-hub-card">
            <Shield size={20} />
            <strong>{canManageAdmins ? 'Админы и права' : 'Блокировки'}</strong>
            <p className="muted">
              {canManageAdmins
                ? `Права админов · блок email · ${blockedCount}`
                : `Заблокировано email: ${blockedCount}`}
            </p>
          </Link>
        ) : null}
        {canViewUsers || canManageAdmins ? (
          <Link to="/app/admin/ui" className="admin-hub-card">
            <Palette size={20} />
            <strong>UI kit</strong>
            <p className="muted">Типографика, кнопки, цвета — эталон для новых экранов</p>
          </Link>
        ) : null}
        <Link to="/app/feedback" className="admin-hub-card">
          <strong>Мои обращения</strong>
          <p className="muted">Как обычный пользователь</p>
        </Link>
      </div>

      {user.isMasterAdmin ? (
        <section className="surface admin-emergency" aria-label="Аварийное отключение">
          <div className="admin-emergency-head">
            <Power size={20} aria-hidden />
            <div>
              <h2>Аварийное отключение</h2>
              <p className="muted">
                Выключает API на сервере. Сайт станет недоступен, пока главный админ не включит
                снова (email + пароль на экране офлайна).
              </p>
            </div>
          </div>
          {!killOpen ? (
            <button
              type="button"
              className="btn btn-danger admin-emergency-btn"
              onClick={() => {
                setKillOpen(true)
                setKillError('')
                setKillPassword('')
                setKillConfirm('')
              }}
            >
              Выключить Spotter
            </button>
          ) : (
            <form
              className="admin-emergency-form"
              onSubmit={(e) => {
                e.preventDefault()
                setKillError('')
                if (killConfirm.trim() !== 'SHUTDOWN') {
                  setKillError('Введи SHUTDOWN для подтверждения')
                  return
                }
                const ok = window.confirm(
                  'Точно выключить весь сервис? Пользователи потеряют доступ сразу.',
                )
                if (!ok) return
                setKillBusy(true)
                void apiAdminEmergencyShutdown(killPassword)
                  .then(() => {
                    setKillError('')
                    window.location.reload()
                  })
                  .catch((err: unknown) => {
                    setKillError(err instanceof Error ? err.message : 'Не удалось выключить')
                  })
                  .finally(() => setKillBusy(false))
              }}
            >
              <label>
                Твой пароль
                <input
                  type="password"
                  autoComplete="current-password"
                  value={killPassword}
                  onChange={(e) => setKillPassword(e.target.value)}
                  required
                  disabled={killBusy}
                />
              </label>
              <label>
                Напиши SHUTDOWN
                <input
                  type="text"
                  autoComplete="off"
                  value={killConfirm}
                  onChange={(e) => setKillConfirm(e.target.value)}
                  placeholder="SHUTDOWN"
                  required
                  disabled={killBusy}
                />
              </label>
              {killError ? <p className="feedback-error">{killError}</p> : null}
              <div className="admin-emergency-actions">
                <button type="submit" className="btn btn-danger" disabled={killBusy}>
                  {killBusy ? 'Отключаем…' : 'Подтвердить отключение'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={killBusy}
                  onClick={() => {
                    setKillOpen(false)
                    setKillPassword('')
                    setKillConfirm('')
                    setKillError('')
                  }}
                >
                  Отмена
                </button>
              </div>
            </form>
          )}
        </section>
      ) : null}
    </main>
  )
}
