import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { SectionTitle } from '../components/SectionTitle'
import { SubpageHeader } from '../components/SubpageHeader'
import { useApp } from '../context/useApp'
import {
  formatGrowthCount,
  formatGrowthRate,
  GROWTH_NAV,
  isGrowthView,
  type AdminGrowthPayload,
  type GrowthFunnelStep,
  type GrowthView,
} from '../lib/adminGrowth'
import {
  isOverviewPreset,
  OVERVIEW_PRESET_LABEL,
  OVERVIEW_PRESETS,
  type OverviewPreset,
} from '../lib/adminProductOverview'
import { formatAdminDate } from '../lib/adminStats'
import { apiAdminFetchGrowth } from '../lib/apiClient'
import './FeedbackPage.css'
import './AdminPlayersPage.css'

function Funnel({ steps }: { steps: GrowthFunnelStep[] }) {
  return (
    <section className="surface admin-rr-panel">
      <SectionTitle>Воронка</SectionTitle>
      <ol className="admin-overview-funnel">
        {steps.map((step, i) => (
          <li key={step.id}>
            {i > 0 ? <span className="admin-overview-funnel-arrow">↓</span> : null}
            <div className="admin-stat-card">
              <span className="muted">{step.label}</span>
              <strong>{formatGrowthCount(step.users)}</strong>
              <p className="dim">{formatGrowthRate(step.conversion)}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function AdminGrowthPage() {
  const navigate = useNavigate()
  const { section } = useParams()
  const { user, canViewUsers } = useApp()
  const [params, setParams] = useSearchParams()
  const view: GrowthView = isGrowthView(section) ? section : 'acquisition'
  const rawPreset = params.get('preset')
  const preset: OverviewPreset = isOverviewPreset(rawPreset) ? rawPreset : '30d'
  const fromParam = params.get('from') || ''
  const toParam = params.get('to') || ''
  const [customFrom, setCustomFrom] = useState(fromParam)
  const [customTo, setCustomTo] = useState(toParam)
  const [data, setData] = useState<AdminGrowthPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const query = useMemo(
    () => ({
      view,
      preset,
      from: preset === 'custom' ? fromParam : undefined,
      to: preset === 'custom' ? toParam : undefined,
    }),
    [view, preset, fromParam, toParam],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await apiAdminFetchGrowth(query))
    } catch (err) {
      setData(null)
      setError(err instanceof Error ? err.message : 'Не удалось загрузить рост')
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    void load()
  }, [load])

  if (!user?.isAdmin) return <Navigate to="/app/profile" replace />
  if (!canViewUsers) return <Navigate to="/app/admin" replace />
  if (section && !isGrowthView(section)) return <Navigate to="/app/admin/growth/acquisition" replace />

  const writeParams = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key)
      else next.set(key, value)
    }
    setParams(next, { replace: true })
  }

  const hrefFor = (next: GrowthView) => {
    const qs = params.toString()
    return `/app/admin/growth/${next}${qs ? `?${qs}` : ''}`
  }

  return (
    <main className="page admin-page admin-players-page admin-overview-page">
      <SubpageHeader
        title="Рост"
        onBack={() => navigate('/app/admin')}
        action={
          <button type="button" className="btn-icon-refresh" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={22} strokeWidth={2.4} />
          </button>
        }
      />
      <p className="muted">
        Качество трафика, не только визиты · МСК
        {data ? ` · ${data.range.fromKey} — ${data.range.toKey}` : ''}
        {data ? ` · обновлено ${formatAdminDate(data.generatedAt)}` : ''}
        {loading ? ' · обновляем…' : ''}
      </p>

      <nav className="admin-filter-bar" aria-label="Рост">
        {GROWTH_NAV.map((item) => (
          <Link
            key={item.id}
            to={hrefFor(item.id)}
            className={`admin-filter-btn ${view === item.id ? 'is-active' : ''}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="admin-filter-bar" role="tablist" aria-label="Период">
        {OVERVIEW_PRESETS.map((id) => (
          <button
            key={id}
            type="button"
            className={`admin-filter-btn ${preset === id ? 'is-active' : ''}`}
            onClick={() => writeParams({ preset: id })}
          >
            {OVERVIEW_PRESET_LABEL[id]}
          </button>
        ))}
      </div>

      {preset === 'custom' ? (
        <form
          className="admin-overview-custom"
          onSubmit={(e) => {
            e.preventDefault()
            writeParams({ preset: 'custom', from: customFrom, to: customTo })
          }}
        >
          <label>
            С
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} required />
          </label>
          <label>
            По
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} required />
          </label>
          <button type="submit" className="btn btn-soft">
            Показать
          </button>
        </form>
      ) : null}

      {error ? <p className="admin-inline-error">{error}</p> : null}

      <Funnel steps={data?.funnel ?? []} />

      {view === 'acquisition' || view === 'landing' ? (
        <section className="surface admin-rr-panel">
          <SectionTitle>Source quality</SectionTitle>
          <p className="dim admin-rr-hint">
            Visitors — unique visitorId с view. Registration — user, связанный с тем же visitorId после
            визита. Activation = вход в продукт (не выбор зала). R7/R30 — exact day, «—» если &lt; 8 eligible.
          </p>
          <div className="admin-overview-table-wrap">
            <table className="admin-overview-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Visitors</th>
                  <th>Registrations</th>
                  <th>Activation</th>
                  <th>R7</th>
                  <th>R30</th>
                </tr>
              </thead>
              <tbody>
                {(data?.sources ?? []).map((row) => (
                  <tr key={row.source} className={row.thin ? 'is-thin-sample' : undefined}>
                    <td>
                      {row.source} <span className="dim">{row.channel}</span>
                    </td>
                    <td>{formatGrowthCount(row.visitors)}</td>
                    <td>{formatGrowthCount(row.registrations)}</td>
                    <td>
                      {formatGrowthCount(row.activation)} · {formatGrowthRate(row.activationRate)}
                    </td>
                    <td>{formatGrowthRate(row.r7)}</td>
                    <td>{formatGrowthRate(row.r30)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {view === 'landing' && data?.landing ? (
        <>
          <section className="admin-stat-grid admin-overview-kpi-3">
            <article className="admin-stat-card">
              <span className="muted">Views</span>
              <strong>{formatGrowthCount(data.landing.views)}</strong>
              <p className="dim">LandingEvent view</p>
            </article>
            <article className="admin-stat-card">
              <span className="muted">Unique visitors</span>
              <strong>{formatGrowthCount(data.landing.uniqueVisitors)}</strong>
              <p className="dim">visitorId, дубли сессии сжаты</p>
            </article>
            <article className="admin-stat-card">
              <span className="muted">CTA register</span>
              <strong>{formatGrowthCount(data.landing.ctaRegister)}</strong>
            </article>
            <article className="admin-stat-card">
              <span className="muted">register_success</span>
              <strong>{formatGrowthCount(data.landing.registerSuccess)}</strong>
              <p className="dim">события, не обязательно склеенный user</p>
            </article>
          </section>
          <p className="dim">
            Старый лог 24/7/30:{' '}
            <Link to="/app/admin/landing" className="text-link">
              Трафик и поиск
            </Link>
          </p>
          <section className="admin-overview-signals">
            <article className="surface admin-rr-panel">
              <SectionTitle>Campaign</SectionTitle>
              <ul className="admin-overview-signal-list">
                {data.landing.byCampaign.map((row) => (
                  <li key={row.key}>
                    <span>{row.key}</span>
                    <strong>
                      {row.visitors} → {row.registrations}
                    </strong>
                  </li>
                ))}
              </ul>
              {!data.landing.byCampaign.length ? <p className="dim">Нет utm_campaign.</p> : null}
            </article>
            <article className="surface admin-rr-panel">
              <SectionTitle>Content / term / referrer</SectionTitle>
              <ul className="admin-overview-signal-list">
                {data.landing.byContent.map((row) => (
                  <li key={`c-${row.key}`}>
                    <span>content {row.key}</span>
                    <strong>{row.visitors}</strong>
                  </li>
                ))}
                {data.landing.byTerm.map((row) => (
                  <li key={`t-${row.key}`}>
                    <span>term {row.key}</span>
                    <strong>{row.visitors}</strong>
                  </li>
                ))}
                {data.landing.byReferrer.map((row) => (
                  <li key={`r-${row.key}`}>
                    <span>{row.key}</span>
                    <strong>{row.visitors}</strong>
                  </li>
                ))}
              </ul>
            </article>
          </section>
        </>
      ) : null}

      {view === 'acquisition' && data?.cross?.length ? (
        <section className="surface admin-rr-panel">
          <SectionTitle>Source × зал</SectionTitle>
          <p className="dim admin-rr-hint">Топ-20 ячеек по регистрациям. Не BI-куб.</p>
          <div className="admin-overview-table-wrap">
            <table className="admin-overview-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Gym</th>
                  <th>Regs</th>
                  <th>Activation</th>
                  <th>R7</th>
                </tr>
              </thead>
              <tbody>
                {data.cross.map((row) => (
                  <tr key={`${row.source}:${row.gym}`}>
                    <td>{row.source}</td>
                    <td>{row.gym}</td>
                    <td>{row.registrations}</td>
                    <td>{row.activation}</td>
                    <td>{formatGrowthRate(row.r7)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {view === 'seo' && data?.seo ? (
        <>
          <section className="admin-stat-grid admin-overview-kpi-3">
            <article className="admin-stat-card">
              <span className="muted">Landing visits</span>
              <strong>{formatGrowthCount(data.seo.visits)}</strong>
              <p className="dim">visitor с searchEngine</p>
            </article>
            <article className="admin-stat-card">
              <span className="muted">Registrations</span>
              <strong>{formatGrowthCount(data.seo.registrations)}</strong>
            </article>
            <article className="admin-stat-card">
              <span className="muted">Activation</span>
              <strong>{formatGrowthCount(data.seo.activation)}</strong>
            </article>
            <article className="admin-stat-card">
              <span className="muted">R7 / R30</span>
              <strong>
                {formatGrowthRate(data.seo.r7)} / {formatGrowthRate(data.seo.r30)}
              </strong>
            </article>
          </section>
          <section className="surface admin-rr-panel">
            <SectionTitle>Движки</SectionTitle>
            <ul className="admin-overview-signal-list">
              {data.seo.engines.map((row) => (
                <li key={`${row.engine}:${row.paid}`}>
                  <span>
                    {row.engine} {row.paid ? 'paid' : 'organic'}
                  </span>
                  <strong>
                    {row.visitors} → {row.registrations}
                  </strong>
                </li>
              ))}
            </ul>
          </section>
          <section className="surface admin-rr-panel">
            <SectionTitle>Ключи</SectionTitle>
            <p className="dim admin-rr-hint">
              Только непустой searchKeyword. Выдуманных ключей нет. Без ключа:{' '}
              {data.seo.unknownKeywords} визитов.
            </p>
            {data.seo.keywords.length ? (
              <ul className="admin-overview-signal-list">
                {data.seo.keywords.map((row) => (
                  <li key={`${row.engine}:${row.keyword}`}>
                    <span>
                      {row.keyword} · {row.engine}
                    </span>
                    <strong>
                      {row.visitors} → {row.registrations}
                    </strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="dim">Поисковики ключ не отдали — таблицы ключей нет.</p>
            )}
          </section>
        </>
      ) : null}

      {view === 'referral' && data?.referral ? (
        <>
          <section className="admin-stat-grid admin-overview-kpi-3">
            <article className="admin-stat-card">
              <span className="muted">Invited users</span>
              <strong>{formatGrowthCount(data.referral.quality.invited)}</strong>
              <p className="dim">не число ссылок</p>
            </article>
            <article className="admin-stat-card">
              <span className="muted">Activated</span>
              <strong>{formatGrowthCount(data.referral.quality.activated)}</strong>
            </article>
            <article className="admin-stat-card">
              <span className="muted">Retained R7</span>
              <strong>{formatGrowthCount(data.referral.quality.retainedR7)}</strong>
              <p className="dim">{formatGrowthRate(data.referral.r7)}</p>
            </article>
            <article className="admin-stat-card">
              <span className="muted">Retained R30</span>
              <strong>{formatGrowthCount(data.referral.quality.retainedR30)}</strong>
              <p className="dim">{formatGrowthRate(data.referral.r30)}</p>
            </article>
          </section>
          <p className="dim">
            Invite opened нет в событиях — шаг пустой, не выдуман.{' '}
            <Link to="/app/admin/referrals" className="text-link">
              Круг и лидеры
            </Link>
          </p>
        </>
      ) : null}
    </main>
  )
}
