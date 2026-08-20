import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { SectionTitle } from '../components/SectionTitle'
import { useApp } from '../context/useApp'
import {
  apiAdminFetchPasswordResets,
  type PasswordResetAnalytics,
} from '../lib/apiClient'
import { formatAdminDate } from '../lib/adminStats'
import './FeedbackPage.css'
import './AdminPlayersPage.css'

const STATUS_LABEL: Record<string, string> = {
  sent: 'Письмо отправлено',
  completed: 'Пароль сменён',
  no_account: 'Нет аккаунта',
  blocked: 'Email в блок-листе',
  send_failed: 'Ошибка отправки',
  rate_limited: 'Лимит',
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function AdminPasswordResetsPage() {
  const navigate = useNavigate()
  const { user, canViewUsers } = useApp()
  const [data, setData] = useState<PasswordResetAnalytics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await apiAdminFetchPasswordResets())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (!user?.isAdmin) return <Navigate to="/app/profile" replace />
  if (!canViewUsers) return <Navigate to="/app/admin" replace />

  const s = data?.summary

  return (
    <main className="page admin-page admin-players-page">
      <div className="subpage-top">
        <button type="button" className="back-link" onClick={() => navigate('/app/admin')}>
          <ArrowLeft size={18} /> Админка
        </button>

        <header className="admin-players-head">
          <div>
            <h1>Сброс пароля</h1>
            <p className="muted">
              Кто запрашивал восстановление · спам и забывчивость
              {loading ? ' · обновляем…' : ''}
            </p>
          </div>
          <button
            type="button"
            className="btn-icon-refresh"
            onClick={() => void load()}
            aria-label="Обновить"
            disabled={loading}
          >
            <RefreshCw size={22} strokeWidth={2.4} />
          </button>
        </header>
      </div>

      {error ? <p className="admin-inline-error">{error}</p> : null}

      <section className="admin-stat-grid" aria-label="Сводка">
        <article className="admin-stat-card">
          <span className="muted">24 часа</span>
          <strong>{s?.last24h ?? '—'}</strong>
          <p className="dim">Всех запросов</p>
        </article>
        <article className="admin-stat-card">
          <span className="muted">7 дней</span>
          <strong>{s?.last7d ?? '—'}</strong>
          <p className="dim">
            {s ? `${s.uniqueEmails7d} email · ${s.completed7d} сменили` : '—'}
          </p>
        </article>
        <article className="admin-stat-card">
          <span className="muted">30 дней</span>
          <strong>{s?.last30d ?? '—'}</strong>
          <p className="dim">
            Нет аккаунта (7д): {s?.noAccount7d ?? '—'}
          </p>
        </article>
      </section>

      <section className="admin-breakdown">
        <div className="surface admin-breakdown-card">
          <SectionTitle>Частые запросы · 30 дней</SectionTitle>
          <p className="dim admin-rr-hint">Повторы с одного email — сигнал спама или проблем со входом</p>
          <ul>
            {(data?.topEmails || []).map((row) => (
              <li key={row.email} className="admin-reset-row">
                <div className="admin-reset-row-main">
                  {row.userId ? (
                    <Link to={`/app/user/${row.userId}`} className="text-link">
                      {row.name || row.email}
                    </Link>
                  ) : (
                    <span>{row.email}</span>
                  )}
                  <span className="dim admin-reset-meta">
                    {row.username ? `@${row.username} · ` : ''}
                    {row.email}
                    {row.lastAt ? ` · ${formatWhen(row.lastAt)}` : ''}
                  </span>
                </div>
                <strong>{row.count}</strong>
              </li>
            ))}
            {!data?.topEmails.length ? <li className="muted">Пока нет запросов</li> : null}
          </ul>
        </div>

        <div className="surface admin-breakdown-card">
          <SectionTitle>Статусы · 7 дней</SectionTitle>
          <ul>
            {Object.entries(data?.status7d || {}).map(([status, count]) => (
              <li key={status}>
                <span>{STATUS_LABEL[status] || status}</span>
                <strong>{count}</strong>
              </li>
            ))}
            {!Object.keys(data?.status7d || {}).length ? (
              <li className="muted">Пока нет данных</li>
            ) : null}
          </ul>
        </div>
      </section>

      <section className="surface admin-rr-panel">
        <SectionTitle>Лента событий</SectionTitle>
        <p className="dim admin-rr-hint">Последние запросы · время сервера</p>
        <ul className="admin-reset-feed">
          {(data?.recent || []).map((e) => (
            <li key={e.id}>
              <div className="admin-reset-feed-top">
                <strong>{STATUS_LABEL[e.status] || e.status}</strong>
                <span className="dim">{formatWhen(e.createdAt)}</span>
              </div>
              <p className="admin-reset-feed-email">
                {e.userId ? (
                  <Link to={`/app/user/${e.userId}`} className="text-link">
                    {e.name || e.email}
                  </Link>
                ) : (
                  e.email
                )}
                {e.name ? <span className="dim"> · {e.email}</span> : null}
              </p>
              <p className="dim admin-reset-feed-ip">
                {e.ip ? `IP ${e.ip}` : 'IP —'}
                {e.createdAt ? ` · ${formatAdminDate(e.createdAt)}` : ''}
              </p>
            </li>
          ))}
          {!data?.recent.length ? <li className="muted">Пока пусто</li> : null}
        </ul>
      </section>
    </main>
  )
}
