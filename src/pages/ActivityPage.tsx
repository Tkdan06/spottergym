import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Clock3,
  Flame,
  Moon,
  RotateCcw,
  Timer,
} from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { SectionTitle } from '../components/SectionTitle'
import { useApp } from '../context/useApp'
import {
  apiFetchMyActivity,
  apiResetMyActivity,
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

function yAxisCeilingMinutes(maxMinutes: number) {
  if (maxMinutes <= 0) return 60
  const hours = Math.max(1, Math.ceil(maxMinutes / 60))
  return hours * 60
}

function yAxisTicks(ceilingMinutes: number) {
  const hours = Math.max(1, Math.round(ceilingMinutes / 60))
  const step = hours <= 2 ? 1 : hours <= 4 ? 1 : Math.ceil(hours / 3)
  const ticks: number[] = []
  for (let h = hours; h >= 0; h -= step) {
    ticks.push(h * 60)
    if (h === 0) break
  }
  if (ticks[ticks.length - 1] !== 0) ticks.push(0)
  return ticks
}

export function ActivityPage() {
  const navigate = useNavigate()
  const { user, apiOnline } = useApp()
  const [range, setRange] = useState<ActivityRange>(30)
  const [stats, setStats] = useState<ActivityStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState('')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const load = useCallback(async (nextRange: ActivityRange) => {
    setLoading(true)
    setError('')
    try {
      const next = await apiFetchMyActivity(nextRange)
      setStats(next)
      setSelectedDate((prev) => {
        if (prev && next.days.some((d) => d.date === prev && d.minutes > 0)) return prev
        const lastActive = [...next.days].reverse().find((d) => d.minutes > 0)
        return lastActive?.date ?? null
      })
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
    if (!stats?.days.length) return 0
    return Math.max(0, ...stats.days.map((d) => d.minutes))
  }, [stats])

  const ceilingMinutes = useMemo(() => yAxisCeilingMinutes(maxMinutes), [maxMinutes])
  const ticks = useMemo(() => yAxisTicks(ceilingMinutes), [ceilingMinutes])

  const selectedDay = useMemo(() => {
    if (!stats || !selectedDate) return null
    return stats.days.find((d) => d.date === selectedDate) || null
  }, [stats, selectedDate])

  const onReset = async () => {
    if (resetting || !apiOnline) return
    const ok = window.confirm(
      'Сбросить историю активности? График очистится. Текущая отметка «Я в зале» останется.',
    )
    if (!ok) return
    setResetting(true)
    setError('')
    try {
      await apiResetMyActivity()
      await load(range)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сбросить активность')
    } finally {
      setResetting(false)
    }
  }

  if (!user) return <Navigate to="/login" replace />

  const empty = Boolean(stats && stats.totalMinutes === 0 && stats.totalSessions === 0)

  return (
    <main className="page activity-page">
      <button type="button" className="back-link" onClick={() => navigate(-1)}>
        <ArrowLeft size={18} /> Назад
      </button>

      <header className="activity-head">
        <h1 className="page-title">Активность</h1>
        <p className="muted">Время в зале по отметкам</p>
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
            disabled={loading || resetting}
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
            <div className="activity-hero-icon" aria-hidden>
              <Timer size={22} />
            </div>
            <div className="activity-hero-copy">
              <span className="muted">Всего за период</span>
              <strong>{formatMinutes(stats.totalMinutes)}</strong>
            </div>
          </section>

          {empty ? (
            <section className="surface activity-empty">
              <SectionTitle>Пока пусто</SectionTitle>
              <p className="muted">
                Отмечайся «Я в зале» — здесь появится график времени по дням.
              </p>
              <Link to="/app" className="btn btn-primary btn-block">
                К отметке в зале
              </Link>
            </section>
          ) : (
            <>
              <section className="surface activity-chart-block">
                <div className="activity-chart-head">
                  <SectionTitle>График</SectionTitle>
                  <p className="dim activity-chart-hint">Часы · МСК · нажми день</p>
                </div>

                <div
                  className={`activity-chart-frame range-${stats.range}`}
                  role="img"
                  aria-label="График времени в зале по дням"
                >
                  <div className="activity-y-axis" aria-hidden>
                    {ticks.map((mins) => (
                      <span key={mins} className="activity-y-tick">
                        {mins === 0 ? '0' : `${Math.round(mins / 60)}ч`}
                      </span>
                    ))}
                  </div>

                  <div className="activity-plot">
                    <div className="activity-plot-grid" aria-hidden>
                      {ticks.map((mins) => (
                        <i
                          key={mins}
                          className="activity-grid-line"
                          style={{ bottom: `${(mins / ceilingMinutes) * 100}%` }}
                        />
                      ))}
                    </div>

                    <div className="activity-bars">
                      {stats.days.map((day) => {
                        const tall = day.minutes / ceilingMinutes
                        const isSelected = selectedDate === day.date
                        const isMax = stats.busiestDay?.date === day.date
                        return (
                          <button
                            key={day.date}
                            type="button"
                            className={`activity-bar-col ${isSelected ? 'is-selected' : ''} ${
                              isMax ? 'is-max' : ''
                            } ${day.minutes <= 0 ? 'is-empty' : ''}`}
                            aria-pressed={isSelected}
                            aria-label={`${formatDayLabel(day.date)} · ${formatMinutes(day.minutes)}`}
                            onClick={() => setSelectedDate(day.date)}
                          >
                            <span className="activity-bar-track">
                              <span
                                className="activity-bar"
                                style={{
                                  height: `${day.minutes > 0 ? Math.max(6, tall * 100) : 0}%`,
                                }}
                              />
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div className="activity-chart-axis">
                  <span>{formatDayLabel(stats.days[0]?.date || '', true)}</span>
                  <span>
                    {formatDayLabel(stats.days[stats.days.length - 1]?.date || '', true)}
                  </span>
                </div>

                {selectedDay ? (
                  <div className="activity-day-card" aria-live="polite">
                    <div className="activity-day-card-icon" aria-hidden>
                      <Clock3 size={18} />
                    </div>
                    <div className="activity-day-card-copy">
                      <strong>{formatDayLabel(selectedDay.date)}</strong>
                      <p>
                        {selectedDay.minutes > 0
                          ? formatMinutes(selectedDay.minutes)
                          : 'В этот день отметок не было'}
                      </p>
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="activity-highlights" aria-label="Пики">
                {stats.busiestDay ? (
                  <article className="surface activity-highlight is-max">
                    <span className="activity-highlight-icon" aria-hidden>
                      <Flame size={18} />
                    </span>
                    <span className="muted">Пик</span>
                    <strong>{formatMinutes(stats.busiestDay.minutes)}</strong>
                    <p className="dim">{formatDayLabel(stats.busiestDay.date)}</p>
                  </article>
                ) : null}
                {stats.quietestDay ? (
                  <article className="surface activity-highlight is-min">
                    <span className="activity-highlight-icon" aria-hidden>
                      <Moon size={18} />
                    </span>
                    <span className="muted">Меньше</span>
                    <strong>{formatMinutes(stats.quietestDay.minutes)}</strong>
                    <p className="dim">{formatDayLabel(stats.quietestDay.date)}</p>
                  </article>
                ) : null}
              </section>
            </>
          )}

          {!empty ? (
            <div className="activity-reset">
              <button
                type="button"
                className="btn btn-danger btn-block activity-reset-btn"
                onClick={() => void onReset()}
                disabled={resetting || !apiOnline}
              >
                <RotateCcw size={16} aria-hidden />
                {resetting ? 'Сбрасываем…' : 'Сбросить активность'}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </main>
  )
}
