import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, ChevronDown } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { SectionTitle } from '../components/SectionTitle'
import { SOFT_LOADER_DELAY_MS, SoftLoader } from '../components/SoftLoader'
import { useApp } from '../context/useApp'
import {
  apiFetchWorkoutProgress,
  type WorkoutProgress,
  type WorkoutProgressRange,
} from '../lib/apiClient'
import { useSheetA11y } from '../lib/sheetA11y'
import { formatBodyDelta, formatDeltaLabel, formatKg } from '../lib/workouts'
import { goWorkoutsHub } from '../lib/workoutsNav'
import { WorkoutWeekRecap } from '../components/WorkoutWeekRecap'
import { WORKOUT_RECAP_ADMIN_ONLY } from '../lib/workoutRecap'
import './WorkoutsPage.css'
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

function formatCaptionDay(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
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
type ChartCoord = { x: number; y: number; i: number }

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function toward(
  from: { x: number; y: number },
  to: { x: number; y: number },
  distance: number,
) {
  const d = dist(from, to)
  if (d === 0) return { x: from.x, y: from.y }
  const t = Math.min(1, distance / d)
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
}

/**
 * Straight segments with a small inside fillet.
 * A spline overshoots and fakes extra kg; this only cuts the sharp corner.
 */
function linePath(coords: ChartCoord[]) {
  if (!coords.length) return ''
  if (coords.length === 1) return `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`
  const parts = [`M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`]
  if (coords.length === 2) {
    parts.push(`L ${coords[1].x.toFixed(1)} ${coords[1].y.toFixed(1)}`)
    return parts.join(' ')
  }
  for (let i = 1; i < coords.length - 1; i++) {
    const prev = coords[i - 1]
    const curr = coords[i]
    const next = coords[i + 1]
    const radius = Math.min(8, dist(prev, curr) * 0.2, dist(curr, next) * 0.2)
    if (radius < 1.6) {
      parts.push(`L ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`)
      continue
    }
    const start = toward(curr, prev, radius)
    const end = toward(curr, next, radius)
    parts.push(`L ${start.x.toFixed(1)} ${start.y.toFixed(1)}`)
    parts.push(`Q ${curr.x.toFixed(1)} ${curr.y.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`)
  }
  const last = coords[coords.length - 1]
  parts.push(`L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`)
  return parts.join(' ')
}

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
  const uid = useId().replace(/:/g, '')
  const fillId = `wp-fill-${uid}`
  const clipId = `wp-clip-${uid}`
  const values = points.map((p) => p.value)
  const minV = Math.min(...values)
  const maxV = Math.max(...values)
  const ticks = yTicks(minV, maxV)
  const yMin = ticks[ticks.length - 1]
  const yMax = ticks[0]
  const ySpan = Math.max(0.001, yMax - yMin)

  const w = 320
  const h = 200
  const padL = 44
  const padR = 10
  const padT = 14
  const padB = 28
  const plotW = w - padL - padR
  const plotH = h - padT - padB
  const plotBottom = padT + plotH

  const formatTick = (t: number) => (Number.isInteger(t) ? String(t) : t.toFixed(1))

  const coords = points.map((p, i) => {
    const x =
      points.length === 1 ? padL + plotW / 2 : padL + (i / (points.length - 1)) * plotW
    const y = padT + (1 - (p.value - yMin) / ySpan) * plotH
    return { x, y, i }
  })

  const line = linePath(coords)
  const area =
    coords.length > 1
      ? `${line} L ${coords[coords.length - 1].x.toFixed(1)} ${plotBottom} L ${coords[0].x.toFixed(1)} ${plotBottom} Z`
      : ''
  const selected = coords[selectedIndex] ?? coords[coords.length - 1]

  return (
    <div className="workout-line-chart">
      <svg viewBox={`0 0 ${w} ${h}`} className="workout-line-svg" role="img" aria-label={`График, ${unit}`}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="workout-line-fill-top" />
            <stop offset="100%" className="workout-line-fill-bottom" />
          </linearGradient>
          <clipPath id={clipId}>
            <rect x={padL} y={padT} width={plotW} height={plotH} />
          </clipPath>
        </defs>
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
        <g clipPath={`url(#${clipId})`}>
          {area ? <path d={area} fill={`url(#${fillId})`} className="workout-line-area" /> : null}
          <path d={line} className="workout-line-path" fill="none" />
        </g>
        {selected ? (
          <line
            x1={selected.x}
            x2={selected.x}
            y1={padT}
            y2={plotBottom}
            className="workout-line-cursor"
          />
        ) : null}
        {coords.map((c) => (
          <circle
            key={c.i}
            cx={c.x}
            cy={c.y}
            r={16}
            className="workout-line-hit"
            onClick={() => onSelect(c.i)}
          />
        ))}
        {selected ? (
          <g className="workout-line-focus" pointerEvents="none">
            <circle cx={selected.x} cy={selected.y} r={7} className="workout-line-halo" />
            <circle cx={selected.x} cy={selected.y} r={2.6} className="workout-line-dot is-selected" />
          </g>
        ) : null}
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
  const heroKg =
    selectedPoint != null
      ? formatKg(selectedPoint.value)
      : tab === 'body'
        ? formatKg(progress?.body.latestKg)
        : formatKg(progress?.strength.latestWeightKg)
  const periodDelta =
    tab === 'body'
      ? bodyDelta
        ? `${bodyDelta} за период`
        : progress && progress.body.points.length < 2
          ? 'Нужна ещё одна точка'
          : null
      : strengthDelta
        ? `${strengthDelta.text} за период`
        : progress && progress.strength.points.length < 2
          ? 'Нужна ещё одна тренировка'
          : null

  return (
    <main className="page workouts-page workouts-progress-page">
      <div className="subpage-top">
        <button type="button" className="back-link" onClick={() => goWorkoutsHub(navigate)}>
          <ArrowLeft size={18} /> Тренировки
        </button>

        <header className="page-header">
          <div className="page-header-text">
            <h1 className="page-title">Прогресс</h1>
          </div>
        </header>
      </div>

      <div className="workout-progress-toolbar">
        <div className="seg seg--fit workout-progress-mode" role="tablist" aria-label="Что смотреть">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'strength'}
            className={`seg-item${tab === 'strength' ? ' is-active' : ''}`}
            onClick={() => setTab('strength')}
          >
            Упражнения
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'body'}
            className={`seg-item${tab === 'body' ? ' is-active' : ''}`}
            onClick={() => {
              setPickerOpen(false)
              setTab('body')
            }}
          >
            Мой вес
          </button>
        </div>
        <div className="seg seg--fit workout-progress-period" role="tablist" aria-label="Период">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={range === r.id}
              className={`seg-item${range === r.id ? ' is-active' : ''}`}
              onClick={() => setRange(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="feedback-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="workout-progress-feed" aria-busy={loading}>
        {loading && !progress ? (
          <SoftLoader delayMs={SOFT_LOADER_DELAY_MS} label="Загружаем прогресс…" />
        ) : null}

        {tab === 'strength' && progress && progress.exercises.length > 0 ? (
          <button
            type="button"
            className="workout-progress-title-btn"
            aria-haspopup="dialog"
            aria-expanded={pickerOpen}
            aria-label={`Упражнение: ${exerciseValue || 'выбрать'}`}
            onClick={() => setPickerOpen(true)}
          >
            <span className="section-heading">{exerciseValue || 'Выбрать упражнение'}</span>
            <ChevronDown size={18} aria-hidden />
          </button>
        ) : null}

        {progress && !loading ? (
          activePoints.length === 0 ? (
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
            <>
              <section className="workout-progress-hero" aria-label="Значение">
                <strong className="workout-progress-hero-value">{heroKg || '—'}</strong>
                {periodDelta ? <p className="muted workout-progress-hero-delta">{periodDelta}</p> : null}
              </section>

              <section className="surface workout-progress-chart-block">
                <LineChart
                  points={activePoints}
                  unit="кг"
                  selectedIndex={selected}
                  onSelect={setSelected}
                />
                {selectedPoint ? (
                  <p className="workout-progress-caption muted">
                    {formatCaptionDay(selectedPoint.at)}
                    {selectedPoint.meta ? ` · ${selectedPoint.meta}` : ''}
                  </p>
                ) : null}
              </section>
            </>
          )
        ) : null}

        {!loading && (!WORKOUT_RECAP_ADMIN_ONLY || user.isAdmin) ? <WorkoutWeekRecap /> : null}
      </div>

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
            <SectionTitle as="h3" id="workout-ex-picker-title">
              Упражнение
            </SectionTitle>
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
                      <span className="workout-exercise-picker-name">{ex.name}</span>
                      <span className="workout-exercise-picker-meta">
                        <span>{ex.sessionCount}</span>
                        {active ? <Check size={16} strokeWidth={2.25} aria-hidden /> : null}
                      </span>
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

