import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, ClipboardList, MoreHorizontal, RotateCcw, Trash2, Users } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { SOFT_LOADER_DELAY_MS, SoftLoader } from '../components/SoftLoader'
import { SubpageHeader } from '../components/SubpageHeader'
import { useApp } from '../context/useApp'
import {
  apiDeleteMyActivityDay,
  apiFetchMyActivity,
  apiResetMyActivity,
  type ActivityRange,
  type ActivityStats,
} from '../lib/apiClient'
import { haptic } from '../lib/haptic'
import { useSheetA11y } from '../lib/sheetA11y'
import { PERIOD_TABS } from '../lib/periodRange'
import { trackApp } from '../lib/appTrack'
import { userFacingError } from '../lib/userError'
import './ActivityPage.css'
import './FeedbackPage.css'

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
  if (n > 10 && n < 20) return `${count} посещений`
  if (n1 === 1) return `${count} посещение`
  if (n1 >= 2 && n1 <= 4) return `${count} посещения`
  return `${count} посещений`
}

type SheetMode = 'closed' | 'menu' | 'confirm' | 'day'

const LONG_PRESS_MS = 480

export function ActivityPage() {
  const navigate = useNavigate()
  const { user, apiOnline, checkOut } = useApp()
  const [range, setRange] = useState<ActivityRange>(30)
  const [stats, setStats] = useState<ActivityStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState('')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [sheet, setSheet] = useState<SheetMode>('closed')

  const menuPanelRef = useRef<HTMLDivElement>(null)
  const confirmPanelRef = useRef<HTMLDivElement>(null)
  const confirmActionRef = useRef<HTMLButtonElement>(null)
  const dayPanelRef = useRef<HTMLDivElement>(null)
  const dayActionRef = useRef<HTMLButtonElement>(null)
  const loadGen = useRef(0)
  const longTimer = useRef<number | null>(null)
  const longFired = useRef(false)

  useSheetA11y(sheet === 'menu', () => setSheet('closed'), menuPanelRef)
  useSheetA11y(
    sheet === 'confirm',
    () => setSheet('closed'),
    confirmPanelRef,
    confirmActionRef,
  )
  useSheetA11y(sheet === 'day', () => setSheet('closed'), dayPanelRef, dayActionRef)

  const clearLongPress = () => {
    if (longTimer.current != null) {
      window.clearTimeout(longTimer.current)
      longTimer.current = null
    }
  }

  const load = useCallback(async (nextRange: ActivityRange) => {
    const gen = ++loadGen.current
    setLoading(true)
    setError('')
    try {
      const next = await apiFetchMyActivity(nextRange)
      if (gen !== loadGen.current) return
      setStats(next)
      setSelectedDate((prev) => {
        if (prev && next.days.some((d) => d.date === prev && d.minutes > 0)) return prev
        const lastActive = [...next.days].reverse().find((d) => d.minutes > 0)
        return lastActive?.date ?? null
      })
    } catch (err) {
      if (gen !== loadGen.current) return
      setError(userFacingError(err, 'Не удалось загрузить статистику'))
    } finally {
      if (gen === loadGen.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user || !apiOnline) {
      setLoading(false)
      return
    }
    void load(range)
  }, [user, apiOnline, range, load])

  useEffect(() => {
    trackApp('activity_opened')
  }, [])

  useEffect(() => () => clearLongPress(), [])

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
      setError(userFacingError(err, 'Не удалось сбросить активность'))
    } finally {
      setResetting(false)
    }
  }

  const askDeleteDay = (date: string) => {
    const day = stats?.days.find((d) => d.date === date)
    if (!day || day.minutes <= 0 || resetting || !apiOnline) return
    setSelectedDate(date)
    setSheet('day')
  }

  const startBarLongPress = (date: string, hasTime: boolean) => {
    clearLongPress()
    longFired.current = false
    if (!hasTime || resetting || !apiOnline) return
    longTimer.current = window.setTimeout(() => {
      longFired.current = true
      longTimer.current = null
      haptic('tap')
      askDeleteDay(date)
    }, LONG_PRESS_MS)
  }

  const onDeleteDay = async () => {
    if (resetting || !apiOnline || !selectedDate) return
    const date = selectedDate
    setResetting(true)
    setError('')
    try {
      const result = await apiDeleteMyActivityDay(date)
      setSheet('closed')
      if (result.clearedPresence && user?.isActive) {
        await Promise.resolve(checkOut()).catch(() => undefined)
      }
      await load(range)
    } catch (err) {
      setError(userFacingError(err, 'Не удалось удалить день'))
    } finally {
      setResetting(false)
    }
  }

  if (!user) return <Navigate to="/login" replace />

  const empty = Boolean(stats && stats.totalMinutes === 0 && stats.totalSessions === 0)
  const canReset = Boolean(stats && !empty && apiOnline)

  return (
    <main className="page activity-page">
      <SubpageHeader
        title="Активность"
        onBack={() => navigate('/app')}
        action={
          <button
            type="button"
            className={`icon-btn activity-more-btn ${canReset ? '' : 'is-reserved'}`.trim()}
            aria-label="Ещё"
            aria-haspopup="dialog"
            aria-expanded={sheet !== 'closed'}
            aria-hidden={!canReset}
            tabIndex={canReset ? 0 : -1}
            onClick={() => setSheet('menu')}
            disabled={resetting || !canReset}
          >
            <MoreHorizontal size={20} />
          </button>
        }
      />

      {!apiOnline ? (
        <p className="muted">Нужен онлайн, чтобы загрузить историю чекинов.</p>
      ) : null}

      <div className="seg seg--fill seg--dense" role="tablist" aria-label="Период">
        {PERIOD_TABS.map((r) => (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={range === r.id}
            className={`seg-item${range === r.id ? ' is-active' : ''}`}
            onClick={() => setRange(r.id)}
            disabled={resetting}
          >
            {r.label}
          </button>
        ))}
      </div>

      {error && !stats ? (
        <div className="empty-copy-actions">
          <div className="empty-copy" role="alert">
            <p className="empty-copy-title">Не удалось загрузить активность</p>
            <p className="empty-copy-lead">{error}</p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => void load(range)}
          >
            Повторить
          </button>
        </div>
      ) : error ? (
        <p className="feedback-error" role="alert">
          {error}
        </p>
      ) : null}

      <div
        className={`activity-feed ${loading && stats ? 'is-refreshing' : ''}`.trim()}
        aria-busy={loading}
      >
        {loading && !stats ? (
          <SoftLoader delayMs={SOFT_LOADER_DELAY_MS} label="Загружаем активность…" />
        ) : null}

        {stats ? (
        <>
          <section className="activity-summary" aria-label="Сводка">
            <span className="activity-summary-label">Всего за период</span>
            <strong className="activity-summary-total">{formatMinutes(stats.totalMinutes)}</strong>
            <p className="activity-summary-sessions">
              {stats.totalSessions > 0 ? sessionsLabel(stats.totalSessions) : 'Пока без посещений'}
            </p>
          </section>

          {empty ? (
            <section className="surface activity-empty">
              <p className="empty-copy-title">Пока пусто</p>
              <p className="muted empty-copy-lead">
                Отмечайся «Я в зале» — здесь появится график времени по дням.
              </p>
              <Link to="/app" className="btn btn-primary btn-block">
                К отметке в зале
              </Link>
              <Link to="/app/workouts" className="section-action">
                Дневник тренировок
              </Link>
            </section>
          ) : (
            <>
              <section className="activity-chart-block">
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
                            onPointerDown={() => startBarLongPress(day.date, day.minutes > 0)}
                            onPointerUp={clearLongPress}
                            onPointerCancel={clearLongPress}
                            onPointerLeave={clearLongPress}
                            onContextMenu={(e) => {
                              e.preventDefault()
                              askDeleteDay(day.date)
                            }}
                            onClick={() => {
                              if (longFired.current) {
                                longFired.current = false
                                return
                              }
                              setSelectedDate(day.date)
                            }}
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

                <div className="activity-day-detail" aria-live="polite">
                  {selectedDay ? (
                    <>
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
                      {selectedDay.minutes > 0 ? (
                        <Link to="/app/workouts/new" className="activity-day-workout-link">
                          Записать тренировку за этот день
                        </Link>
                      ) : null}
                    </>
                  ) : null}
                </div>
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

              <nav className="entry-tools entry-tools--2" aria-label="Дальше из активности">
                <Link to="/app/workouts" className="entry-link">
                  <ClipboardList size={18} aria-hidden />
                  <span>Тренировки</span>
                  <ChevronRight size={16} aria-hidden />
                </Link>
                <Link to="/app" className="entry-link">
                  <Users size={18} aria-hidden />
                  <span>Люди в зале</span>
                  <ChevronRight size={16} aria-hidden />
                </Link>
              </nav>
            </>
          )}
        </>
        ) : null}
      </div>

      {sheet === 'menu' ? (
        <div className="app-sheet" role="dialog" aria-modal="true" aria-label="Действия">
          <button
            type="button"
            className="app-sheet-backdrop"
            aria-label="Закрыть"
            onClick={() => setSheet('closed')}
          />
          <div className="app-sheet-panel" ref={menuPanelRef}>
            <div className="app-sheet-grab" aria-hidden />
            {selectedDay && selectedDay.minutes > 0 ? (
              <button
                type="button"
                className="sheet-action is-danger"
                disabled={resetting || !apiOnline}
                onClick={() => setSheet('day')}
              >
                <Trash2 size={18} aria-hidden />
                Удалить {formatDayLabel(selectedDay.date, true)}
              </button>
            ) : null}
            <button
              type="button"
              className="sheet-action is-danger"
              disabled={resetting}
              onClick={() => setSheet('confirm')}
            >
              <RotateCcw size={18} aria-hidden />
              Сбросить историю
            </button>
            <button type="button" className="sheet-action" onClick={() => setSheet('closed')}>
              Отмена
            </button>
          </div>
        </div>
      ) : null}

      {sheet === 'confirm' ? (
        <div
          className="app-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="activity-reset-title"
        >
          <button
            type="button"
            className="app-sheet-backdrop"
            aria-label="Закрыть"
            onClick={() => setSheet('closed')}
          />
          <div className="app-sheet-panel" ref={confirmPanelRef}>
            <div className="app-sheet-grab" aria-hidden />
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
              className="sheet-action"
              disabled={resetting}
              onClick={() => setSheet('closed')}
            >
              Отмена
            </button>
          </div>
        </div>
      ) : null}

      {sheet === 'day' && selectedDay && selectedDay.minutes > 0 ? (
        <div
          className="app-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="activity-day-title"
        >
          <button
            type="button"
            className="app-sheet-backdrop"
            aria-label="Закрыть"
            onClick={() => setSheet('closed')}
          />
          <div className="app-sheet-panel" ref={dayPanelRef}>
            <div className="app-sheet-grab" aria-hidden />
            <h3 id="activity-day-title">Убрать этот день?</h3>
            <p className="muted">
              {formatDayLabel(selectedDay.date)} · {formatMinutes(selectedDay.minutes)}. Отметки за
              этот день пропадут из графика. Если среди них открытый «Я в зале» — статус тоже
              снимется.
            </p>
            <button
              type="button"
              ref={dayActionRef}
              className="btn btn-danger btn-block"
              disabled={resetting || !apiOnline}
              onClick={() => void onDeleteDay()}
            >
              {resetting ? 'Удаляем…' : 'Удалить день'}
            </button>
            <button
              type="button"
              className="sheet-action"
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
