import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { SectionTitle } from '../components/SectionTitle'
import { SubpageHeader } from '../components/SubpageHeader'
import { useApp } from '../context/useApp'
import {
  type AdminEventDebugPayload,
  type AdminTimelinePayload,
  TIMELINE_DOMAIN_OPTIONS,
  type TimelineEntry,
  type TimelineSearchHit,
} from '../lib/adminTimeline'
import {
  isOverviewPreset,
  OVERVIEW_PRESET_LABEL,
  OVERVIEW_PRESETS,
  type OverviewPreset,
} from '../lib/adminProductOverview'
import { formatAdminDate } from '../lib/adminStats'
import { searchFieldProps } from '../lib/inputAttrs'
import {
  apiAdminFetchEventDebug,
  apiAdminFetchTimeline,
  apiAdminSearchTimelineUsers,
} from '../lib/apiClient'
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

function metaLines(meta: Record<string, string>) {
  const keys = Object.keys(meta)
  if (!keys.length) return '—'
  return keys.map((key) => `${key}: ${meta[key]}`).join(' · ')
}

function TimelineItem({ entry, userLabel }: { entry: TimelineEntry; userLabel: string }) {
  return (
    <li className="admin-timeline-item">
      <details>
        <summary>
          <strong>{entry.event}</strong>
          <span className="dim">
            {' '}
            {entry.domain} · {formatAdminDate(entry.at)}
            {entry.kind === 'fact' ? ' · факт' : ''}
          </span>
        </summary>
        <dl className="admin-detail-grid">
          <div>
            <dt>Event</dt>
            <dd>
              {entry.event} <span className="dim">{entry.eventKey}</span>
            </dd>
          </div>
          <div>
            <dt>Timestamp</dt>
            <dd>{formatAdminDate(entry.at)}</dd>
          </div>
          <div>
            <dt>User</dt>
            <dd>{userLabel}</dd>
          </div>
          <div>
            <dt>Domain</dt>
            <dd>{entry.domain}</dd>
          </div>
          <div>
            <dt>Metadata</dt>
            <dd>{metaLines(entry.metadata)}</dd>
          </div>
          <div>
            <dt>Event ID</dt>
            <dd>{entry.id}</dd>
          </div>
        </dl>
      </details>
    </li>
  )
}

export function AdminTimelinePage() {
  const navigate = useNavigate()
  const { user, canViewUsers } = useApp()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'debug' ? 'debug' : 'timeline'
  const userId = params.get('userId') || ''
  const rawPreset = params.get('preset')
  const preset: OverviewPreset = isOverviewPreset(rawPreset) ? rawPreset : '30d'
  const fromParam = params.get('from') || ''
  const toParam = params.get('to') || ''
  const domain = params.get('domain') || ''
  const event = params.get('event') || ''
  const source = params.get('source') || ''
  const debugName = params.get('name') || ''
  const [customFrom, setCustomFrom] = useState(fromParam)
  const [customTo, setCustomTo] = useState(toParam)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<TimelineSearchHit[]>([])
  const [searchError, setSearchError] = useState('')
  const [data, setData] = useState<AdminTimelinePayload | null>(null)
  const [debug, setDebug] = useState<AdminEventDebugPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const rangeQuery = useMemo(
    () => ({
      preset,
      from: preset === 'custom' ? fromParam : undefined,
      to: preset === 'custom' ? toParam : undefined,
    }),
    [preset, fromParam, toParam],
  )

  const writeParams = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key)
      else next.set(key, value)
    }
    setParams(next, { replace: true })
  }

  const loadTimeline = useCallback(
    async (cursor?: string, append = false) => {
      if (!userId) {
        setData(null)
        return
      }
      setLoading(true)
      setError('')
      try {
        const page = await apiAdminFetchTimeline({
          userId,
          ...rangeQuery,
          domain: domain || undefined,
          event: event || undefined,
          source: source || undefined,
          cursor,
        })
        setData((prev) =>
          append && prev
            ? {
                ...page,
                entries: [...prev.entries, ...page.entries],
                hasMore: page.hasMore,
                nextCursor: page.nextCursor,
              }
            : page,
        )
      } catch (err) {
        if (!append) setData(null)
        setError(err instanceof Error ? err.message : 'Не удалось загрузить таймлайн')
      } finally {
        setLoading(false)
      }
    },
    [userId, rangeQuery, domain, event, source],
  )

  const loadDebug = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setDebug(
        await apiAdminFetchEventDebug({
          ...rangeQuery,
          name: debugName || undefined,
          userId: userId || undefined,
        }),
      )
    } catch (err) {
      setDebug(null)
      setError(err instanceof Error ? err.message : 'Не удалось загрузить debugger')
    } finally {
      setLoading(false)
    }
  }, [rangeQuery, debugName, userId])

  useEffect(() => {
    if (tab === 'debug') void loadDebug()
    else void loadTimeline()
  }, [tab, loadDebug, loadTimeline])

  const onSearch = async (e: FormEvent) => {
    e.preventDefault()
    setSearchError('')
    try {
      setHits(await apiAdminSearchTimelineUsers(q))
    } catch (err) {
      setHits([])
      setSearchError(err instanceof Error ? err.message : 'Поиск не удался')
    }
  }

  if (!user?.isAdmin) return <Navigate to="/app/profile" replace />
  if (!canViewUsers) return <Navigate to="/app/admin" replace />

  const userLabel = data
    ? `${data.user.name} · @${data.user.username}`
    : userId || '—'

  return (
    <main className="page admin-page admin-players-page admin-overview-page">
      <SubpageHeader
        title="Таймлайн"
        onBack={() => navigate('/app/admin')}
        action={
          <button
            type="button"
            className="btn-icon-refresh"
            onClick={() => void (tab === 'debug' ? loadDebug() : loadTimeline())}
            disabled={loading}
          >
            <RefreshCw size={22} strokeWidth={2.4} />
          </button>
        }
      />
      <p className="muted">
        Диагностика продуктовой аналитики · МСК
        {data ? ` · ${data.range.fromKey} — ${data.range.toKey}` : ''}
        {debug && tab === 'debug' ? ` · ${debug.range.fromKey} — ${debug.range.toKey}` : ''}
        {loading ? ' · обновляем…' : ''}
      </p>

      <nav className="admin-filter-bar" aria-label="Режим">
        <button
          type="button"
          className={`admin-filter-btn ${tab === 'timeline' ? 'is-active' : ''}`}
          onClick={() => writeParams({ tab: 'timeline' })}
        >
          Timeline
        </button>
        <button
          type="button"
          className={`admin-filter-btn ${tab === 'debug' ? 'is-active' : ''}`}
          onClick={() => writeParams({ tab: 'debug' })}
        >
          Debugger
        </button>
      </nav>

      <form className="admin-timeline-search" onSubmit={(e) => void onSearch(e)}>
        <label>
          Пользователь
          <input
            {...searchFieldProps}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="id, username, имя или email"
          />
        </label>
        <button type="submit" className="btn btn-soft">
          Найти
        </button>
      </form>
      {searchError ? <p className="admin-inline-error">{searchError}</p> : null}
      {hits.length ? (
        <ul className="admin-timeline-hits">
          {hits.map((hit) => (
            <li key={hit.id}>
              <button type="button" className="admin-filter-btn" onClick={() => writeParams({ userId: hit.id })}>
                {hit.name} <span className="dim">@{hit.username}</span>
                {hit.deleted ? <span className="dim"> · удалён</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

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

      {tab === 'timeline' ? (
        <>
          <div className="admin-product-filters">
            <label>
              Domain
              <select value={domain} onChange={(e) => writeParams({ domain: e.target.value })}>
                <option value="">Все</option>
                {(data?.options.domains ?? TIMELINE_DOMAIN_OPTIONS).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Event
              <select value={event} onChange={(e) => writeParams({ event: e.target.value })}>
                <option value="">Все</option>
                {(data?.options.events ?? [])
                  .filter((item) => !domain || item.domain === domain)
                  .map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Source
              <select value={source} onChange={(e) => writeParams({ source: e.target.value })}>
                <option value="">Все</option>
                {['direct', 'fact', ...(data?.options.sources ?? [])]
                  .filter((value, i, all) => all.indexOf(value) === i)
                  .map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          {data ? (
            <section className="surface admin-rr-panel">
              <SectionTitle>Current user</SectionTitle>
              <p className="dim admin-rr-hint">
                {data.user.name} · @{data.user.username} · {data.user.email}
                {data.user.deleted ? ' · удалён' : ''}
              </p>
            </section>
          ) : (
            <p className="dim">Найди пользователя: id, username, имя или email. IP и пароли не ищем.</p>
          )}

          <section className="surface admin-rr-panel">
            <SectionTitle>Product timeline</SectionTitle>
            <p className="dim admin-rr-hint">
              Registration → Gym → People → Profile → Like → Request → Chat → Workout → Activity →
              Progress → AI. Не дамп БД: без текстов чатов, весов и секретов. Страница с сервера.
            </p>
            {data?.entries.length ? (
              <ol className="admin-timeline-list">
                {data.entries.map((entry) => (
                  <TimelineItem key={entry.id} entry={entry} userLabel={userLabel} />
                ))}
              </ol>
            ) : (
              <p className="dim">{userId ? 'Нет событий в периоде.' : 'Пользователь не выбран.'}</p>
            )}
            {data?.hasMore && data.nextCursor ? (
              <button
                type="button"
                className="btn btn-soft"
                disabled={loading}
                onClick={() => void loadTimeline(data.nextCursor ?? undefined, true)}
              >
                Ещё
              </button>
            ) : null}
          </section>
        </>
      ) : (
        <>
          <label className="admin-timeline-debug-name">
            Event name
            <input
              {...searchFieldProps}
              value={debugName}
              onChange={(e) => writeParams({ name: e.target.value })}
              placeholder="необязательно · like_sent"
            />
          </label>
          <section className="admin-stat-grid admin-overview-kpi-3">
            <Kpi label="Event count" value={String(debug?.eventCount ?? 0)} hint="LandingEvent в периоде" />
            <Kpi label="Unique users" value={String(debug?.uniqueUsers ?? 0)} />
            <Kpi label="Missing userId" value={String(debug?.missingUserId ?? 0)} hint="часто landing до входа" />
            <Kpi label="Duplicates" value={String(debug?.duplicates.groups ?? 0)} hint="то же имя+user+секунда" />
            <Kpi label="Invalid timestamp" value={String(debug?.invalidTimestamp.count ?? 0)} hint="будущее или &lt; 2020" />
            <Kpi
              label="Invalid references"
              value={String(debug?.invalidReferences.count ?? 0)}
              hint="userId без User"
            />
          </section>
          <section className="surface admin-rr-panel">
            <SectionTitle>By event</SectionTitle>
            <div className="admin-overview-table-wrap">
              <table className="admin-overview-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Count</th>
                    <th>Users</th>
                    <th>No userId</th>
                  </tr>
                </thead>
                <tbody>
                  {(debug?.byName ?? []).map((row) => (
                    <tr key={row.name}>
                      <td>{row.name}</td>
                      <td>{row.events}</td>
                      <td>{row.uniqueUsers}</td>
                      <td>{row.missingUserId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="admin-overview-signals">
            <article className="surface admin-rr-panel">
              <SectionTitle>Duplicates</SectionTitle>
              <ul className="admin-overview-signal-list">
                {(debug?.duplicates.sample ?? []).map((row) => (
                  <li key={`${row.name}-${row.userId}-${row.at}`}>
                    <span>
                      {row.name} <span className="dim">{row.userId || '—'}</span>
                    </span>
                    <strong>×{row.count}</strong>
                  </li>
                ))}
              </ul>
              {!debug?.duplicates.sample.length ? <p className="dim">Нет в выборке.</p> : null}
            </article>
            <article className="surface admin-rr-panel">
              <SectionTitle>Invalid refs / timestamps</SectionTitle>
              <ul className="admin-overview-signal-list">
                {(debug?.invalidReferences.sample ?? []).map((row) => (
                  <li key={row.id}>
                    <span>
                      {row.name} <span className="dim">user {row.userId}</span>
                    </span>
                    <strong>dangling</strong>
                  </li>
                ))}
                {(debug?.invalidTimestamp.sample ?? []).map((row) => (
                  <li key={row.id}>
                    <span>{row.name}</span>
                    <strong>ts</strong>
                  </li>
                ))}
              </ul>
            </article>
          </section>
        </>
      )}
    </main>
  )
}
