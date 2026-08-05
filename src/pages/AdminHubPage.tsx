import { ArrowLeft, MessagesSquare, Shield, Ban } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useApp } from '../context/useApp'
import { ticketCounts } from '../lib/feedback'
import './FeedbackPage.css'

export function AdminHubPage() {
  const navigate = useNavigate()
  const { user, tickets, blockedEmails, canManageAdmins } = useApp()
  if (!user?.isAdmin) return <Navigate to="/app/profile" replace />

  const counts = ticketCounts(tickets)

  return (
    <main className="page admin-page">
      <button type="button" className="back-link" onClick={() => navigate('/app/profile')}>
        <ArrowLeft size={18} /> Профиль
      </button>
      <h1>Админка</h1>
      <p className="muted">
        {user.isMasterAdmin ? 'Главный админ · Bogdan' : 'Администратор Spotter'} · {user.email}
      </p>

      <div className="admin-hub-grid">
        <Link to="/app/admin/tickets" className="admin-hub-card">
          <MessagesSquare size={20} />
          <strong>Обращения</strong>
          <p className="muted">
            Входящие {counts.incoming} · в работе {counts.in_progress} · архив {counts.closed}
          </p>
        </Link>
        {canManageAdmins ? (
          <Link to="/app/admin/users" className="admin-hub-card">
            <Shield size={20} />
            <strong>Администраторы</strong>
            <p className="muted">Назначать и снимать админов</p>
          </Link>
        ) : null}
        <Link to="/app/admin/users#block" className="admin-hub-card">
          <Ban size={20} />
          <strong>Блокировки</strong>
          <p className="muted">Заблокировано email: {blockedEmails.length}</p>
        </Link>
        <Link to="/app/feedback" className="admin-hub-card">
          <strong>Мои обращения</strong>
          <p className="muted">Как обычный пользователь</p>
        </Link>
      </div>
    </main>
  )
}
