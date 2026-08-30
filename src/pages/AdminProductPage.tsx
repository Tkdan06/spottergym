import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { SectionTitle } from '../components/SectionTitle'
import { SubpageHeader } from '../components/SubpageHeader'
import { useApp } from '../context/useApp'
import {
  formatProductCount,
  formatProductRate,
  formatDurationSeconds,
  formatMedianSeconds,
  isProductView,
  PRODUCT_NAV,
  type AdminProductPayload,
  type MetricDefinition,
  type ProductFunnelStep,
  type ProductView,
} from '../lib/adminProductAnalytics'
import {
  isOverviewPreset,
  OVERVIEW_PRESET_LABEL,
  OVERVIEW_PRESETS,
  type OverviewPreset,
} from '../lib/adminProductOverview'
import { formatAdminDate } from '../lib/adminStats'
import { apiAdminFetchProduct } from '../lib/apiClient'
import './FeedbackPage.css'
import './AdminPlayersPage.css'

function DefinitionList({ title, items }: { title: string; items: MetricDefinition[] }) {
  return (
    <details className="admin-product-defs">
      <summary>{title}</summary>
      <ul>
        {items.map((item) => (
          <li key={item.event}>
            <strong>{item.event}</strong>
            <span>
              num {item.numerator} · den {item.denominator} · окно {item.window}
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}

function FunnelBlock({
  title,
  hint,
  steps,
  showMedian,
}: {
  title: string
  hint: string
  steps: ProductFunnelStep[]
  showMedian?: boolean
}) {
  const empty = steps.every((step) => step.users === 0 && step.events === 0)
  return (
    <section className="surface admin-rr-panel">
      <SectionTitle>{title}</SectionTitle>
      <p className="dim admin-rr-hint">{hint}</p>
      {empty ? <p className="dim">За этот период нет данных.</p> : null}
      <ol className="admin-overview-funnel">
        {steps.map((step, i) => (
          <li key={step.id}>
            {i > 0 ? <span className="admin-overview-funnel-arrow">↓</span> : null}
            <div className={`admin-stat-card ${step.worst ? 'is-worst-drop' : ''}`}>
              <span className="muted">{step.label}</span>
              <strong>{formatProductCount(step.users)}</strong>
              <p className="dim">
                {formatProductCount(step.events)} событий · {formatProductRate(step.conversion)}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <div className="admin-overview-table-wrap">
        <table className="admin-overview-table">
          <thead>
            <tr>
              <th>step</th>
              <th>users</th>
              <th>events</th>
              <th>conversion</th>
              <th>drop-off</th>
              {showMedian ? <th>median</th> : null}
            </tr>
          </thead>
          <tbody>
            {steps.map((step) => (
              <tr key={step.id} className={step.worst ? 'is-worst-drop' : undefined}>
                <td>{step.label}</td>
                <td>{formatProductCount(step.users)}</td>
                <td>{formatProductCount(step.events)}</td>
                <td>{formatProductRate(step.conversion)}</td>
                <td>
                  {step.id === steps[0]?.id
                    ? '—'
                    : `${formatProductCount(step.dropOff)} · ${formatProductRate(step.dropOffRate)}`}
                </td>
                {showMedian ? <td>{formatMedianSeconds(step.medianSecondsFromPrev)}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DefinitionList title="Определения" items={steps.map((step) => step.definition)} />
    </section>
  )
}

export function AdminProductPage() {
  const navigate = useNavigate()
  const { section } = useParams()
  const { user, canViewUsers } = useApp()
  const [params, setParams] = useSearchParams()
  const view: ProductView = isProductView(section) ? section : 'funnels'
  const rawPreset = params.get('preset')
  const preset: OverviewPreset = isOverviewPreset(rawPreset) ? rawPreset : '7d'
  const fromParam = params.get('from') || ''
  const toParam = params.get('to') || ''
  const gym = params.get('gym') || ''
  const source = params.get('source') || ''
  const referral = params.get('referral') === 'yes' || params.get('referral') === 'no'
    ? params.get('referral')!
    : 'all'
  const [customFrom, setCustomFrom] = useState(fromParam)
  const [customTo, setCustomTo] = useState(toParam)
  const [data, setData] = useState<AdminProductPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const query = useMemo(
    () => ({
      view,
      preset,
      from: preset === 'custom' ? fromParam : undefined,
      to: preset === 'custom' ? toParam : undefined,
      gym: gym || undefined,
      source: source || undefined,
      referral,
    }),
    [view, preset, fromParam, toParam, gym, source, referral],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await apiAdminFetchProduct(query))
    } catch (err) {
      setData(null)
      setError(err instanceof Error ? err.message : 'Не удалось загрузить продукт')
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setCustomFrom(fromParam)
    setCustomTo(toParam)
  }, [fromParam, toParam])

  if (!user?.isAdmin) return <Navigate to="/app/profile" replace />
  if (!canViewUsers) return <Navigate to="/app/admin" replace />
  if (section && !isProductView(section)) return <Navigate to="/app/admin/product/funnels" replace />

  const writeParams = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(patch)) {
      if (!value || (key === 'referral' && value === 'all')) next.delete(key)
      else next.set(key, value)
    }
    setParams(next, { replace: true })
  }

  const hrefFor = (nextView: ProductView) => {
    const next = new URLSearchParams(params)
    const qs = next.toString()
    return `/app/admin/product/${nextView}${qs ? `?${qs}` : ''}`
  }

  return (
    <main className="page admin-page admin-players-page admin-overview-page">
      <SubpageHeader
        title="Продукт"
        onBack={() => navigate('/app/admin')}
        action={
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
        }
      />
      <p className="muted">
        Воронки и сигналы · один период · МСК
        {data ? ` · ${data.range.fromKey} — ${data.range.toKey}` : ''}
        {data ? ` · обновлено ${formatAdminDate(data.generatedAt)}` : ''}
        {loading ? ' · обновляем…' : ''}
      </p>

      <nav className="admin-filter-bar" aria-label="Разделы продукта">
        {PRODUCT_NAV.map((item) => (
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
            {OVERVIEW_PRESET_LABEL[id as OverviewPreset]}
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
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              required
            />
          </label>
          <label>
            По
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              required
            />
          </label>
          <button type="submit" className="btn btn-soft">
            Показать
          </button>
        </form>
      ) : null}

      <div className="admin-product-filters">
        <label>
          Зал
          <select value={gym} onChange={(e) => writeParams({ gym: e.target.value })}>
            <option value="">Все · включая без зала</option>
            {(data?.options.gyms ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Источник
          <select value={source} onChange={(e) => writeParams({ source: e.target.value })}>
            <option value="">Все</option>
            {(data?.options.sources ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Реферал
          <select value={referral} onChange={(e) => writeParams({ referral: e.target.value })}>
            <option value="all">Все</option>
            <option value="yes">Пришли по инвайту</option>
            <option value="no">Без инвайта</option>
          </select>
        </label>
      </div>

      {error ? <p className="admin-inline-error">{error}</p> : null}

      {view === 'funnels' ? (
        <>
          <FunnelBlock
            title="Social"
            hint="People → profile → like → request → accept → chat → message. Users — закрытая воронка; events — все события шага за период."
            steps={data?.social?.funnel ?? []}
          />
          <FunnelBlock
            title="Training"
            hint="Workout и Activity не смешиваются. Check-in сюда не входит."
            steps={data?.training?.funnel ?? []}
          />
        </>
      ) : null}

      {view === 'core-loop' ? (
        <FunnelBlock
          title="Core Loop"
          hint="Когорта регистраций за период. Gym context включает skip. Median — время между соседними шагами."
          steps={data?.coreLoop?.funnel ?? []}
          showMedian
        />
      ) : null}

      {view === 'social' ? (
        <FunnelBlock
          title="Знакомства"
          hint="Та же социальная воронка, что на «Воронки». Зал не обязателен."
          steps={data?.social?.funnel ?? []}
        />
      ) : null}

      {view === 'chats' ? (
        <>
          <section className="admin-stat-grid admin-overview-kpi-3" aria-label="Чаты">
            <article className="admin-stat-card">
              <span className="muted">Requests</span>
              <strong>{formatProductCount(data?.chats?.kpi.requests)}</strong>
              <p className="dim">Conversation.createdAt</p>
            </article>
            <article className="admin-stat-card">
              <span className="muted">Accepted</span>
              <strong>{formatProductCount(data?.chats?.kpi.accepted)}</strong>
              <p className="dim">chat_request_accepted</p>
            </article>
            <article className="admin-stat-card">
              <span className="muted">Chats</span>
              <strong>{formatProductCount(data?.chats?.kpi.chats)}</strong>
              <p className="dim">Диалоги с ≥1 сообщением</p>
            </article>
            <article className="admin-stat-card">
              <span className="muted">Messages</span>
              <strong>{formatProductCount(data?.chats?.kpi.messages)}</strong>
              <p className="dim">ChatMessage, не тексты</p>
            </article>
          </section>
          <FunnelBlock
            title="Чаты"
            hint="Те же users, что в social с шага Request sent."
            steps={data?.chats?.funnel ?? []}
          />
        </>
      ) : null}

      {view === 'workouts' ? (
        <FunnelBlock
          title="Тренировки"
          hint="WorkoutSession. Check-in / «Я в зале» не участвуют."
          steps={data?.training?.funnel ?? []}
        />
      ) : null}

      {view === 'activity' ? (
        <>
          <section className="admin-stat-grid admin-overview-kpi-3" aria-label="Активность">
            <article className="admin-stat-card">
              <span className="muted">Check-ins</span>
              <strong>{formatProductCount(data?.activity?.kpi.checkIns)}</strong>
              <p className="dim">CheckIn.checkedInAt · не workout</p>
            </article>
            <article className="admin-stat-card">
              <span className="muted">Active users</span>
              <strong>{formatProductCount(data?.activity?.kpi.activeUsers)}</strong>
              <p className="dim">Users с ≥1 чекином</p>
            </article>
            <article className="admin-stat-card">
              <span className="muted">Training days</span>
              <strong>{formatProductCount(data?.activity?.kpi.trainingDays)}</strong>
              <p className="dim">user × день МСК чекина</p>
            </article>
            <article className="admin-stat-card">
              <span className="muted">Average duration</span>
              <strong>{formatDurationSeconds(data?.activity?.kpi.averageDurationSeconds)}</strong>
              <p className="dim">checkout / expiry / now · cap 8ч</p>
            </article>
          </section>
          <section className="admin-overview-signals">
            <article className="surface admin-rr-panel">
              <SectionTitle>По часам (МСК)</SectionTitle>
              <ul className="admin-overview-signal-list">
                {(data?.activity?.hours ?? []).map((row) => (
                  <li key={row.hour}>
                    <span>{String(row.hour).padStart(2, '0')}:00</span>
                    <strong>{formatProductCount(row.checkIns)}</strong>
                  </li>
                ))}
              </ul>
            </article>
            <article className="surface admin-rr-panel">
              <SectionTitle>Длительность</SectionTitle>
              <ul className="admin-overview-signal-list">
                {(data?.activity?.durations ?? []).map((row) => (
                  <li key={row.bucket}>
                    <span>{row.bucket}</span>
                    <strong>{formatProductCount(row.checkIns)}</strong>
                  </li>
                ))}
              </ul>
            </article>
          </section>
          <DefinitionList
            title="Определения активности"
            items={[
              {
                event: 'CheckIn.checkedInAt',
                numerator: 'строки чекина / уникальные userId / user×MSK day / среднее duration',
                denominator: '— / — / — / число чекинов',
                window: data ? `${data.range.fromKey} — ${data.range.toKey} (МСК)` : 'период',
              },
            ]}
          />
        </>
      ) : null}

      {view === 'progress' ? (
        <>
          <section className="admin-stat-grid admin-overview-kpi-3" aria-label="Прогресс">
            <article className="admin-stat-card">
              <span className="muted">Opens</span>
              <strong>{formatProductCount(data?.progress?.kpi.opens)}</strong>
              <p className="dim">progress_opened</p>
            </article>
            <article className="admin-stat-card">
              <span className="muted">Users</span>
              <strong>{formatProductCount(data?.progress?.kpi.users)}</strong>
              <p className="dim">Уникальные userId</p>
            </article>
            <article className="admin-stat-card">
              <span className="muted">Period selections</span>
              <strong>{formatProductCount(data?.progress?.kpi.periodSelections)}</strong>
              <p className="dim">События смены периода нет</p>
            </article>
            <article className="admin-stat-card">
              <span className="muted">Return</span>
              <strong>{formatProductCount(data?.progress?.kpi.returnedUsers)}</strong>
              <p className="dim">≥2 opens (разные сессии)</p>
            </article>
          </section>
          <DefinitionList
            title="Определения прогресса"
            items={[
              {
                event: 'progress_opened',
                numerator: 'events / distinct users / 0 / users with ≥2 events',
                denominator: '—',
                window: data ? `${data.range.fromKey} — ${data.range.toKey} (МСК)` : 'период',
              },
            ]}
          />
        </>
      ) : null}

      {view === 'ai' ? (
        <>
          <section className="admin-stat-grid admin-overview-kpi-3" aria-label="AI">
            <article className="admin-stat-card">
              <span className="muted">AI users</span>
              <strong>{formatProductCount(data?.ai?.kpi.users)}</strong>
              <p className="dim">opened ∪ requested ∪ generated</p>
            </article>
            <article className="admin-stat-card">
              <span className="muted">Requests</span>
              <strong>{formatProductCount(data?.ai?.kpi.requests)}</strong>
              <p className="dim">ai_analysis_requested</p>
            </article>
            <article className="admin-stat-card">
              <span className="muted">Generated</span>
              <strong>{formatProductCount(data?.ai?.kpi.generated)}</strong>
              <p className="dim">WorkoutAiInsight · не value</p>
            </article>
            <article className="admin-stat-card">
              <span className="muted">Success rate</span>
              <strong>{formatProductRate(data?.ai?.kpi.successRate ?? null)}</strong>
              <p className="dim">
                generated / requested · fail {formatProductCount(data?.ai?.kpi.failed)}
              </p>
            </article>
          </section>
          <FunnelBlock
            title="AI-тренер"
            hint="Generation ≠ ценность. Failures не входят в generated."
            steps={data?.ai?.funnel ?? []}
          />
        </>
      ) : null}
    </main>
  )
}
