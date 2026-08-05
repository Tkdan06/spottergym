import { type FormEvent, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useApp } from '../context/useApp'
import { MASTER_ADMIN_EMAIL } from '../lib/adminConfig'
import './FeedbackPage.css'

export function AdminUsersPage() {
  const navigate = useNavigate()
  const {
    user,
    adminDirectory,
    blockedEmails,
    canManageAdmins,
    adminSetUserAdmin,
    adminSetCanGrant,
    adminBlockEmail,
    adminUnblockEmail,
  } = useApp()
  const [search, setSearch] = useState('')
  const [blockEmail, setBlockEmail] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    return adminDirectory
      .filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.includes(q))
      .sort((a, b) => Number(b.isAdmin) - Number(a.isAdmin) || a.name.localeCompare(b.name, 'ru'))
  }, [adminDirectory, search])

  if (!user?.isAdmin) return <Navigate to="/app/profile" replace />

  const onBlock = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      if (!blockEmail.trim()) return
      if (blockEmail.trim().toLowerCase() === MASTER_ADMIN_EMAIL) {
        throw new Error('Нельзя блокировать главного админа')
      }
      adminBlockEmail(blockEmail)
      setBlockEmail('')
      setNotice('Email заблокирован')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    }
  }

  return (
    <main className="page admin-page">
      <button type="button" className="back-link" onClick={() => navigate('/app/admin')}>
        <ArrowLeft size={18} /> Админка
      </button>
      <h1>Админы и блокировки</h1>
      <p className="muted">
        Главный: {MASTER_ADMIN_EMAIL}. {canManageAdmins ? 'Можешь назначать админов.' : 'Только просмотр и блокировки.'}
      </p>

      <input
        className="search-input"
        placeholder="Поиск по имени или email"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="feedback-ticket-list">
        {list.map((entry) => (
          <div key={entry.id} className="admin-user-row">
            <div>
              <strong>
                {entry.name}
                {entry.isMasterAdmin ? ' · главный' : entry.isAdmin ? ' · админ' : ''}
              </strong>
              <p className="muted">{entry.email}</p>
            </div>
            {canManageAdmins && !entry.isMasterAdmin ? (
              <div className="actions">
                <button
                  type="button"
                  className={`chip ${entry.isAdmin ? 'coach' : ''}`}
                  onClick={() => {
                    try {
                      adminSetUserAdmin(entry.id, !entry.isAdmin)
                      setNotice(entry.isAdmin ? 'Админ снят' : 'Админ назначен')
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Ошибка')
                    }
                  }}
                >
                  {entry.isAdmin ? 'Снять админа' : 'Сделать админом'}
                </button>
                {user.isMasterAdmin && entry.isAdmin ? (
                  <button
                    type="button"
                    className={`chip ${entry.canGrantAdmin ? 'active' : ''}`}
                    onClick={() => {
                      try {
                        adminSetCanGrant(entry.id, !entry.canGrantAdmin)
                        setNotice('Право назначения обновлено')
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Ошибка')
                      }
                    }}
                  >
                    {entry.canGrantAdmin ? 'Может назначать' : 'Не может назначать'}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <section id="block" className="surface block-form">
        <h2>Блокировка по email</h2>
        <p className="muted">Заблокированный email не сможет войти или зарегистрироваться.</p>
        <form onSubmit={onBlock} className="feedback-actions">
          <input
            type="email"
            value={blockEmail}
            onChange={(e) => setBlockEmail(e.target.value)}
            placeholder="user@example.com"
            required
          />
          <button type="submit" className="btn btn-danger btn-block">
            Заблокировать
          </button>
        </form>
        <div className="chip-grid">
          {blockedEmails.length ? (
            blockedEmails.map((email) => (
              <button
                key={email}
                type="button"
                className="chip"
                onClick={() => {
                  adminUnblockEmail(email)
                  setNotice('Email разблокирован')
                }}
              >
                {email} · снять
              </button>
            ))
          ) : (
            <p className="muted">Список блокировок пуст</p>
          )}
        </div>
      </section>

      {notice ? <p className="feedback-notice">{notice}</p> : null}
      {error ? <p className="feedback-error">{error}</p> : null}
    </main>
  )
}
