import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { SectionTitle } from '../components/SectionTitle'
import { SubpageHeader } from '../components/SubpageHeader'
import { useApp } from '../context/useApp'
import { formatRetentionRate } from '../lib/adminAnalytics'
import {
  formatOverviewCount,
  formatOverviewRate,
  isOverviewPreset,
  overviewProblemText,
  OVERVIEW_PRESET_LABEL,
  OVERVIEW_PRESETS,
  type AdminProductOverview,
  type OverviewPreset,
} from '../lib/adminProductOverview'
import { formatAdminDate } from '../lib/adminStats'
import { apiAdminFetchOverview } from '../lib/apiClient'
import './FeedbackPage.css'
import './AdminPlayersPage.css'

const PRESET_ORDER: OverviewPreset[] = [...OVERVIEW_PRESETS]

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <article className="admin-stat-card">
      <span className="muted">{label}</span>
      <strong>{value}</strong>
      <p className="dim">{hint}</p>
    </article>
  )
}

export function AdminOverviewPage() {
  const navigate = useNavigate()
  const { user, canViewUsers } = useApp()
  const [params, setParams] = useSearchParams()
  const rawPreset = params.get('preset')
  const preset: OverviewPreset = isOverviewPreset(rawPreset) ? rawPreset : '7d'
  const fromParam = params.get('from') || ''
  const toParam = params.get('to') || ''
  const [customFrom, setCustomFrom] = useState(fromParam)
  const [customTo, setCustomTo] = useState(toParam)
  const [overview, setOverview] = useState<AdminProductOverview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const query = useMemo(
    () => ({
      preset,
      from: preset === 'custom' ? fromParam : undefined,
      to: preset === 'custom' ? toParam : undefined,
    }),
    [preset, fromParam, toParam],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setOverview(await apiAdminFetchOverview(query))
    } catch (err) {
      setOverview(null)
      setError(err instanceof Error ? err.message : 'Не удалось загрузить обзор')
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

  const kpi = overview?.kpi
  const funnel = overview?.funnel ?? []
  const signals = overview?.signals
  const problem = overviewProblemText(funnel)
  const empty =
    !!overview &&
    kpi?.registrations === 0 &&
    kpi.activeUsers === 0 &&
    kpi.workouts === 0 &&
    kpi.checkIns === 0 &&
    kpi.socialActions === 0 &&
    kpi.aiUsers === 0

  const selectPreset = (next: OverviewPreset) => {
    const nextParams = new URLSearchParams()
    nextParams.set('preset', next)
    if (next === 'custom') {
      if (customFrom) nextParams.set('from', customFrom)
      if (customTo) nextParams.set('to', customTo)
    }
    setParams(nextParams, { replace: true })
  }

  const applyCustom = () => {
    const nextParams = new URLSearchParams()
    nextParams.set('preset', 'custom')
    nextParams.set('from', customFrom)
    nextParams.set('to', customTo)
    setParams(nextParams, { replace: true })
  }

  return (
    <main className="page admin-page admin-players-page admin-overview-page">
      <SubpageHeader
        title="Обзор"
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
        Что происходит со Spotter сейчас · один период · МСК
        {overview
          ? ` · ${overview.range.fromKey} — ${overview.range.toKey}`
          : ''}
        {overview ? ` · обновлено ${formatAdminDate(overview.generatedAt)}` : ''}
        {loading ? ' · обновляем…' : ''}
      </p>

      <div className="admin-filter-bar" role="tablist" aria-label="Период">
        {PRESET_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={preset === id}
            className={`admin-filter-btn ${preset === id ? 'is-active' : ''}`}
            onClick={() => selectPreset(id)}
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
            applyCustom()
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

      {error ? <p className="admin-inline-error">{error}</p> : null}
      {empty ? <p className="dim">За этот период пока нет данных.</p> : null}
      {problem && !empty ? <p className="admin-overview-problem">{problem}</p> : null}

      <section className="admin-stat-grid admin-overview-kpi-1" aria-label="Активность">
        <KpiCard
          label="Регистрации"
          value={kpi ? formatOverviewCount(kpi.registrations) : '—'}
          hint="Новые аккаунты за период"
        />
        <KpiCard
          label="Активные пользователи"
          value={kpi ? formatOverviewCount(kpi.activeUsers) : '—'}
          hint="lastSeen внутри периода"
        />
        <KpiCard
          label="DAU"
          value={kpi ? formatOverviewCount(kpi.dau) : '—'}
          hint="Последний день периода"
        />
        <KpiCard
          label="WAU"
          value={kpi ? formatOverviewCount(kpi.wau) : '—'}
          hint="До 7 дней от конца периода"
        />
        <KpiCard
          label="MAU"
          value={kpi ? formatOverviewCount(kpi.mau) : '—'}
          hint="До 30 дней от конца периода"
        />
      </section>

      <section className="admin-stat-grid admin-overview-kpi-2" aria-label="Активация">
        <KpiCard
          label="Activation Rate"
          value={formatOverviewRate(kpi?.activationRate ?? null)}
          hint="Meaningful action / регистрации · зал не обязателен"
        />
        <KpiCard
          label="R7"
          value={formatRetentionRate(kpi?.r7.rate ?? null)}
          hint={
            kpi && kpi.r7.cohorts > 0
              ? `${kpi.r7.cohorts} когорт · ${kpi.r7.retained}/${kpi.r7.cohortUsers}`
              : preset === '7d' || preset === 'today'
                ? 'окно короче D+7 — открой 30д'
                : 'мало данных'
          }
        />
        <KpiCard
          label="R30"
          value={formatRetentionRate(kpi?.r30.rate ?? null)}
          hint={
            kpi && kpi.r30.cohorts > 0
              ? `${kpi.r30.cohorts} когорт · ${kpi.r30.retained}/${kpi.r30.cohortUsers}`
              : 'мало данных'
          }
        />
      </section>

      <section className="admin-stat-grid admin-overview-kpi-3" aria-label="Действия">
        <KpiCard
          label="Тренировки"
          value={kpi ? formatOverviewCount(kpi.workouts) : '—'}
          hint="Сохранённые сессии"
        />
        <KpiCard
          label="Check-ins"
          value={kpi ? formatOverviewCount(kpi.checkIns) : '—'}
          hint="Нажали «Я в зале»"
        />
        <KpiCard
          label="Социальные действия"
          value={kpi ? formatOverviewCount(kpi.socialActions) : '—'}
          hint="Лайки + запросы + accept + чаты"
        />
        <KpiCard
          label="AI users"
          value={kpi ? formatOverviewCount(kpi.aiUsers) : '—'}
          hint="Запросили или получили разбор"
        />
      </section>

      <section className="surface admin-rr-panel">
        <SectionTitle>Основная воронка</SectionTitle>
        <p className="dim admin-rr-hint">
          Регистрация → вход → meaningful action → возврат. Выбор зала не шаг активации.
        </p>
        <ol className="admin-overview-funnel">
          {funnel.map((step, i) => (
            <li key={step.id}>
              {i > 0 ? <span className="admin-overview-funnel-arrow">↓</span> : null}
              <div className={`admin-stat-card ${step.worst ? 'is-worst-drop' : ''}`}>
                <span className="muted">{step.label}</span>
                <strong>{formatOverviewCount(step.users)}</strong>
                <p className="dim">
                  {step.conversion == null ? '—' : formatOverviewRate(step.conversion)} от
                  предыдущего
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
                <th>conversion</th>
                <th>drop-off</th>
              </tr>
            </thead>
            <tbody>
              {funnel.map((step) => (
                <tr key={step.id} className={step.worst ? 'is-worst-drop' : undefined}>
                  <td>{step.label}</td>
                  <td>{formatOverviewCount(step.users)}</td>
                  <td>{formatOverviewRate(step.conversion)}</td>
                  <td>
                    {step.id === 'registered'
                      ? '—'
                      : `${formatOverviewCount(step.dropOff)} · ${formatOverviewRate(step.dropOffRate)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-overview-signals" aria-label="Сигналы продукта">
        <article className="surface admin-rr-panel">
          <SectionTitle>Social</SectionTitle>
          <ul className="admin-overview-signal-list">
            <li>
              <span>profiles viewed</span>
              <strong>{signals ? formatOverviewCount(signals.social.profilesViewed) : '—'}</strong>
            </li>
            <li>
              <span>likes</span>
              <strong>{signals ? formatOverviewCount(signals.social.likes) : '—'}</strong>
            </li>
            <li>
              <span>requests</span>
              <strong>{signals ? formatOverviewCount(signals.social.requests) : '—'}</strong>
            </li>
            <li>
              <span>accepted requests</span>
              <strong>
                {signals ? formatOverviewCount(signals.social.acceptedRequests) : '—'}
              </strong>
            </li>
            <li>
              <span>chats</span>
              <strong>{signals ? formatOverviewCount(signals.social.chats) : '—'}</strong>
            </li>
          </ul>
        </article>
        <article className="surface admin-rr-panel">
          <SectionTitle>Training</SectionTitle>
          <ul className="admin-overview-signal-list">
            <li>
              <span>workouts</span>
              <strong>{signals ? formatOverviewCount(signals.training.workouts) : '—'}</strong>
            </li>
            <li>
              <span>check-ins</span>
              <strong>{signals ? formatOverviewCount(signals.training.checkIns) : '—'}</strong>
            </li>
            <li>
              <span>active training days</span>
              <strong>
                {signals ? formatOverviewCount(signals.training.activeTrainingDays) : '—'}
              </strong>
            </li>
          </ul>
        </article>
        <article className="surface admin-rr-panel">
          <SectionTitle>AI</SectionTitle>
          <ul className="admin-overview-signal-list">
            <li>
              <span>AI users</span>
              <strong>{signals ? formatOverviewCount(signals.ai.users) : '—'}</strong>
            </li>
            <li>
              <span>analyses requested</span>
              <strong>
                {signals ? formatOverviewCount(signals.ai.analysesRequested) : '—'}
              </strong>
            </li>
            <li>
              <span>analyses generated</span>
              <strong>
                {signals ? formatOverviewCount(signals.ai.analysesGenerated) : '—'}
              </strong>
            </li>
          </ul>
        </article>
      </section>

      <section className="surface admin-rr-panel">
        <SectionTitle
          action={
            <Link to="/app/admin/cohorts" className="section-action">
              Когорты
            </Link>
          }
        >
          Retention
        </SectionTitle>
        <p className="dim admin-rr-hint">
          Day-N по lastSeen ровно в календарный день D+N (МСК), не «хотя бы раз за N дней».
          Когорты — регистрации внутри выбранного периода, у которых D+N уже наступил.
        </p>
        <div className="admin-rr-grid">
          {([1, 7, 30] as const).map((day) => {
            const row =
              day === 1 ? overview?.retention.r1 : day === 7 ? overview?.retention.r7 : overview?.retention.r30
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
    </main>
  )
}
