import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { SectionTitle } from '../components/SectionTitle'
import { SubpageHeader } from '../components/SubpageHeader'
import { useApp } from '../context/useApp'
import {
  formatGymCount,
  formatGymRate,
  formatPearson,
  GYM_SORT_OPTIONS,
  isGymSortKey,
  type AdminGymsPayload,
  type GymRow,
  type GymSortKey,
} from '../lib/adminGyms'
import {
  isOverviewPreset,
  OVERVIEW_PRESET_LABEL,
  OVERVIEW_PRESETS,
  type OverviewPreset,
} from '../lib/adminProductOverview'
import { formatAdminDate } from '../lib/adminStats'
import { apiAdminFetchGyms } from '../lib/apiClient'
import './FeedbackPage.css'
import './AdminPlayersPage.css'

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <article className="admin-stat-card">
      <span className="muted">{label}</span>
      <strong>{value}</strong>
      {hint ? <p className="dim">{hint}</p> : null}
    </article>
  )
}

function Retention({ cell }: { cell: GymRow['r7'] }) {
  const label = formatGymRate(cell.rate)
  return (
    <span>
      {label}
      {cell.thin ? <span className="dim"> · n={cell.eligible}</span> : null}
    </span>
  )
}

function GymTable({ rows, compact }: { rows: GymRow[]; compact?: boolean }) {
  return (
    <div className="admin-overview-table-wrap">
      <table className="admin-overview-table">
        <thead>
          <tr>
            <th>Зал</th>
            <th>Users</th>
            <th>Active</th>
            {!compact ? <th>Today</th> : null}
            {!compact ? <th>WAU</th> : null}
            {!compact ? <th>MAU</th> : null}
            <th>R7</th>
            {!compact ? <th>R30</th> : null}
            <th>Social</th>
            {!compact ? <th>Chats</th> : null}
            {!compact ? <th>Workouts</th> : null}
            <th>Check-ins</th>
            {!compact ? <th>People</th> : null}
            {!compact ? <th>Growth</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={row.r7.thin || row.empty || !row.catalog ? 'is-thin-sample' : undefined}
            >
              <td>
                {row.name}
                <span className="dim">
                  {' '}
                  {row.catalog ? `${row.network} · ${row.city}` : row.network}
                  {row.empty ? ' · empty' : ''}
                  {row.lowDensity ? ' · low density' : ''}
                </span>
              </td>
              <td>{formatGymCount(row.totalUsers)}</td>
              <td>{formatGymCount(row.activeUsers)}</td>
              {!compact ? <td>{formatGymCount(row.activeToday)}</td> : null}
              {!compact ? <td>{formatGymCount(row.wau)}</td> : null}
              {!compact ? <td>{formatGymCount(row.mau)}</td> : null}
              <td>
                <Retention cell={row.r7} />
              </td>
              {!compact ? (
                <td>
                  <Retention cell={row.r30} />
                </td>
              ) : null}
              <td>
                {formatGymCount(row.socialActors)}
                <span className="dim"> · {formatGymCount(row.socialActions)}</span>
              </td>
              {!compact ? <td>{formatGymCount(row.chats)}</td> : null}
              {!compact ? <td>{formatGymCount(row.workouts)}</td> : null}
              <td>{formatGymCount(row.checkIns)}</td>
              {!compact ? <td>{formatGymCount(row.members)}</td> : null}
              {!compact ? <td>{formatGymCount(row.growth)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length ? <p className="dim">Нет залов.</p> : null}
    </div>
  )
}

function Dist({
  title,
  buckets,
  p50,
  p90,
}: {
  title: string
  buckets: { label: string; gyms: number }[]
  p50: number | null
  p90: number | null
}) {
  return (
    <article className="surface admin-rr-panel">
      <SectionTitle>{title}</SectionTitle>
      <p className="dim admin-rr-hint">
        p50 = {p50 ?? '—'} · p90 = {p90 ?? '—'} · nearest-rank по каталогу, включая пустые
      </p>
      <ul className="admin-overview-signal-list">
        {buckets.map((bucket) => (
          <li key={bucket.label}>
            <span>{bucket.label}</span>
            <strong>{formatGymCount(bucket.gyms)}</strong>
          </li>
        ))}
      </ul>
    </article>
  )
}

export function AdminGymsPage() {
  const navigate = useNavigate()
  const { user, canViewUsers } = useApp()
  const [params, setParams] = useSearchParams()
  const rawPreset = params.get('preset')
  const preset: OverviewPreset = isOverviewPreset(rawPreset) ? rawPreset : '30d'
  const rawSort = params.get('sort')
  const sort: GymSortKey = isGymSortKey(rawSort) ? rawSort : 'activeUsers'
  const fromParam = params.get('from') || ''
  const toParam = params.get('to') || ''
  const [customFrom, setCustomFrom] = useState(fromParam)
  const [customTo, setCustomTo] = useState(toParam)
  const [data, setData] = useState<AdminGymsPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const query = useMemo(
    () => ({
      preset,
      sort,
      from: preset === 'custom' ? fromParam : undefined,
      to: preset === 'custom' ? toParam : undefined,
    }),
    [preset, sort, fromParam, toParam],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await apiAdminFetchGyms(query))
    } catch (err) {
      setData(null)
      setError(err instanceof Error ? err.message : 'Не удалось загрузить залы')
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    void load()
  }, [load])

  if (!user?.isAdmin) return <Navigate to="/app/profile" replace />
  if (!canViewUsers) return <Navigate to="/app/admin" replace />

  const writeParams = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key)
      else next.set(key, value)
    }
    setParams(next, { replace: true })
  }

  const current = data?.current
  const density = data?.density
  const network = data?.network
  const viewed = data?.viewed

  return (
    <main className="page admin-page admin-players-page admin-overview-page">
      <SubpageHeader
        title="Залы"
        onBack={() => navigate('/app/admin')}
        action={
          <button type="button" className="btn-icon-refresh" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={22} strokeWidth={2.4} />
          </button>
        }
      />
      <p className="muted">
        Где сеть уже даёт социальную плотность · МСК
        {data ? ` · ${data.range.fromKey} — ${data.range.toKey}` : ''}
        {data ? ` · обновлено ${formatAdminDate(data.generatedAt)}` : ''}
        {loading ? ' · обновляем…' : ''}
      </p>

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

      <section className="surface admin-rr-panel">
        <SectionTitle>Current gym</SectionTitle>
        <p className="dim admin-rr-hint">
          Домашний зал сейчас (`homeGymId`). Истории смены зала нет. Пользователи без зала и залы вне
          каталога — отдельно, не ошибка.
        </p>
        <div className="admin-stat-grid admin-overview-kpi-3">
          <Kpi label="Users" value={formatGymCount(current?.users)} hint={`клубов с людьми ${formatGymCount(current?.gymsWithUsers)}`} />
          <Kpi label="Active users" value={formatGymCount(current?.activeUsers)} hint="lastSeen в периоде" />
          <Kpi
            label="Social activity"
            value={formatGymCount(current?.socialActors)}
            hint={`${formatGymCount(current?.socialActions)} действий · ${formatGymCount(current?.chats)} чатов`}
          />
          <Kpi
            label="Retention R7"
            value={formatGymRate(current?.r7.rate)}
            hint={current?.r7.thin ? `мало наблюдений · n=${current.r7.eligible}` : `n=${current?.r7.eligible ?? 0}`}
          />
          <Kpi label="R30" value={formatGymRate(current?.r30.rate)} hint={`n=${current?.r30.eligible ?? 0}`} />
          <Kpi
            label="Без зала / нет в каталоге"
            value={`${formatGymCount(current?.noHomeUsers)} / ${formatGymCount(current?.missingCatalogUsers)}`}
            hint="onboarding skip и stale homeGymId"
          />
        </div>
      </section>

      <section className="surface admin-rr-panel">
        <SectionTitle>Social density</SectionTitle>
        <p className="dim admin-rr-hint">
          Фактическое распределение по каталогу. Порогов продукта нет — только наблюдаемые корзины и
          перцентили.
        </p>
        {density ? (
          <div className="admin-overview-signals">
            <Dist
              title="Users per gym"
              buckets={density.usersPerGym}
              p50={density.percentiles.users.p50}
              p90={density.percentiles.users.p90}
            />
            <Dist
              title="Active users per gym"
              buckets={density.activePerGym}
              p50={density.percentiles.active.p50}
              p90={density.percentiles.active.p90}
            />
            <Dist
              title="People available"
              buckets={density.peopleAvailablePerGym}
              p50={density.percentiles.members.p50}
              p90={density.percentiles.members.p90}
            />
            <Dist
              title="Social interactions"
              buckets={density.socialPerGym}
              p50={density.percentiles.socialActors.p50}
              p90={density.percentiles.socialActors.p90}
            />
          </div>
        ) : null}
      </section>

      <section className="surface admin-rr-panel">
        <SectionTitle>Gym ranking</SectionTitle>
        <p className="dim admin-rr-hint">
          Users / Active / R* — current gym. Social / chats / workouts — home gym актёра. Check-ins —
          viewed gym. People — участники UserGym (кого видит карточка зала).
        </p>
        <div className="admin-filter-bar" role="tablist" aria-label="Сортировка">
          {GYM_SORT_OPTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`admin-filter-btn ${sort === item.id ? 'is-active' : ''}`}
              onClick={() => writeParams({ sort: item.id })}
            >
              {item.label}
            </button>
          ))}
        </div>
        <GymTable rows={data?.gyms ?? []} />
      </section>

      <section className="surface admin-rr-panel">
        <SectionTitle>Network effect signal</SectionTitle>
        <p className="dim admin-rr-hint">
          Исследование: active users vs social rate vs R7. Корреляция, не причина. «—» если n &lt; 8
          или нет дисперсии.
        </p>
        <div className="admin-stat-grid admin-overview-kpi-3">
          <Kpi
            label="Active vs social rate"
            value={formatPearson(network?.correlations.activeVsSocial)}
            hint={`n=${network?.correlations.activeVsSocial.n ?? 0}${network?.correlations.activeVsSocial.thin ? ' · thin' : ''}`}
          />
          <Kpi
            label="Active vs R7"
            value={formatPearson(network?.correlations.activeVsR7)}
            hint={`n=${network?.correlations.activeVsR7.n ?? 0}${network?.correlations.activeVsR7.thin ? ' · thin' : ''}`}
          />
          <Kpi
            label="Social rate vs R7"
            value={formatPearson(network?.correlations.socialVsR7)}
            hint={`n=${network?.correlations.socialVsR7.n ?? 0}${network?.correlations.socialVsR7.thin ? ' · thin' : ''}`}
          />
        </div>
        <div className="admin-overview-table-wrap">
          <table className="admin-overview-table">
            <thead>
              <tr>
                <th>Зал</th>
                <th>Active</th>
                <th>Social rate</th>
                <th>R7</th>
              </tr>
            </thead>
            <tbody>
              {(network?.points ?? []).map((point) => (
                <tr key={point.id} className={point.r7Eligible < 8 ? 'is-thin-sample' : undefined}>
                  <td>{point.name}</td>
                  <td>{formatGymCount(point.activeUsers)}</td>
                  <td>{formatGymRate(point.socialRate)}</td>
                  <td>{formatGymRate(point.r7)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!network?.points.length ? <p className="dim">Нет клубов с домашними пользователями.</p> : null}
        </div>
      </section>

      <section className="surface admin-rr-panel">
        <SectionTitle>Low density</SectionTitle>
        <p className="dim admin-rr-hint">
          Левый хвост наблюдаемого распределения: есть домашние пользователи, active ≤ 1. Это
          возможность продукта, не ошибка данных. Empty — каталог без домашних пользователей.
        </p>
        <GymTable rows={data?.lowDensity ?? []} compact />
        {(data?.empty ?? []).length ? (
          <p className="dim">
            Empty: {data?.empty.map((row) => row.name).join(', ')}
          </p>
        ) : (
          <p className="dim">Пустых клубов в каталоге нет.</p>
        )}
      </section>

      <section className="surface admin-rr-panel">
        <SectionTitle>Other gyms</SectionTitle>
        <p className="dim admin-rr-hint">
          Смотреть чужой зал — продуктовая механика. Current = homeGymId. Viewed = чекин в этом клубе.
          `people_list_viewed` с surface=gym без gymId: один счётчик на все карточки, не разложить по
          клубам.
        </p>
        <div className="admin-stat-grid admin-overview-kpi-3">
          <Kpi label="Check-in users" value={formatGymCount(viewed?.checkInUsers)} hint="unique, любой клуб" />
          <Kpi
            label="Viewed other gym"
            value={formatGymCount(viewed?.checkInOtherGymUsers)}
            hint="чекин ≠ current gym"
          />
          <Kpi
            label="People list · home"
            value={formatGymCount(viewed?.peopleListHome)}
            hint="surface=home"
          />
          <Kpi
            label="People list · gym card"
            value={formatGymCount(viewed?.peopleListGymCard)}
            hint="без gymId · все клубы одной сессией"
          />
        </div>
        <div className="admin-overview-table-wrap">
          <table className="admin-overview-table">
            <thead>
              <tr>
                <th>Зал</th>
                <th>Current users</th>
                <th>Viewed users</th>
                <th>Viewed other</th>
                <th>Check-ins</th>
              </tr>
            </thead>
            <tbody>
              {(viewed?.rows ?? []).map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{formatGymCount(row.homeUsers)}</td>
                  <td>{formatGymCount(row.viewedUsers)}</td>
                  <td>{formatGymCount(row.viewedOtherUsers)}</td>
                  <td>{formatGymCount(row.checkIns)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!viewed?.rows.length ? <p className="dim">Нет current или viewed активности.</p> : null}
        </div>
      </section>
    </main>
  )
}
