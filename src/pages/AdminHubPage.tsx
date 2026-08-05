import { ArrowLeft, Ban, BarChart3, MessagesSquare, Shield, Users } from 'lucide-react'
import { useMemo } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useApp } from '../context/useApp'
import { collectAdminOverview, formatBytes } from '../lib/adminStats'
import { permissionSummary } from '../lib/adminPermissions'
import './FeedbackPage.css'
import './AdminPlayersPage.css'

export function AdminHubPage() {
  const navigate = useNavigate()
  const {
    user,
    tickets,
    blockedEmails,
    canManageAdmins,
    canBlockUsers,
    canViewUsers,
    canHandleTickets,
  } = useApp()
  const overview = useMemo(() => collectAdminOverview(tickets), [tickets, blockedEmails])

  if (!user?.isAdmin) return <Navigate to="/app/profile" replace />

  const roleLabel = user.isMasterAdmin
    ? 'Главный админ · Bogdan'
    : `Админ · ${permissionSummary(user.adminPermissions, false)}`

  return (
    <main className="page admin-page">
      <button type="button" className="back-link" onClick={() => navigate('/app/profile')}>
        <ArrowLeft size={18} /> Профиль
      </button>
      <h1>Админка</h1>
      <p className="muted">
        {roleLabel} · {user.email}
      </p>
      <p className="muted" style={{ marginTop: 4 }}>
        Тикеты общие на сервере. Блокировки и реестр пользователей пока на этом устройстве
      </p>

      {canViewUsers ? (
        <section className="admin-stat-grid" aria-label="Краткая сводка">
          <article className="admin-stat-card">
            <span className="muted">Пользователи</span>
            <strong>{overview.realPlayers}</strong>
            <p className="dim">Онбординг {overview.onboarded} · сейчас в зале {overview.activeNow}</p>
          </article>
          <article className="admin-stat-card">
            <span className="muted">Память</span>
            <strong>{formatBytes(overview.storageBytes)}</strong>
            <p className="dim">
              Фото {overview.totalPhotos} · {formatBytes(overview.photosBytes)}
            </p>
          </article>
          <article className="admin-stat-card">
            <span className="muted">Обращения</span>
            <strong>{overview.tickets.incoming}</strong>
            <p className="dim">
              В работе {overview.tickets.in_progress} · архив {overview.tickets.closed}
            </p>
          </article>
          <article className="admin-stat-card">
            <span className="muted">Блокировки</span>
            <strong>{blockedEmails.length}</strong>
            <p className="dim">Аккаунтов на устройстве {overview.accountsOnDevice}</p>
          </article>
        </section>
      ) : null}

      <div className="admin-hub-grid">
        {canViewUsers ? (
          <>
            <Link to="/app/admin/players" className="admin-hub-card">
              <Users size={20} />
              <strong>Пользователи</strong>
              <p className="muted">
                Регистрация, город, зал, возраст · {overview.realPlayers} пользователей
              </p>
            </Link>
            <Link to="/app/admin/players" className="admin-hub-card">
              <BarChart3 size={20} />
              <strong>Статистика и память</strong>
              <p className="muted">
                Города, залы, фото · {formatBytes(overview.storageBytes)}
              </p>
            </Link>
          </>
        ) : null}
        {canHandleTickets ? (
          <Link to="/app/admin/tickets" className="admin-hub-card">
            <MessagesSquare size={20} />
            <strong>Обращения</strong>
            <p className="muted">
              Входящие {overview.tickets.incoming} · в работе {overview.tickets.in_progress}
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
            <p className="muted">Заблокировано email: {blockedEmails.length}</p>
          </Link>
        ) : null}
        <Link to="/app/feedback" className="admin-hub-card">
          <strong>Мои обращения</strong>
          <p className="muted">Как обычный пользователь</p>
        </Link>
      </div>

      <p className="dim" style={{ margin: 0, fontSize: '0.8rem' }}>
        Данные админки читаются из localStorage этого браузера. После появления сервера реестр станет
        общим для всех устройств.
      </p>
    </main>
  )
}
