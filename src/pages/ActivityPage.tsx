import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, MoreHorizontal, RotateCcw } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useApp } from '../context/useApp'
import {
  apiFetchMyActivity,
  apiResetMyActivity,
  type ActivityRange,
  type ActivityStats,
} from '../lib/apiClient'
import { useSheetA11y } from '../lib/sheetA11y'
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

/** Local browser timezone clock, e.g. "22:05". */
function formatLocalClock(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** "22:05 – 23:40" or several sessions joined; empty if no intervals. */
function formatLocalTrainingWindow(intervals: { start: string; end: string }[]) {
  if (!intervals.length) return ''
  if (intervals.length === 1) {
    const [one] = intervals
    return `${formatLocalClock(one.start)} – ${formatLocalClock(one.end)}`
  }
  const starts = intervals.map((i) => Date.parse(i.start))
  const ends = intervals.map((i) => Date.parse(i.end))
  const from = new Date(Math.min(...starts)).toISOString()
  const to = new Date(Math.max(...ends)).toISOString()
  return `${formatLocalClock(from)} – ${formatLocalClock(to)}`
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

function sessionsLabel(count: number) {
  const n = Math.abs(count) % 100
  const n1 = n % 10
  if (n > 10 && n < 20) return `${count} тренировок`
  if (n1 === 1) return `${count} тренировка`
  if (n1 >= 2 && n1 <= 4) return `${count} тренировки`
  return `${count} тренировок`
}

type SheetMode = 'closed' | 'menu' | 'confirm'

export function ActivityPage() {
  const navigate = useNavigate()
  const { user, apiOnline } = useApp()
  const [range, setRange] = useState<ActivityRange>(30)
  const [stats, setStats] = useState<ActivityStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState('')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [sheet, setSheet] = useState<SheetMode>('closed')

  const menuPanelRef = useRef<HTMLDivElement>(null)
  const confirmPanelRef = useRef<HTMLDivElement>(null)
  const confirmActionRef = useRef<HTMLButtonElement>(null)

  useSheetA11y(sheet === 'menu', () => setSheet('closed'), menuPanelRef)
  useSheetA11y(
    sheet === 'confirm',
    () => setSheet('closed'),
    confirmPanelRef,
    confirmActionRef,
  )

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

  const avgMinutes = useMemo(() => {
    if (!stats || stats.totalSessions <= 0) return 0
    return Math.round(stats.totalMinutes / stats.totalSessions)
  }, [stats])

  const showAvgLine = avgMinutes > 0 && avgMinutes < ceilingMinutes

  const selectedDay = useMemo(() => {
    if (!stats || !selectedDate) return null
    return stats.days.find((d) => d.date === selectedDate) || null
  }, [stats, selectedDate])

  const onReset = async () => {
    if (resetting || !apiOnline) return
    setResetting(true)
    setError('')
    try {
      await apiResetMyActivity()
      setSheet('closed')
      await load(range)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сбросить активность')
    } finally {
      setResetting(false)
    }
  }

  if (!user) return <Navigate to="/login" replace />

  const empty = Boolean(stats && stats.totalMinutes === 0 && stats.totalSessions === 0)
  const canReset = Boolean(stats && !empty && apiOnline)

  return (
    <main className="page activity-page">
      <div className="subpage-top">
        <button type="button" className="back-link" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} /> Назад
        </button>

        <header className="activity-head">
          <div className="activity-head-row">
            <h1 className="page-title">Активность</h1>
            {canReset ? (
              <button
                type="button"
                className="icon-btn activity-more-btn"
                aria-label="Ещё"
                aria-haspopup="dialog"
                aria-expanded={sheet !== 'closed'}
                onClick={() => setSheet('menu')}
                disabled={resetting}
              >
                <MoreHorizontal size={20} />
              </button>
            ) : null}
          </div>
          <p className="muted">Время в зале по отметкам</p>
        </header>
      </div>

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
          <section className="activity-summary" aria-label="Сводка">
            <span className="activity-summary-label">Всего за период</span>
            <strong className="activity-summary-total">{formatMinutes(stats.totalMinutes)}</strong>
            <p className="activity-summary-sessions muted">
              {stats.totalSessions > 0 ? sessionsLabel(stats.totalSessions) : 'Пока без тренировок'}
            </p>
          </section>

          {empty ? (
            <section className="surface activity-empty">
              <p className="empty-copy-title">Пока пусто</p>
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

                    {showAvgLine ? (
                      <div
                        className="activity-avg-line"
                        style={{ bottom: `${(avgMinutes / ceilingMinutes) * 100}%` }}
                        aria-hidden
                      >
                        <span className="activity-avg-label">ср. {formatMinutes(avgMinutes)}</span>
                      </div>
                    ) : null}

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
                  <div key={selectedDay.date} className="activity-day-detail" aria-live="polite">
                    <div className="activity-day-detail-copy">
                      <strong>{formatDayLabel(selectedDay.date)}</strong>
                      <span>
                        {selectedDay.minutes > 0
                          ? formatMinutes(selectedDay.minutes)
                          : 'В этот день отметок не было'}
                      </span>
                    </div>
                    {selectedDay.minutes > 0 && selectedDay.intervals?.length ? (
                      <div className="activity-day-detail-range">
                        {formatLocalTrainingWindow(selectedDay.intervals)}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>

              {stats.busiestDay || stats.quietestDay ? (
                <section className="activity-peaks" aria-label="Пики">
                  {stats.busiestDay ? (
                    <button
                      type="button"
                      className="activity-peak is-max"
                      onClick={() => setSelectedDate(stats.busiestDay!.date)}
                    >
                      <span className="activity-peak-label">Пик</span>
                      <strong>{formatMinutes(stats.busiestDay.minutes)}</strong>
                      <span className="dim">{formatDayLabel(stats.busiestDay.date, true)}</span>
                    </button>
                  ) : null}
                  {stats.busiestDay && stats.quietestDay ? (
                    <span className="activity-peak-divider" aria-hidden />
                  ) : null}
                  {stats.quietestDay ? (
                    <button
                      type="button"
                      className="activity-peak is-min"
                      onClick={() => setSelectedDate(stats.quietestDay!.date)}
                    >
                      <span className="activity-peak-label">Меньше</span>
                      <strong>{formatMinutes(stats.quietestDay.minutes)}</strong>
                      <span className="dim">{formatDayLabel(stats.quietestDay.date, true)}</span>
                    </button>
                  ) : null}
                </section>
              ) : null}
            </>
          )}
        </>
      ) : null}

      {sheet === 'menu' ? (
        <div className="activity-sheet" role="dialog" aria-modal="true" aria-label="Действия">
          <button
            type="button"
            className="activity-sheet-backdrop"
            aria-label="Закрыть"
            onClick={() => setSheet('closed')}
          />
          <div className="activity-sheet-panel" ref={menuPanelRef}>
            <div className="activity-sheet-grab" aria-hidden />
            <button
              type="button"
              className="activity-sheet-item is-danger"
              disabled={resetting}
              onClick={() => setSheet('confirm')}
            >
              <RotateCcw size={18} aria-hidden />
              Сбросить историю
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-block"
              onClick={() => setSheet('closed')}
            >
              Отмена
            </button>
          </div>
        </div>
      ) : null}

      {sheet === 'confirm' ? (
        <div
          className="activity-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="activity-reset-title"
        >
          <button
            type="button"
            className="activity-sheet-backdrop"
            aria-label="Закрыть"
            onClick={() => setSheet('closed')}
          />
          <div className="activity-sheet-panel" ref={confirmPanelRef}>
            <div className="activity-sheet-grab" aria-hidden />
            <h3 id="activity-reset-title">Сбросить историю?</h3>
            <p className="muted">График и история отметок очистятся.</p>
            <button
              type="button"
              ref={confirmActionRef}
              className="btn btn-danger btn-block"
              disabled={resetting || !apiOnline}
              onClick={() => void onReset()}
            >
              {resetting ? 'Сбрасываем…' : 'Сбросить'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-block"
              disabled={resetting}
              onClick={() => setSheet('closed')}
            >
              Отмена
            </button>
          </div>
        </div>
      ) : null}
    </main>
  )
}
