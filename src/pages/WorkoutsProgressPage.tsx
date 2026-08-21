import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useApp } from '../context/useApp'
import {
  apiFetchWorkoutProgress,
  type WorkoutProgress,
  type WorkoutProgressRange,
} from '../lib/apiClient'
import { useSheetA11y } from '../lib/sheetA11y'
import { formatBodyDelta, formatDeltaLabel, formatKg } from '../lib/workouts'
import { WorkoutWeekRecap } from '../components/WorkoutWeekRecap'
import { WORKOUT_RECAP_ADMIN_ONLY } from '../lib/workoutRecap'
import './WorkoutsPage.css'
import './ActivityPage.css'
import './FeedbackPage.css'

const RANGES: { id: WorkoutProgressRange; label: string }[] = [
  { id: 7, label: '7д' },
  { id: 30, label: '30д' },
  { id: 90, label: '90д' },
]

type Tab = 'body' | 'strength'

function formatAxisDay(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function formatPointDay(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function yTicks(min: number, max: number) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0]
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.05)
    return [roundNice(max + pad), roundNice(min - pad)]
  }
  const span = max - min
  const step = niceStep(span / 3)
  const bottom = Math.floor(min / step) * step
  const top = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = top; v >= bottom - step / 1000; v -= step) {
    ticks.push(roundNice(v))
  }
  return ticks.length ? ticks : [max, min]
}

function niceStep(raw: number) {
  if (raw <= 0) return 1
  const pow = 10 ** Math.floor(Math.log10(raw))
  const n = raw / pow
  if (n <= 1) return pow
  if (n <= 2) return 2 * pow
  if (n <= 5) return 5 * pow
  return 10 * pow
}

function roundNice(n: number) {
  return Math.round(n * 100) / 100
}

type ChartPoint = { at: string; value: number; meta?: string }

function LineChart({
  points,
  unit,
  selectedIndex,
  onSelect,
}: {
  points: ChartPoint[]
  unit: string
  selectedIndex: number
  onSelect: (index: number) => void
}) {
  const values = points.map((p) => p.value)
  const minV = Math.min(...values)
  const maxV = Math.max(...values)
  const ticks = yTicks(minV, maxV)
  const yMin = ticks[ticks.length - 1]
  const yMax = ticks[0]
  const ySpan = Math.max(0.001, yMax - yMin)

  const w = 320
  const h = 200
  /** Room for Y numbers — keep plot clear of labels */
  const padL = 44
  const padR = 10
  const padT = 14
  /** Room for X dates under the plot */
  const padB = 28
  const plotW = w - padL - padR
  const plotH = h - padT - padB

  const formatTick = (t: number) => (Number.isInteger(t) ? String(t) : t.toFixed(1))

  const coords = points.map((p, i) => {
    const x =
      points.length === 1 ? padL + plotW / 2 : padL + (i / (points.length - 1)) * plotW
    const y = padT + (1 - (p.value - yMin) / ySpan) * plotH
    return { x, y, p, i }
  })

  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')

  return (
    <div className="workout-line-chart">
      <p className="dim workout-line-unit" aria-hidden>
        {unit}
      </p>
      <svg viewBox={`0 0 ${w} ${h}`} className="workout-line-svg" role="img" aria-label={`График, ${unit}`}>
        {ticks.map((t) => {
          const y = padT + (1 - (t - yMin) / ySpan) * plotH
          return (
            <g key={t}>
              <line x1={padL} x2={w - padR} y1={y} y2={y} className="workout-line-grid" />
              <text x={padL - 8} y={y} className="workout-line-y-label" dominantBaseline="middle">
                {formatTick(t)}
              </text>
            </g>
          )
        })}
        <path d={path} className="workout-line-path" fill="none" />
        {coords.map((c) => (
          <g key={c.i}>
            <circle
              cx={c.x}
              cy={c.y}
              r={14}
              className="workout-line-hit"
              onClick={() => onSelect(c.i)}
            />
            <circle
              cx={c.x}
              cy={c.y}
              r={selectedIndex === c.i ? 5.5 : 4}
              className={`workout-line-dot ${selectedIndex === c.i ? 'is-selected' : ''}`}
              onClick={() => onSelect(c.i)}
            />
          </g>
        ))}
        <text x={padL} y={h - 6} className="workout-line-x-label" textAnchor="start">
          {formatAxisDay(points[0].at)}
        </text>
        {points.length > 1 ? (
          <text x={w - padR} y={h - 6} className="workout-line-x-label" textAnchor="end">
            {formatAxisDay(points[points.length - 1].at)}
          </text>
        ) : null}
      </svg>
    </div>
  )
}

export function WorkoutsProgressPage() {
  const navigate = useNavigate()
  const { user, apiOnline } = useApp()
  const [tab, setTab] = useState<Tab>('strength')
  const [range, setRange] = useState<WorkoutProgressRange>(30)
  const [pickedExercise, setPickedExercise] = useState<string | undefined>()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [progress, setProgress] = useState<WorkoutProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(0)
  const pickerRef = useRef<HTMLDivElement>(null)

  useSheetA11y(pickerOpen, () => setPickerOpen(false), pickerRef)

  const load = useCallback(async () => {
    if (!apiOnline) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const next = await apiFetchWorkoutProgress(range, pickedExercise)
      setProgress(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить прогресс')
      setProgress(null)
    } finally {
      setLoading(false)
    }
  }, [apiOnline, range, pickedExercise])

  useEffect(() => {
    void load()
  }, [load])

  const bodyPoints: ChartPoint[] = useMemo(
    () => (progress?.body.points || []).map((p) => ({ at: p.at, value: p.kg })),
    [progress],
  )

  const strengthPoints: ChartPoint[] = useMemo(
    () =>
      (progress?.strength.points || []).map((p) => ({
        at: p.at,
        value: p.weightKg,
        meta: `${p.reps} повт.`,
      })),
    [progress],
  )

  const activePoints = tab === 'body' ? bodyPoints : strengthPoints

  useEffect(() => {
    setSelected(activePoints.length ? activePoints.length - 1 : 0)
  }, [activePoints, tab, range, pickedExercise])

  useEffect(() => {
    if (loading) return
    if (window.location.hash !== '#week-recap') return
    document.getElementById('week-recap')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [loading])

  if (!user) return <Navigate to="/login" replace />

  const selectedPoint = activePoints[selected] || null
  const bodyDelta = formatBodyDelta(progress?.body.deltaKg)
  const strengthDelta = formatDeltaLabel(
    progress?.strength.deltaWeightKg,
    progress?.strength.deltaReps,
  )
  const exerciseValue = pickedExercise || progress?.strength.exercise || ''

  return (
    <main className="page workouts-page workouts-progress-page">
      <div className="subpage-top">
        <button type="button" className="back-link" onClick={() => navigate('/app/workouts')}>
          <ArrowLeft size={18} /> Тренировки
        </button>

        <header className="page-header">
          <div className="page-header-text">
            <h1 className="page-title">Прогресс</h1>
          </div>
        </header>
      </div>

      <div className="workout-progress-toolbar">
        <div className="workout-progress-mode" role="tablist" aria-label="Что смотреть">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'strength'}
            className={tab === 'strength' ? 'is-active' : ''}
            onClick={() => setTab('strength')}
          >
            Упражнения
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'body'}
            className={tab === 'body' ? 'is-active' : ''}
            onClick={() => {
              setPickerOpen(false)
              setTab('body')
            }}
          >
            Мой вес
          </button>
        </div>
        <div className="workout-progress-period" role="tablist" aria-label="Период">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={range === r.id}
              className={range === r.id ? 'is-active' : ''}
              onClick={() => setRange(r.id)}
              disabled={loading}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'strength' && progress && progress.exercises.length > 0 ? (
        <div className="field workout-exercise-picker">
          <span>Упражнение</span>
          <button
            type="button"
            className="workout-exercise-picker-trigger"
            aria-haspopup="dialog"
            aria-expanded={pickerOpen}
            onClick={() => setPickerOpen(true)}
          >
            <span>{exerciseValue || 'Выбрать'}</span>
            <ChevronDown size={18} aria-hidden />
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="feedback-error" role="alert">
          {error}
        </p>
      ) : null}

      {progress && !loading ? (
        <>
          <section className="activity-summary" aria-label="Сводка">
            <span className="activity-summary-label">
              {tab === 'body' ? 'Твой вес' : progress.strength.exercise || 'Упражнение'}
            </span>
            <strong className="activity-summary-total">
              {tab === 'body'
                ? formatKg(progress.body.latestKg) || '—'
                : progress.strength.latestWeightKg != null
                  ? `${formatKg(progress.strength.latestWeightKg)}`
                  : '—'}
            </strong>
            <p className="activity-summary-sessions muted">
              {tab === 'body'
                ? bodyDelta
                  ? `${bodyDelta} за период`
                  : progress.body.points.length < 2
                    ? 'Нужно ещё одно взвешивание'
                    : 'Без изменений за период'
                : strengthDelta
                  ? `${strengthDelta.tone === 'up' ? '↑ ' : strengthDelta.tone === 'down' ? '↓ ' : ''}${strengthDelta.text} за период`
                  : progress.strength.points.length < 2
                    ? 'Нужна ещё одна такая тренировка'
                    : 'Без изменений за период'}
            </p>
          </section>

          {activePoints.length === 0 ? (
            <section className="surface workouts-empty">
              <p className="empty-copy-title">Пока пусто</p>
              <p className="muted">
                {tab === 'body'
                  ? 'Укажи свой вес в тренировке — здесь появится график.'
                  : 'Запиши подходы — здесь будет динамика по упражнению.'}
              </p>
              <Link to="/app/workouts/new" className="btn btn-primary btn-block">
                Записать тренировку
              </Link>
            </section>
          ) : (
            <section className="surface workout-progress-chart-block">
              <LineChart
                points={activePoints}
                unit={tab === 'body' ? 'кг' : 'кг'}
                selectedIndex={selected}
                onSelect={setSelected}
              />
              {selectedPoint ? (
                <div className="workout-progress-point">
                  <strong>
                    {Number.isInteger(selectedPoint.value)
                      ? selectedPoint.value
                      : selectedPoint.value.toFixed(1)}{' '}
                    кг
                    {selectedPoint.meta ? (
                      <span className="muted"> · {selectedPoint.meta}</span>
                    ) : null}
                  </strong>
                  <span className="muted">{formatPointDay(selectedPoint.at)}</span>
                </div>
              ) : null}
            </section>
          )}
        </>
      ) : null}

      {!loading && (!WORKOUT_RECAP_ADMIN_ONLY || user.isAdmin) ? <WorkoutWeekRecap /> : null}

      {pickerOpen && progress ? (
        <div className="app-sheet" role="dialog" aria-modal="true" aria-labelledby="workout-ex-picker-title">
          <button
            type="button"
            className="app-sheet-backdrop"
            aria-label="Закрыть"
            onClick={() => setPickerOpen(false)}
          />
          <div className="app-sheet-panel workout-exercise-picker-sheet" ref={pickerRef}>
            <div className="app-sheet-grab" aria-hidden />
            <h3 id="workout-ex-picker-title">Упражнение</h3>
            <ul className="workout-exercise-picker-list">
              {progress.exercises.map((ex) => {
                const active = ex.name === exerciseValue
                return (
                  <li key={ex.name}>
                    <button
                      type="button"
                      className={`workout-exercise-picker-item${active ? ' is-active' : ''}`}
                      aria-current={active ? 'true' : undefined}
                      onClick={() => {
                        setPickedExercise(ex.name)
                        setPickerOpen(false)
                      }}
                    >
                      {ex.name}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </main>
  )
}

