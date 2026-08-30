import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { SectionTitle } from '../components/SectionTitle'
import { SubpageHeader } from '../components/SubpageHeader'
import { useApp } from '../context/useApp'
import {
  AHA_ACTIONS,
  ahaActionLabel,
  formatCellRate,
  formatRate,
  formatSignedRate,
  type AcqDimension,
  type AdminAhaPayload,
  type AdminCohortsPayload,
  type AhaAction,
  type AhaCompareGroup,
  type CohortGrain,
  type ProductDimension,
} from '../lib/adminCohorts'
import {
  isOverviewPreset,
  OVERVIEW_PRESET_LABEL,
  OVERVIEW_PRESETS,
  type OverviewPreset,
} from '../lib/adminProductOverview'
import { formatAdminDate } from '../lib/adminStats'
import { apiAdminFetchAha, apiAdminFetchCohorts } from '../lib/apiClient'
import './FeedbackPage.css'
import './AdminPlayersPage.css'

const DAYS = [1, 3, 7, 14, 30, 60] as const
const COMPARE_DAYS = [1, 7, 14, 30] as const

function isAhaAction(value: string | null): value is AhaAction {
  return !!value && AHA_ACTIONS.some((item) => item.id === value)
}

function GroupCard({ title, group }: { title: string; group: AhaCompareGroup | undefined }) {
  const byDay = new Map(group?.retention.map((cell) => [cell.day, cell]))
  return (
    <article className="surface admin-rr-panel">
      <SectionTitle>{title}</SectionTitle>
      <p className="dim admin-rr-hint">{group ? `${group.users} чел.` : '—'}</p>
      <div className="admin-rr-grid">
        {COMPARE_DAYS.map((day) => {
          const cell = byDay.get(day)
          return (
            <article key={day} className="admin-stat-card admin-rr-card">
              <span className="muted">R{day}</span>
              <strong>{formatCellRate(cell)}</strong>
              <p className="dim">
                {cell && cell.eligible > 0 ? `${cell.retained}/${cell.eligible}` : 'нет окна'}
              </p>
            </article>
          )
        })}
      </div>
      <ul className="admin-overview-signal-list" style={{ marginTop: 12 }}>
        <li>
          <span>active days</span>
          <strong>{group?.activeDaysAvg ?? '—'}</strong>
        </li>
        <li>
          <span>workouts</span>
          <strong>{group?.workoutsAvg ?? '—'}</strong>
        </li>
        <li>
          <span>check-ins</span>
          <strong>{group?.checkInsAvg ?? '—'}</strong>
        </li>
      </ul>
    </article>
  )
}

export function AdminCohortsPage() {
  const navigate = useNavigate()
  const { user, canViewUsers } = useApp()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'aha' ? 'aha' : 'cohorts'
  const rawPreset = params.get('preset')
  const preset: OverviewPreset = isOverviewPreset(rawPreset) ? rawPreset : '90d'
  const fromParam = params.get('from') || ''
  const toParam = params.get('to') || ''
  const grain: CohortGrain = params.get('grain') === 'month' ? 'month' : 'week'
  const acq = (params.get('acq') || 'all') as AcqDimension
  const acqValue = params.get('acqValue') || ''
  const product = (params.get('product') || 'all') as ProductDimension
  const rawAction = params.get('action')
  const action: AhaAction = isAhaAction(rawAction) ? rawAction : 'like_sent'
  const [customFrom, setCustomFrom] = useState(fromParam)
  const [customTo, setCustomTo] = useState(toParam)
  const [cohorts, setCohorts] = useState<AdminCohortsPayload | null>(null)
  const [aha, setAha] = useState<AdminAhaPayload | null>(null)
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
      if (tab === 'aha') {
        setAha(await apiAdminFetchAha({ ...query, action }))
      } else {
        setCohorts(
          await apiAdminFetchCohorts({
            ...query,
            grain,
            acq,
            acqValue: acqValue || undefined,
            product,
          }),
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить когорты')
    } finally {
      setLoading(false)
    }
  }, [tab, query, action, grain, acq, acqValue, product])

  useEffect(() => {
    void load()
  }, [load])

  if (!user?.isAdmin) return <Navigate to="/app/profile" replace />
  if (!canViewUsers) return <Navigate to="/app/admin" replace />

  const writeParams = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(patch)) {
      if (!value || value === 'all') next.delete(key)
      else next.set(key, value)
    }
    if (patch.acq && patch.acq !== 'source' && patch.acq !== 'medium' && patch.acq !== 'campaign') {
      next.delete('acqValue')
    }
    setParams(next, { replace: true })
  }

  const needsValue = acq === 'source' || acq === 'medium' || acq === 'campaign'
  const valueOptions =
    acq === 'source'
      ? cohorts?.options.sources ?? []
      : acq === 'medium'
        ? cohorts?.options.mediums ?? []
        : cohorts?.options.campaigns ?? []

  return (
    <main className="page admin-page admin-players-page admin-overview-page">
      <SubpageHeader
        title="Когорты"
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
        Day-N = lastSeen ровно в календарный день D+N (МСК)
        {cohorts || aha
          ? ` · ${(cohorts || aha)?.range.fromKey} — ${(cohorts || aha)?.range.toKey}`
          : ''}
        {cohorts || aha
          ? ` · обновлено ${formatAdminDate((cohorts || aha)!.generatedAt)}`
          : ''}
        {loading ? ' · обновляем…' : ''}
      </p>

      <nav className="admin-filter-bar" aria-label="Раздел">
        <Link
          to={`/app/admin/cohorts?${new URLSearchParams({ ...Object.fromEntries(params), tab: 'cohorts' })}`}
          className={`admin-filter-btn ${tab === 'cohorts' ? 'is-active' : ''}`}
        >
          Когорты
        </Link>
        <Link
          to={`/app/admin/cohorts?${new URLSearchParams({ ...Object.fromEntries(params), tab: 'aha' })}`}
          className={`admin-filter-btn ${tab === 'aha' ? 'is-active' : ''}`}
        >
          Aha
        </Link>
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

      {tab === 'cohorts' ? (
        <>
          <div className="admin-product-filters">
            <label>
              Когорта
              <select value={grain} onChange={(e) => writeParams({ grain: e.target.value })}>
                <option value="week">Неделя регистрации</option>
                <option value="month">Месяц регистрации</option>
              </select>
            </label>
            <label>
              Acquisition
              <select
                value={acq}
                onChange={(e) => writeParams({ acq: e.target.value, acqValue: '' })}
              >
                <option value="all">Все</option>
                <option value="referral">Реферал</option>
                <option value="organic">Organic</option>
                <option value="seo">SEO</option>
                <option value="source">source</option>
                <option value="medium">medium</option>
                <option value="campaign">campaign</option>
              </select>
            </label>
            {needsValue ? (
              <label>
                Значение
                <select value={acqValue} onChange={(e) => writeParams({ acqValue: e.target.value })}>
                  <option value="">Выбери</option>
                  {valueOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label>
                Продукт
                <select value={product} onChange={(e) => writeParams({ product: e.target.value })}>
                  <option value="all">Все</option>
                  <option value="gym_selected">Выбрали зал</option>
                  <option value="social">Social action</option>
                  <option value="workout">Workout</option>
                  <option value="ai">AI usage</option>
                </select>
              </label>
            )}
          </div>
          {!needsValue ? null : (
            <div className="admin-product-filters">
              <label>
                Продукт
                <select value={product} onChange={(e) => writeParams({ product: e.target.value })}>
                  <option value="all">Все</option>
                  <option value="gym_selected">Выбрали зал</option>
                  <option value="social">Social action</option>
                  <option value="workout">Workout</option>
                  <option value="ai">AI usage</option>
                </select>
              </label>
            </div>
          )}

          <section className="surface admin-rr-panel">
            <SectionTitle>Registration cohorts</SectionTitle>
            <p className="dim admin-rr-hint">
              Pooled exact-day. «мало» — меньше 8 человек с наступившим D+N. Не «вернулся хотя бы раз за N
              дней».
            </p>
            {!cohorts?.rows.length ? (
              <p className="dim">За период нет регистраций.</p>
            ) : (
              <div className="admin-overview-table-wrap">
                <table className="admin-overview-table">
                  <thead>
                    <tr>
                      <th>когорта</th>
                      <th>users</th>
                      {DAYS.map((day) => (
                        <th key={day}>R{day}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cohorts.rows.map((row) => {
                      const byDay = new Map(row.retention.map((cell) => [cell.day, cell]))
                      return (
                        <tr key={row.key}>
                          <td>{row.label}</td>
                          <td>{row.users}</td>
                          {DAYS.map((day) => (
                            <td key={day}>{formatCellRate(byDay.get(day))}</td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        <>
          <label className="admin-product-filters" style={{ display: 'grid' }}>
            <span>Выбрать действие</span>
            <select value={action} onChange={(e) => writeParams({ action: e.target.value })}>
              {AHA_ACTIONS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <p className="dim">
            Действие в первые {aha?.windowDays ?? 7} дней после регистрации (МСК). Иначе look-ahead:
            оставшиеся успеют сделать действие позже.
          </p>
          {aha ? <p className="admin-overview-problem">{aha.caption}</p> : null}
          <p className="dim">Корреляция, не причинно-следственная связь.</p>

          <section className="admin-overview-signals">
            <GroupCard title="Performed action" group={aha?.withAction} />
            <GroupCard title="Did not perform action" group={aha?.withoutAction} />
          </section>

          <section className="surface admin-rr-panel">
            <SectionTitle>Aha candidates</SectionTitle>
            <p className="dim admin-rr-hint">
              Ranking: (R7 с действием − R7 без) × √мин. выборки. 100% у трёх человек не станет главным
              Aha. Меньше {aha?.minSample ?? 8} с каждой стороны — «мало данных».
            </p>
            <div className="admin-overview-table-wrap">
              <table className="admin-overview-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Users</th>
                    <th>R7 with</th>
                    <th>R7 without</th>
                    <th>Difference</th>
                    <th>Sample size</th>
                  </tr>
                </thead>
                <tbody>
                  {(aha?.candidates ?? []).map((row) => (
                    <tr key={row.action} className={row.thin ? 'is-thin-sample' : undefined}>
                      <td>
                        <button
                          type="button"
                          className="text-link"
                          onClick={() => writeParams({ action: row.action, tab: 'aha' })}
                        >
                          {ahaActionLabel(row.action)}
                        </button>
                      </td>
                      <td>
                        {row.usersWith} / {row.usersWithout}
                      </td>
                      <td>{formatRate(row.r7With, row.thin)}</td>
                      <td>{formatRate(row.r7Without, row.thin)}</td>
                      <td>{row.thin ? 'мало данных' : formatSignedRate(row.difference)}</td>
                      <td>{row.sampleSize}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  )
}
