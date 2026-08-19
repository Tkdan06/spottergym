import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useApp } from '../context/useApp'
import {
  apiFetchWorkoutProgress,
  type WorkoutProgress,
  type WorkoutProgressRange,
} from '../lib/apiClient'
import { formatBodyDelta, formatDeltaLabel, formatKg } from '../lib/workouts'
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
  const h = 160
  const padL = 8
  const padR = 8
  const padT = 12
  const padB = 12
  const plotW = w - padL - padR
  const plotH = h - padT - padB

  const coords = points.map((p, i) => {
    const x =
      points.length === 1
        ? padL + plotW / 2
        : padL + (i / (points.length - 1)) * plotW
    const y = padT + (1 - (p.value - yMin) / ySpan) * plotH
    return { x, y, p, i }
  })

  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')

  return (
    <div className="workout-line-chart">
      <div className="workout-line-y" aria-hidden>
        {ticks.map((t) => (
          <span key={t}>{Number.isInteger(t) ? t : t.toFixed(1)}</span>
        ))}
      </div>
      <div className="workout-line-plot">
        <svg viewBox={`0 0 ${w} ${h}`} className="workout-line-svg" role="img" aria-label="График">
          {ticks.map((t) => {
            const y = padT + (1 - (t - yMin) / ySpan) * plotH
            return (
              <line
                key={t}
                x1={padL}
                x2={w - padR}
                y1={y}
                y2={y}
                className="workout-line-grid"
              />
            )
          })}
          <path d={path} className="workout-line-path" fill="none" />
          {coords.map((c) => (
            <circle
              key={c.i}
              cx={c.x}
              cy={c.y}
              r={selectedIndex === c.i ? 5.5 : 4}
              className={`workout-line-dot ${selectedIndex === c.i ? 'is-selected' : ''}`}
              onClick={() => onSelect(c.i)}
            />
          ))}
        </svg>
        <div className="workout-line-axis">
          <span>{formatAxisDay(points[0].at)}</span>
          {points.length > 1 ? <span>{formatAxisDay(points[points.length - 1].at)}</span> : null}
        </div>
        <p className="dim workout-line-unit">{unit}</p>
      </div>
    </div>
  )
}

export function WorkoutsProgressPage() {
  const navigate = useNavigate()
  const { user, apiOnline } = useApp()
  const [tab, setTab] = useState<Tab>('body')
  const [range, setRange] = useState<WorkoutProgressRange>(30)
  const [pickedExercise, setPickedExercise] = useState<string | undefined>()
  const [progress, setProgress] = useState<WorkoutProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(0)

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
      <button type="button" className="back-link" onClick={() => navigate('/app/workouts')}>
        <ArrowLeft size={18} /> Тренировки
      </button>

      <header className="workouts-head">
        <h1 className="page-title">Прогресс</h1>
        <p className="muted">Изменения веса тела и лучших подходов</p>
      </header>

      <div className="activity-range workouts-progress-tabs" role="tablist" aria-label="Тип прогресса">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'body'}
          className={`activity-range-btn ${tab === 'body' ? 'is-active' : ''}`}
          onClick={() => setTab('body')}
        >
          Тело
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'strength'}
          className={`activity-range-btn ${tab === 'strength' ? 'is-active' : ''}`}
          onClick={() => setTab('strength')}
        >
          Сила
        </button>
      </div>

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

      {tab === 'strength' && progress && progress.exercises.length > 0 ? (
        <label className="field workout-exercise-picker">
          <span>Упражнение</span>
          <select
            value={exerciseValue}
            onChange={(e) => setPickedExercise(e.target.value || undefined)}
          >
            {progress.exercises.map((ex) => (
              <option key={ex.name} value={ex.name}>
                {ex.name}
              </option>
            ))}
          </select>
        </label>
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
              {tab === 'body' ? 'Твой вес' : progress.strength.exercise || 'Сила'}
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
                    ? 'Нужно ещё одно повторение упражнения'
                    : 'Без изменений за период'}
            </p>
          </section>

          {activePoints.length === 0 ? (
            <section className="surface workouts-empty">
              <p className="empty-copy-title">Пока пусто</p>
              <p className="muted">
                {tab === 'body'
                  ? 'Укажи свой вес в тренировке — здесь появится график.'
                  : 'Запиши подходы в упражнениях — здесь будет динамика лучших весов.'}
              </p>
              <Link to="/app/workouts/new" className="btn btn-primary btn-block">
                Записать тренировку
              </Link>
            </section>
          ) : (
            <section className="surface workout-progress-chart-block">
              <LineChart
                points={activePoints}
                unit={tab === 'body' ? 'кг' : 'кг на штанге'}
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
    </main>
  )
}

