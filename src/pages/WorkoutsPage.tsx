import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Copy,
  Plus,
  TrendingUp,
} from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { exitWorkoutsSection } from '../lib/workoutsNav'
import { SectionTitle } from '../components/SectionTitle'
import { SOFT_LOADER_DELAY_MS, SoftLoader } from '../components/SoftLoader'
import { WorkoutReadonlySets } from '../components/WorkoutReadonlySets'
import { useApp } from '../context/useApp'
import {
  apiFetchWorkoutProgress,
  apiFetchWorkouts,
  type WorkoutProgress,
  type WorkoutSessionSummary,
} from '../lib/apiClient'
import {
  formatBodyDelta,
  formatKg,
  formatWorkoutWhen,
} from '../lib/workouts'
import './WorkoutsPage.css'
import './FeedbackPage.css'

const PAGE_SIZE = 20

function workoutsCountLabel(n: number) {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return `${n} тренировок`
  if (last === 1) return `${n} тренировка`
  if (last >= 2 && last <= 4) return `${n} тренировки`
  return `${n} тренировок`
}

export function WorkoutsPage() {
  const navigate = useNavigate()
  const { user, apiOnline } = useApp()
  const [list, setList] = useState<WorkoutSessionSummary[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [atRetentionCap, setAtRetentionCap] = useState(false)
  const [progress, setProgress] = useState<WorkoutProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!apiOnline) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    const progressP = apiFetchWorkoutProgress(30)
      .then((prog) => setProgress(prog))
      .catch(() => setProgress(null))
    try {
      const page = await apiFetchWorkouts({ limit: PAGE_SIZE })
      setList(page.workouts)
      setHasMore(page.hasMore)
      setTotalCount(page.totalCount)
      setAtRetentionCap(page.atRetentionCap)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить тренировки')
      setList([])
      setHasMore(false)
      setTotalCount(0)
      setAtRetentionCap(false)
      setProgress(null)
    } finally {
      setLoading(false)
    }
    void progressP
  }, [apiOnline])

  useEffect(() => {
    void load()
  }, [load])

  const loadMore = async () => {
    if (!apiOnline || loadingMore || !hasMore || !list.length) return
    const last = list[list.length - 1]
    setLoadingMore(true)
    setError('')
    try {
      const page = await apiFetchWorkouts({
        limit: PAGE_SIZE,
        before: last.performedAt,
        beforeId: last.id,
      })
      setList((prev) => {
        const seen = new Set(prev.map((w) => w.id))
        return [...prev, ...page.workouts.filter((w) => !seen.has(w.id))]
      })
      setHasMore(page.hasMore)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить ещё')
    } finally {
      setLoadingMore(false)
    }
  }

  const showStrip = useMemo(() => {
    if (!progress) return false
    const h = progress.highlight
    return (
      h.bodyLatestKg != null ||
      (h.liftName != null && (h.liftDeltaWeightKg != null || h.liftDeltaReps != null))
    )
  }, [progress])

  if (!user) return <Navigate to="/login" replace />

  const bodyDeltaText = formatBodyDelta(progress?.highlight.bodyDeltaKg)

  const copyWorkout = (id: string) => {
    navigate('/app/workouts/new', { state: { copyFromId: id } })
  }

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <main className="page workouts-page">
      <div className="subpage-top">
        <button type="button" className="back-link" onClick={() => exitWorkoutsSection(navigate)}>
          <ArrowLeft size={18} /> Мой зал
        </button>

        <header className="page-header">
          <div className="page-header-text workouts-head">
            <h1 className="page-title">Мои тренировки</h1>
            <p className="muted">Дневник прогресса</p>
          </div>
        </header>
      </div>

      {error ? (
        <p className="feedback-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="workouts-actions">
        <Link to="/app/workouts/new" className="btn btn-primary btn-block">
          <Plus size={16} /> Записать тренировку
        </Link>
      </div>

      <div className="workouts-feed" aria-busy={loading && !list.length}>
        {loading && !list.length ? (
          <SoftLoader delayMs={SOFT_LOADER_DELAY_MS} label="Загружаем тренировки…" />
        ) : null}

        {!loading && (atRetentionCap || totalCount >= 580) ? (
          <p className="workouts-retention-banner" role="status">
            {atRetentionCap
              ? 'Достигнут лимит истории (600). Новые записи вытесняют самые старые.'
              : `История почти заполнена (${totalCount} из 600). Скоро старые тренировки начнут удаляться.`}
          </p>
        ) : null}

        {!loading && showStrip && progress ? (
          <Link to="/app/workouts/progress" className="workouts-progress-strip">
            <div className="workouts-progress-strip-icon" aria-hidden>
              <TrendingUp size={18} />
            </div>
            <div className="workouts-progress-strip-copy">
              <strong>Прогресс</strong>
              {progress.highlight.bodyLatestKg != null ? (
                <span className="muted">
                  {formatKg(progress.highlight.bodyLatestKg)}
                  {bodyDeltaText ? ` · ${bodyDeltaText} за 30д` : ''}
                </span>
              ) : null}
            </div>
            <ChevronRight size={18} className="workouts-progress-strip-chevron" aria-hidden />
          </Link>
        ) : null}

        {!loading && !list.length ? (
          <section className="workouts-empty">
            <ClipboardList size={28} aria-hidden />
            <p className="empty-copy-title">Пока пусто</p>
            <p className="muted">
              Запиши первую тренировку — так появится история, и ты сможешь следить за прогрессом.
            </p>
          </section>
        ) : null}

        {list.length ? (
          <section className="workouts-list-block">
          <SectionTitle
            action={
              totalCount > 0 ? (
                <span className="dim workouts-history-count">{workoutsCountLabel(totalCount)}</span>
              ) : null
            }
          >
            История
          </SectionTitle>
          <ul className="workouts-list">
            {list.map((w) => {
              const open = expandedId === w.id
              const exercises = Array.isArray(w.exercises) ? w.exercises : []
              const metaLabel = `${w.exerciseCount} упр. · ${w.setCount} подх.`
              return (
                <li key={w.id} className={`workouts-board ${open ? 'is-open' : ''}`}>
                  <div className="workouts-board-top">
                    <Link
                      to={`/app/workouts/${w.id}`}
                      className="workouts-board-main"
                      aria-label={`Открыть «${w.title}»`}
                    >
                      <div className="workouts-row-copy">
                        <strong>{w.title}</strong>
                        <span className="muted">
                          {formatWorkoutWhen(w.performedAt)}
                          {w.bodyWeightKg != null ? ` · ${formatKg(w.bodyWeightKg)}` : ''}
                        </span>
                        {w.notes?.trim() ? (
                          <span className="dim workouts-row-note">{w.notes.trim()}</span>
                        ) : null}
                      </div>
                    </Link>
                    <button
                      type="button"
                      className="workouts-row-copy-btn"
                      aria-label={`Скопировать «${w.title}» как новую`}
                      title="Скопировать как новую"
                      onClick={() => copyWorkout(w.id)}
                    >
                      <Copy size={16} strokeWidth={2} />
                    </button>
                  </div>

                  <button
                    type="button"
                    className="workouts-board-expand"
                    aria-expanded={open}
                    aria-label={open ? 'Свернуть упражнения' : `Показать упражнения · ${metaLabel}`}
                    onClick={() => toggleExpand(w.id)}
                  >
                    <span className="dim workouts-row-meta">{metaLabel}</span>
                    <ChevronDown
                      size={16}
                      className={`workouts-board-chevron ${open ? 'is-open' : ''}`}
                      aria-hidden
                    />
                  </button>

                  {open ? (
                    <div className="workouts-board-body">
                      {exercises.length ? (
                        <WorkoutReadonlySets exercises={exercises} />
                      ) : (
                        <p className="muted">Нет упражнений</p>
                      )}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
          {hasMore ? (
            <button
              type="button"
              className="btn btn-soft btn-block"
              disabled={loadingMore || !apiOnline}
              onClick={() => void loadMore()}
            >
              {loadingMore ? 'Загружаем…' : 'Ещё тренировки'}
            </button>
          ) : null}
        </section>
        ) : null}
      </div>
    </main>
  )
}
