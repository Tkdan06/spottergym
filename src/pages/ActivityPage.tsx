import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ChartNoAxesColumn } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { SectionTitle } from '../components/SectionTitle'
import { useApp } from '../context/useApp'
import {
  apiFetchMyActivity,
  type ActivityRange,
  type ActivityStats,
} from '../lib/apiClient'
import './ActivityPage.css'
import './FeedbackPage.css'

const RANGES: { id: ActivityRange; label: string }[] = [
  { id: 7, label: '7д' },
  { id: 30, label: '30д' },
  { id: 90, label: '90д' },
]

function formatMinutes(total: number) {
  if (total <= 0) return '0 мин'
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h <= 0) return `${m} мин`
  if (m <= 0) return `${h} ч`
  return `${h} ч ${m} мин`
}

function formatDayLabel(dateKey: string, compact = false) {
  const d = new Date(`${dateKey}T12:00:00+03:00`)
  if (compact) {
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  }
  return d.toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export function ActivityPage() {
  const navigate = useNavigate()
  const { user, apiOnline } = useApp()
  const [range, setRange] = useState<ActivityRange>(30)
  const [stats, setStats] = useState<ActivityStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (nextRange: ActivityRange) => {
    setLoading(true)
    setError('')
    try {
      setStats(await apiFetchMyActivity(nextRange))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить статистику')
      setStats(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user || !apiOnline) return
    void load(range)
  }, [user, apiOnline, range, load])

  const maxMinutes = useMemo(() => {
    if (!stats?.days.length) return 1
    return Math.max(1, ...stats.days.map((d) => d.minutes))
  }, [stats])

  const chartDays = useMemo(() => {
    if (!stats) return []
    // For 90d show weekly-ish density still as daily but thinner; keep all days
    return stats.days
  }, [stats])

  if (!user) return <Navigate to="/login" replace />

  const empty = Boolean(stats && stats.totalSessions === 0)

  return (
    <main className="page activity-page">
      <button type="button" className="back-link" onClick={() => navigate('/app/profile')}>
        <ArrowLeft size={18} /> Профиль
      </button>

      <header className="activity-head">
        <div>
          <h1 className="page-title">
            <ChartNoAxesColumn size={22} aria-hidden /> Активность
          </h1>
          <p className="muted">Сколько ты был в зале — по отметкам «Я в зале»</p>
        </div>
      </header>

      {!apiOnline ? (
        <p className="muted">Нужен онлайн, чтобы загрузить историю чекинов.</p>
      ) : null}

      <div className="activity-range" role="tablist" aria-label="Период">
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={range === r.id}
            className={`activity-range-btn ${range === r.id ? 'is-active' : ''}`}
            onClick={() => setRange(r.id)}
            disabled={loading}
          >
            {r.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="feedback-error" role="alert">
          {error}
        </p>
      ) : null}

      {loading && !stats ? <p className="muted">Загружаем…</p> : null}

      {stats ? (
        <>
          <section className="activity-hero" aria-label="Сводка">
            <article className="activity-stat">
              <span className="muted">Визиты</span>
              <strong>{stats.totalSessions}</strong>
            </article>
            <article className="activity-stat">
              <span className="muted">Время</span>
              <strong>{formatMinutes(stats.totalMinutes)}</strong>
            </article>
            <article className="activity-stat">
              <span className="muted">Серия</span>
              <strong>
                {stats.streakDays}
                <span className="activity-stat-unit"> дн</span>
              </strong>
            </article>
          </section>

          {empty ? (
            <section className="surface activity-empty">
              <SectionTitle>Пока пусто</SectionTitle>
              <p className="muted">
                Отмечайся «Я в зале» — так копится история визитов и график времени.
              </p>
              <Link to="/app/profile" className="btn btn-primary btn-block">
                К отметке на профиле
              </Link>
            </section>
          ) : (
            <>
              <section className="surface activity-chart-block">
                <SectionTitle>Время по дням</SectionTitle>
                <p className="dim activity-chart-hint">Минуты в зале · МСК</p>
                <div
                  className={`activity-chart range-${stats.range}`}
                  role="img"
                  aria-label="График минут по дням"
                >
                  {chartDays.map((day) => {
                    const tall = day.minutes / maxMinutes
                    const isMax = stats.busiestDay?.date === day.date
                    const isMin = stats.quietestDay?.date === day.date
                    return (
                      <div
                        key={day.date}
                        className={`activity-bar-col ${isMax ? 'is-max' : ''} ${isMin ? 'is-min' : ''}`}
                        title={`${formatDayLabel(day.date)} · ${formatMinutes(day.minutes)} · ${day.sessions} визит.`}
                      >
                        <div className="activity-bar-track">
                          <div
                            className="activity-bar"
                            style={{ height: `${Math.max(day.minutes > 0 ? 8 : 0, tall * 100)}%` }}
                          />
                        </div>
                        {stats.range === 7 ? (
                          <span className="activity-bar-label">{formatDayLabel(day.date, true)}</span>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
                {stats.range !== 7 ? (
                  <div className="activity-chart-axis">
                    <span>{formatDayLabel(stats.days[0]?.date || '', true)}</span>
                    <span>
                      {formatDayLabel(stats.days[stats.days.length - 1]?.date || '', true)}
                    </span>
                  </div>
                ) : null}
              </section>

              <section className="activity-highlights">
                {stats.busiestDay ? (
                  <article className="surface activity-highlight is-max">
                    <span className="muted">Больше всего</span>
                    <strong>{formatDayLabel(stats.busiestDay.date)}</strong>
                    <p className="dim">
                      {formatMinutes(stats.busiestDay.minutes)} · {stats.busiestDay.sessions}{' '}
                      {stats.busiestDay.sessions === 1 ? 'визит' : 'визита'}
                    </p>
                  </article>
                ) : null}
                {stats.quietestDay ? (
                  <article className="surface activity-highlight is-min">
                    <span className="muted">Меньше всего</span>
                    <strong>{formatDayLabel(stats.quietestDay.date)}</strong>
                    <p className="dim">
                      {formatMinutes(stats.quietestDay.minutes)} · {stats.quietestDay.sessions}{' '}
                      {stats.quietestDay.sessions === 1 ? 'визит' : 'визита'}
                    </p>
                  </article>
                ) : null}
              </section>

              <p className="dim activity-footnote">
                Серия — подряд идущие дни с хотя бы одной отметкой. Открытый чекин считается до
                выхода или авто-окончания.
              </p>
            </>
          )}
        </>
      ) : null}
    </main>
  )
}
