import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'
import { SectionTitle } from '../components/SectionTitle'
import { SubpageHeader } from '../components/SubpageHeader'
import { useApp } from '../context/useApp'
import { apiAdminFetchOps, type OpsHealth } from '../lib/apiClient'
import './FeedbackPage.css'
import './AdminPlayersPage.css'

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function AdminOpsPage() {
  const navigate = useNavigate()
  const { user, canViewUsers } = useApp()
  const [data, setData] = useState<OpsHealth | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await apiAdminFetchOps())
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

  return (
    <main className="page admin-page admin-players-page">
      <SubpageHeader
        title="Работоспособность"
        onBack={() => navigate('/app/admin')}
        action={
          <button
            type="button"
            className="btn-icon-refresh"
            onClick={() => void load()}
            aria-label="Обновить"
            disabled={loading}
          >
            <RefreshCw size={22} strokeWidth={2.4} />
          </button>
        }
      />
      <p className="muted">
        Что сломалось у человека за сутки. Сканы чужих URL (.env, swagger) не считаем
        {loading ? ' · обновляем…' : ''}
      </p>

      {error ? <p className="admin-inline-error">{error}</p> : null}

      <section className="admin-stat-grid" aria-label="Сводка">
        <article className="admin-stat-card">
          <span className="muted">Ошибки за 24ч</span>
          <strong>{data?.last24h ?? '—'}</strong>
          <p className="dim">Живые маршруты, без входа и ботов</p>
        </article>
        <article className="admin-stat-card">
          <span className="muted">Падения сервера</span>
          <strong>{data?.last5xx24h ?? '—'}</strong>
          <p className="dim">5xx — смотреть сразу</p>
        </article>
        <article className="admin-stat-card">
          <span className="muted">Типов сбоев</span>
          <strong>{data?.groups.length ?? '—'}</strong>
          <p className="dim">Сгруппировано по запросу</p>
        </article>
      </section>

      <SectionTitle>Что ломается</SectionTitle>
      {data && data.groups.length === 0 ? (
        <p className="muted">
          За сутки ошибок приложения нет. Случайный шум сканеров сюда не попадает.
        </p>
      ) : (
        <div className="card-list card-list--cards">
          {data?.groups.map((row) => (
            <article key={`${row.method}-${row.path}-${row.status}-${row.code}`} className="surface">
              <p className="page-kicker">
                {row.count}× · {row.method} {row.path} · {row.status}
              </p>
              <strong>{row.title}</strong>
              <p className="muted" style={{ marginTop: 6 }}>
                {row.meaning}
              </p>
              {row.sampleMessage ? (
                <p className="dim" style={{ marginTop: 8 }}>
                  Ответ сервера: «{row.sampleMessage}»
                </p>
              ) : null}
              <p className="dim" style={{ marginTop: 6 }}>
                Последний раз {formatWhen(row.lastAt)}
              </p>
            </article>
          ))}
        </div>
      )}

      <SectionTitle>Последние случаи</SectionTitle>
      {data && data.recent.length === 0 ? (
        <p className="muted">Пока пусто.</p>
      ) : (
        <div className="card-list">
          {data?.recent.map((row) => (
            <article key={row.id} className="surface" style={{ padding: '12px 14px' }}>
              <p>
                <strong>{row.title}</strong>
                <span className="dim"> · {formatWhen(row.createdAt)}</span>
              </p>
              <p className="dim">
                {row.method} {row.path} · {row.status}
                {row.userId ? ` · user ${row.userId.slice(0, 8)}` : ''}
              </p>
              {row.message ? <p className="muted">{row.message}</p> : null}
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
