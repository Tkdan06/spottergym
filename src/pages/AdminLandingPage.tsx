import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'
import { SubpageHeader } from '../components/SubpageHeader'
import { useApp } from '../context/useApp'
import {
  apiAdminFetchLanding,
  type LandingAnalytics,
  type LandingFunnelWindow,
  type LandingSearchWindow,
} from '../lib/apiClient'
import { formatAdminDate } from '../lib/adminStats'
import { searchEngineLabel } from '../lib/searchAttribution'
import './FeedbackPage.css'
import './AdminPlayersPage.css'

const EVENT_LABEL: Record<string, string> = {
  view: 'Визит',
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

function SearchBlock({ title, w }: { title: string; w?: LandingSearchWindow }) {
  return (
    <section className="admin-players-section">
      <h2>{title}</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Откуда пришли из поиска: referrer Google/Яндекс или метки Директа (yclid, gclid, utm_term).
        Google в органике почти никогда не отдаёт сам запрос — тогда ключ пустой.
      </p>
      <p className="dim">
        Визиты из поиска {w?.searchViews ?? '—'} · регистрации {w?.searchRegisters ?? '—'} · без
        ключа {w?.unknownKeywordViews ?? '—'}
      </p>
      {!w?.engines.length ? (
        <p className="dim">Пока нет заходов из поисковиков за этот срок.</p>
      ) : (
        <ul className="admin-players-list">
          {w.engines.map((row) => (
            <li key={row.engine}>
              <div>
                <strong>{searchEngineLabel(row.engine)}</strong>
                <p className="muted">
                  Визиты {row.views} ({row.uniqueVisitors} уник.) · рег. {row.registerSuccess} (
                  {row.registerUnique} уник.) · органика {row.organicViews} · реклама {row.paidViews}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {w?.keywords.length ? (
        <>
          <h3 className="admin-search-keywords-title">Ключи</h3>
          <ul className="admin-players-list">
            {w.keywords.map((row) => (
              <li key={`${row.engine}:${row.keyword}`}>
                <div>
                  <strong>{row.keyword}</strong>
                  <p className="muted">
                    {searchEngineLabel(row.engine)} · визиты {row.views} · рег. {row.registerSuccess}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : w?.engines.length ? (
        <p className="dim">
          Ключей пока нет. В органике Яндекс часто присылает text=, Google — нет. Для Директа
          добавляй utm_term в ссылку объявления.
        </p>
      ) : null}
    </section>
  )
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
      <SubpageHeader
        title="Трафик и поиск"
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
        Визиты с главной, /lp и гайдов → регистрация. Ниже — отдельно Google и Яндекс.
        {loading ? ' · обновляем…' : ''}
        {data ? ` · ${formatAdminDate(data.generatedAt)}` : ''}
      </p>

      {error ? <p className="admin-inline-error">{error}</p> : null}

      <FunnelBlock title="24 часа" w={data?.last24h} />
      <FunnelBlock title="7 дней" w={data?.last7d} />
      <FunnelBlock title="30 дней" w={data?.last30d} />

      <SearchBlock title="Поиск · 7 дней" w={data?.search7d} />
      <SearchBlock title="Поиск · 30 дней" w={data?.search30d} />

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
                    {row.searchEngine ? ` · ${searchEngineLabel(row.searchEngine)}` : ''}
                    {row.searchPaid ? ' · реклама' : ''}
                    {row.searchKeyword ? ` · «${row.searchKeyword}»` : ''}
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
