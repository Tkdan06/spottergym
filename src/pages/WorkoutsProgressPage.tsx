import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Info } from 'lucide-react'
import { Navigate, Link, useNavigate } from 'react-router-dom'
import { SectionTitle } from '../components/SectionTitle'
import { SOFT_LOADER_DELAY_MS, SoftLoader } from '../components/SoftLoader'
import { SubpageHeader } from '../components/SubpageHeader'
import { useApp } from '../context/useApp'
import {
  apiFetchWorkoutProgress,
  type WorkoutExerciseInsight,
  type WorkoutInsights,
  type WorkoutPrItem,
  type WorkoutProgress,
  type WorkoutProgressRange,
} from '../lib/apiClient'
import { PERIOD_TABS } from '../lib/periodRange'
import { useSheetA11y } from '../lib/sheetA11y'
import {
  deriveProgressInsight,
  liftProgressLabel,
  plateauDaysLabel,
  visibleDeclining,
} from '../lib/progressInsight'
import {
  formatBarWeightValue,
  formatBodyDelta,
  formatCompactDelta,
  formatDeltaLabel,
  formatKg,
  formatSetPair,
  formatSignedPercent,
  formatVolume,
  ruPlural,
  type DeltaTone,
} from '../lib/workouts'
import { goWorkoutsHub } from '../lib/workoutsNav'
import { WorkoutWeekRecap } from '../components/WorkoutWeekRecap'
import { WorkoutMonthRecap } from '../components/WorkoutMonthRecap'
import { WORKOUT_RECAP_ADMIN_ONLY } from '../lib/workoutRecap'
import { trackApp } from '../lib/appTrack'
import { userFacingError } from '../lib/userError'
import './WorkoutsPage.css'
import './FeedbackPage.css'

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

function deltaToneFromKg(deltaKg: number | null | undefined): DeltaTone | null {
  if (deltaKg == null) return null
  if (deltaKg > 0) return 'up'
  if (deltaKg < 0) return 'down'
  return 'flat'
}

function HeroDelta({
  text,
  tone,
  className = '',
}: {
  text: string | null
  tone?: DeltaTone | null
  className?: string
}) {
  if (!text) return null
  const toneClass = tone === 'up' ? 'is-up' : tone === 'down' ? 'is-down' : 'is-flat'
  return (
    <p className={`workout-progress-hero-delta ${toneClass} ${className}`.trim()}>{text}</p>
  )
}

function toneFromDelta(n: number | null | undefined): DeltaTone | null {
  if (n == null) return null
  if (n > 0) return 'up'
  if (n < 0) return 'down'
  return 'flat'
}

function HintTip({
  label,
  children,
  popAlign = 'end',
}: {
  label: string
  children: string
  popAlign?: 'start' | 'end'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={`ui-hint${popAlign === 'start' ? ' ui-hint--start' : ''}`} ref={ref}>
      <button
        type="button"
        className="ui-hint-trigger"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Info size={14} strokeWidth={2.25} />
      </button>
      {open ? (
        <div className="ui-hint-pop" role="tooltip">
          {children}
        </div>
      ) : null}
    </div>
  )
}

function prGainLabel(pr: WorkoutPrItem) {
  if (pr.prevWeightKg == null && pr.prevReps == null) return 'впервые'
  if (pr.kind === 'weight') {
    const d = Math.round((pr.weightKg - (pr.prevWeightKg ?? 0)) * 10) / 10
    if (d <= 0) return 'вес'
    return `+${formatBarWeightValue(d)} кг`
  }
  const d = pr.reps - (pr.prevReps ?? 0)
  if (d <= 0) return 'повторы'
  return `+${d} ${ruPlural(d, 'повтор', 'повтора', 'повторов')}`
}

const PR_PREVIEW = 5

function LiftRow({
  lift,
  percent,
  note,
}: {
  lift: WorkoutExerciseInsight
  percent: string | null
  note?: string | null
}) {
  const first = lift.firstBest
  const last = lift.lastBest
  const firstPair = first ? formatSetPair(first.weightKg, first.reps) : null
  const lastPair = last ? formatSetPair(last.weightKg, last.reps) : null
  const path =
    firstPair && lastPair && firstPair !== lastPair ? `${firstPair} → ${lastPair}` : lastPair
  const tone = formatSignedPercent(lift.weightDeltaPercent)
    ? toneFromDelta(lift.weightDeltaPercent)
    : toneFromDelta(lift.repsDelta ?? lift.weightDeltaKg)
  const right = percent || note || null
  const rightTone = percent ? tone : 'flat'
  return (
    <li className="workout-insights-lift">
      <strong>{lift.name}</strong>
      <div className="workout-insights-lift-meta">
        {path ? <span className="muted">{path}</span> : null}
        {right ? (
          <span
            className={`workout-insights-lift-delta${
              rightTone === 'up' ? ' is-up' : rightTone === 'down' ? ' is-down' : ' is-flat'
            }`}
          >
            {right}
          </span>
        ) : null}
      </div>
    </li>
  )
}

function RecordsBlock({ insights }: { insights: WorkoutInsights }) {
  const [prsOpen, setPrsOpen] = useState(false)
  const [prsAll, setPrsAll] = useState(false)
  const prs = insights.prs.items
  const prsVisible = prsAll ? prs : prs.slice(0, PR_PREVIEW)
  const prsHidden = Math.max(0, prs.length - PR_PREVIEW)

  return (
    <section className="surface workout-progress-metric" aria-label="Рекорды">
      <SectionTitle
        action={
          insights.prs.count > 0 ? (
            <button
              type="button"
              className="section-action workout-insights-more"
              aria-expanded={prsOpen}
              onClick={() => {
                setPrsOpen((v) => {
                  if (v) setPrsAll(false)
                  return !v
                })
              }}
            >
              {`${insights.prs.count} ${ruPlural(
                insights.prs.count,
                'новый рекорд',
                'новых рекорда',
                'новых рекордов',
              )}`}
              <ChevronDown size={16} aria-hidden className={prsOpen ? 'is-open' : undefined} />
            </button>
          ) : (
            <span className="muted">Нет новых рекордов</span>
          )
        }
      >
        Рекорды
      </SectionTitle>
      {prsOpen && insights.prs.count > 0 ? (
        <>
          <ul className="workout-insights-list">
            {prsVisible.map((pr) => (
              <li key={`${pr.name}-${pr.at}-${pr.kind}`} className="workout-insights-lift">
                <strong>{pr.name}</strong>
                <div className="workout-insights-lift-meta">
                  <span className="muted">{formatSetPair(pr.weightKg, pr.reps)}</span>
                  <span className="workout-insights-lift-delta is-up">{prGainLabel(pr)}</span>
                </div>
              </li>
            ))}
          </ul>
          {prsHidden > 0 && !prsAll ? (
            <button
              type="button"
              className="section-action workout-insights-more"
              onClick={() => setPrsAll(true)}
            >
              Ещё {prsHidden}
              <ChevronDown size={16} aria-hidden />
            </button>
          ) : null}
        </>
      ) : null}
    </section>
  )
}

function InsightsBlocks({ insights }: { insights: WorkoutInsights }) {
  const insight = deriveProgressInsight(insights)
  const countDelta = formatCompactDelta(
    insights.workoutCount.delta,
    insights.workoutCount.previous,
  )
  const countTone = toneFromDelta(insights.workoutCount.delta)
  const volumePercent = formatSignedPercent(insights.volume.deltaPercent)
  const volumeDelta = formatCompactDelta(insights.volume.delta, insights.volume.previous)
  const volumeHeroDelta = volumePercent || volumeDelta
  const volumeTone = toneFromDelta(insights.volume.deltaPercent ?? insights.volume.delta)
  const improvingRows = insights.improving
    .map((lift) => ({ lift, percent: liftProgressLabel(lift) }))
    .filter((row): row is { lift: WorkoutExerciseInsight; percent: string } => Boolean(row.percent))
  const decliningRows = visibleDeclining(insights)
    .map((lift) => ({ lift, percent: liftProgressLabel(lift) }))
    .filter((row): row is { lift: WorkoutExerciseInsight; percent: string } => Boolean(row.percent))
  const listedRows = improvingRows.length ? improvingRows : decliningRows

  return (
    <div className="workout-progress-cluster">
      <section className="surface workout-progress-metric" aria-label="Прогресс по упражнениям">
        <SectionTitle>Прогресс</SectionTitle>
        <p className="workout-progress-plaque-lead">{insight.headline}</p>
        {listedRows.length ? (
          <ul className="workout-insights-list">
            {listedRows.map(({ lift, percent }) => (
              <LiftRow key={lift.identity} lift={lift} percent={percent} />
            ))}
          </ul>
        ) : null}
        {insights.plateauCandidates.length ? (
          <>
            <p className="workout-insights-kicker muted">Требует внимания</p>
            <ul className="workout-insights-list">
              {insights.plateauCandidates.map((lift) => (
                <LiftRow
                  key={lift.identity}
                  lift={lift}
                  percent={null}
                  note={plateauDaysLabel(lift)}
                />
              ))}
            </ul>
          </>
        ) : null}
      </section>

      <div className="workout-progress-pair">
        <section className="surface workout-progress-metric workout-progress-tile" aria-label="Тренировки">
          <SectionTitle>Тренировки</SectionTitle>
          <div className="workout-progress-hero">
            <strong className="workout-progress-hero-value">{insights.workoutCount.current}</strong>
            <HeroDelta text={countDelta} tone={countTone} />
          </div>
          <p className="workout-progress-caption muted">
            {insights.frequency.currentPerWeek > 0
              ? `${insights.frequency.currentPerWeek} в неделю`
              : '\u00a0'}
          </p>
        </section>

        <section className="surface workout-progress-metric workout-progress-tile" aria-label="Объём">
          <SectionTitle>
            <span className="workout-metric-heading">
              Объём
              <HintTip label="Что считается объёмом">
                Сколько килограммов ты поднял за выбранный период. Вес каждого рабочего подхода умножаем на повторы и складываем.
              </HintTip>
            </span>
          </SectionTitle>
          <div className="workout-progress-hero">
            <strong className="workout-progress-hero-value">
              {insights.volume.current > 0 ? `${formatVolume(insights.volume.current)} кг` : '—'}
            </strong>
          </div>
          <p
            className={`workout-progress-caption${
              volumeHeroDelta
                ? volumeTone === 'up'
                  ? ' is-up'
                  : volumeTone === 'down'
                    ? ' is-down'
                    : ' is-flat'
                : ' muted'
            }`}
          >
            {volumeHeroDelta || '\u00a0'}
          </p>
        </section>
      </div>
    </div>
  )
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
  const [range, setRange] = useState<WorkoutProgressRange>(() =>
    window.location.hash === '#month-recap' ? 30 : 7,
  )
  const [pickedExercise, setPickedExercise] = useState<string | undefined>()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [progress, setProgress] = useState<WorkoutProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedStrength, setSelectedStrength] = useState(0)
  const [selectedBody, setSelectedBody] = useState(0)
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
      setError(userFacingError(err, 'Не удалось загрузить прогресс'))
      setProgress(null)
    } finally {
      setLoading(false)
    }
  }, [apiOnline, range, pickedExercise])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    trackApp('progress_opened')
  }, [])

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

  useEffect(() => {
    setSelectedStrength(strengthPoints.length ? strengthPoints.length - 1 : 0)
  }, [strengthPoints, range, pickedExercise])

  useEffect(() => {
    setSelectedBody(bodyPoints.length ? bodyPoints.length - 1 : 0)
  }, [bodyPoints, range])

  useEffect(() => {
    if (loading) return
    if (window.location.hash !== '#week-recap') return
    if (range !== 7) return
    document.getElementById('week-recap')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [loading, range])

  if (!user) return <Navigate to="/login" replace />

  const strengthPoint = strengthPoints[selectedStrength] || null
  const bodyPoint = bodyPoints[selectedBody] || null
  const bodyDelta = formatBodyDelta(progress?.body.deltaKg)
  const strengthDelta = formatDeltaLabel(
    progress?.strength.deltaWeightKg,
    progress?.strength.deltaReps,
  )
  const exerciseValue = pickedExercise || progress?.strength.exercise || ''
  const strengthHero =
    strengthPoint != null
      ? formatKg(strengthPoint.value)
      : formatKg(progress?.strength.latestWeightKg)
  const bodyHero =
    bodyPoint != null ? formatKg(bodyPoint.value) : formatKg(progress?.body.latestKg)
  const strengthPeriodDelta = strengthDelta
    ? `${strengthDelta.text} за период`
    : progress && progress.strength.points.length < 2
      ? 'Нужна ещё одна тренировка'
      : null
  const bodyPeriodDelta = bodyDelta
    ? `${bodyDelta} за период`
    : progress && progress.body.points.length < 2
      ? 'Нужна ещё одна точка'
      : null
  const bothEmpty =
    Boolean(progress) && strengthPoints.length === 0 && bodyPoints.length === 0
  const noWorkouts = Boolean(progress && progress.insights.workoutCount.current === 0)
  const showInsights = Boolean(progress && progress.insights.workoutCount.current > 0)

  return (
    <main className="page workouts-page workouts-progress-page">
      <SubpageHeader title="Мой прогресс" onBack={() => goWorkoutsHub(navigate)} />

      <div className="seg seg--fill seg--dense" role="tablist" aria-label="Период">
        {PERIOD_TABS.map((r) => (
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

      {error && !progress ? (
        <div className="empty-copy-actions">
          <div className="empty-copy" role="alert">
            <p className="empty-copy-title">Не удалось загрузить прогресс</p>
            <p className="empty-copy-lead">{error}</p>
          </div>
          <button type="button" className="btn btn-primary btn-block" onClick={() => void load()}>
            Повторить
          </button>
        </div>
      ) : error ? (
        <p className="feedback-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="workout-progress-feed" aria-busy={loading}>
        {loading && !progress ? (
          <SoftLoader delayMs={SOFT_LOADER_DELAY_MS} label="Загружаем прогресс…" />
        ) : null}

        {progress &&
        !noWorkouts &&
        (!WORKOUT_RECAP_ADMIN_ONLY || user.isAdmin) &&
        (range === 7 || range === 30) ? (
          <div className="workout-progress-cluster">
            {range === 7 ? <WorkoutWeekRecap /> : null}
            {range === 30 ? <WorkoutMonthRecap /> : null}
          </div>
        ) : null}

        {!loading && (!progress || noWorkouts) && !error ? (
          <div className="empty-copy-actions">
            <section className="empty-copy" role="status">
              <p className="empty-copy-title">Пока пусто</p>
              <p className="empty-copy-lead">
                Запиши первую тренировку — здесь появится динамика по весам и объёму
              </p>
            </section>
            <Link to="/app/workouts/new" className="btn btn-primary btn-block">
              Записать тренировку
            </Link>
          </div>
        ) : null}

        {showInsights && progress && !noWorkouts ? <InsightsBlocks insights={progress.insights} /> : null}

        {progress && !noWorkouts && !bothEmpty ? (
          <div className="workout-progress-cluster">
            {strengthPoints.length > 0 || progress.exercises.length > 0 ? (
            <section className="surface workout-progress-metric" aria-label="Сила">
              <SectionTitle>Сила</SectionTitle>
              {progress.exercises.length > 0 ? (
                <button
                  type="button"
                  className="workout-progress-title-btn"
                  aria-haspopup="dialog"
                  aria-expanded={pickerOpen}
                  aria-label={`Упражнение: ${exerciseValue || 'выбрать'}`}
                  onClick={() => setPickerOpen(true)}
                >
                  <span className="workout-progress-exercise-name">
                    {exerciseValue || 'Выбрать упражнение'}
                  </span>
                  <ChevronDown size={16} aria-hidden />
                </button>
              ) : null}
              {strengthPoints.length === 0 ? (
                <p className="muted workout-progress-metric-empty">
                  Запиши подходы — здесь будет динамика по упражнению.
                </p>
              ) : (
                <>
                  <div className="workout-progress-hero" aria-label="Рабочий вес">
                    <strong className="workout-progress-hero-value">{strengthHero || '—'}</strong>
                    <HeroDelta text={strengthPeriodDelta} tone={strengthDelta?.tone} />
                  </div>
                  <LineChart
                    points={strengthPoints}
                    unit="кг"
                    selectedIndex={selectedStrength}
                    onSelect={setSelectedStrength}
                  />
                  {strengthPoint ? (
                    <p className="workout-progress-caption muted">
                      {formatCaptionDay(strengthPoint.at)}
                      {strengthPoint.meta ? ` · ${strengthPoint.meta}` : ''}
                    </p>
                  ) : null}
                </>
              )}
            </section>
            ) : null}

            {bodyPoints.length > 0 ? (
            <section className="surface workout-progress-metric" aria-label="Вес тела">
              <SectionTitle>Вес тела</SectionTitle>
                <div className="workout-progress-hero" aria-label="Вес тела">
                  <strong className="workout-progress-hero-value">{bodyHero || '—'}</strong>
                  <HeroDelta text={bodyPeriodDelta} tone={deltaToneFromKg(progress.body.deltaKg)} />
                </div>
                <LineChart
                  points={bodyPoints}
                  unit="кг"
                  selectedIndex={selectedBody}
                  onSelect={setSelectedBody}
                />
                {bodyPoint ? (
                  <p className="workout-progress-caption muted">
                    {formatCaptionDay(bodyPoint.at)}
                  </p>
                ) : null}
            </section>
            ) : null}
          </div>
        ) : null}

        {showInsights && progress ? (
          <div className="workout-progress-cluster">
            <RecordsBlock insights={progress.insights} />
          </div>
        ) : null}
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

