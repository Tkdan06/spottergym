import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useApp } from '../context/useApp'
import {
  apiAdminFetchLanding,
  type LandingAnalytics,
  type LandingFunnelWindow,
} from '../lib/apiClient'
import { formatAdminDate } from '../lib/adminStats'
import './FeedbackPage.css'
import './AdminPlayersPage.css'

const EVENT_LABEL: Record<string, string> = {
  view: 'Визит /lp',
  scroll_50: 'Скролл 50%',
  scroll_90: 'Скролл 90%',
  cta_register: 'CTA регистрация',
  cta_login: 'CTA вход',
  register_view: 'Экран регистрации',
  register_success: 'Регистрация ок',
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function pct(value: number | null | undefined) {
  if (value == null) return '—'
  return `${value}%`
}

function FunnelBlock({ title, w }: { title: string; w?: LandingFunnelWindow }) {
  return (
    <section className="admin-stat-grid" aria-label={title}>
      <article className="admin-stat-card" style={{ gridColumn: '1 / -1' }}>
        <span className="muted">{title}</span>
        <strong>
          {w?.uniqueVisitors ?? '—'}{' '}
          <span className="muted" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
            уник. · {w?.views ?? '—'} визитов
          </span>
        </strong>
        <p className="dim">
          Скролл 50% {w?.scroll50Unique ?? '—'} · 90% {w?.scroll90Unique ?? '—'} · CTA рег.{' '}
          {w?.ctaRegisterUnique ?? '—'} · экран рег. {w?.registerViewUnique ?? '—'} · успех{' '}
          {w?.registerSuccessUnique ?? '—'}
        </p>
        <p className="dim">
          Воронка: визит→CTA {pct(w?.viewToCtaPct)} · CTA→рег. {pct(w?.ctaToRegisterPct)} ·
          визит→рег. {pct(w?.viewToRegisterPct)}
        </p>
        {w?.ctaByPlacement && Object.keys(w.ctaByPlacement).length ? (
          <p className="dim">
            CTA по блокам:{' '}
            {Object.entries(w.ctaByPlacement)
              .map(([k, v]) => `${k || '?'} ${v}`)
              .join(' · ')}
            {w.ctaLogin ? ` · вход ${w.ctaLogin}` : ''}
          </p>
        ) : null}
      </article>
    </section>
  )
}

export function AdminLandingPage() {
  const navigate = useNavigate()
  const { user, canViewUsers } = useApp()
  const [data, setData] = useState<LandingAnalytics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await apiAdminFetchLanding())
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
      <button type="button" className="back-link" onClick={() => navigate('/app/admin')}>
        <ArrowLeft size={18} /> Админка
      </button>

      <header className="admin-players-head">
        <div>
          <h1>Лендинг /lp</h1>
          <p className="muted">
            Воронка рекламы: визиты → скролл → CTA → регистрация
            {loading ? ' · обновляем…' : ''}
            {data ? ` · ${formatAdminDate(data.generatedAt)}` : ''}
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

      {error ? <p className="admin-inline-error">{error}</p> : null}

      <FunnelBlock title="24 часа" w={data?.last24h} />
      <FunnelBlock title="7 дней" w={data?.last7d} />
      <FunnelBlock title="30 дней" w={data?.last30d} />

      <section className="admin-players-section">
        <h2>Кампании (7 дней)</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          По utm_campaign из ссылки. Без метки — «(без utm_campaign)».
        </p>
        {!data?.campaigns7d.length ? (
          <p className="dim">Пока нет данных — открой /lp или добавь utm в рекламные ссылки.</p>
        ) : (
          <ul className="admin-players-list">
            {data.campaigns7d.map((row) => (
              <li key={row.campaign}>
                <div>
                  <strong>{row.campaign}</strong>
                  <p className="muted">
                    Визиты {row.views} · CTA {row.ctaRegister} · Рег. {row.registerSuccess}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="admin-players-section">
        <h2>Последние события</h2>
        {!data?.recent.length ? (
          <p className="dim">Пусто</p>
        ) : (
          <ul className="admin-players-list">
            {data.recent.map((row) => (
              <li key={row.id}>
                <div>
                  <strong>{EVENT_LABEL[row.name] || row.name}</strong>
                  <p className="muted">
                    {formatWhen(row.createdAt)}
                    {row.placement ? ` · ${row.placement}` : ''}
                    {row.utmCampaign ? ` · ${row.utmCampaign}` : ''}
                    {row.utmSource ? ` · ${row.utmSource}` : ''}
                    {` · ${row.visitorId}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
