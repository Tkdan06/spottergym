import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ChevronRight, ClipboardList, Copy, Plus, TrendingUp } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { SectionTitle } from '../components/SectionTitle'
import { useApp } from '../context/useApp'
import {
  apiFetchWorkoutProgress,
  apiFetchWorkouts,
  type WorkoutProgress,
  type WorkoutSessionSummary,
} from '../lib/apiClient'
import {
  formatBodyDelta,
  formatDeltaLabel,
  formatKg,
  formatWorkoutWhen,
} from '../lib/workouts'
import './WorkoutsPage.css'
import './FeedbackPage.css'

const PAGE_SIZE = 20

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

  const load = useCallback(async () => {
    if (!apiOnline) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const [page, prog] = await Promise.all([
        apiFetchWorkouts({ limit: PAGE_SIZE }),
        apiFetchWorkoutProgress(30),
      ])
      setList(page.workouts)
      setHasMore(page.hasMore)
      setTotalCount(page.totalCount)
      setAtRetentionCap(page.atRetentionCap)
      setProgress(prog)
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

  const last = list[0]
  const bodyDeltaText = formatBodyDelta(progress?.highlight.bodyDeltaKg)
  const liftDelta = formatDeltaLabel(
    progress?.highlight.liftDeltaWeightKg,
    progress?.highlight.liftDeltaReps,
  )

  return (
    <main className="page workouts-page">
      <button type="button" className="back-link" onClick={() => navigate(-1)}>
        <ArrowLeft size={18} /> Назад
      </button>

      <header className="workouts-head">
        <h1 className="page-title">Мои тренировки</h1>
        <p className="muted">Дневник подходов, веса и прогресса</p>
      </header>

      {error ? (
        <p className="feedback-error" role="alert">
          {error}
        </p>
      ) : null}

      {atRetentionCap || totalCount >= 580 ? (
        <p className="workouts-retention-banner" role="status">
          {atRetentionCap
            ? 'Достигнут лимит истории (600). Новые записи вытесняют самые старые.'
            : `История почти заполнена (${totalCount} из 600). Скоро старые тренировки начнут удаляться.`}
        </p>
      ) : null}

      <div className="workouts-actions">
        <Link to="/app/workouts/new" className="btn btn-primary btn-block">
          <Plus size={16} /> Записать тренировку
        </Link>
        {last ? (
          <button
            type="button"
            className="btn btn-soft btn-block"
            onClick={() =>
              navigate('/app/workouts/new', { state: { copyFromId: last.id } })
            }
          >
            <Copy size={16} /> Повторить последнюю
          </button>
        ) : null}
      </div>

      {showStrip && progress ? (
        <Link to="/app/workouts/progress" className="workouts-progress-strip">
          <div className="workouts-progress-strip-icon" aria-hidden>
            <TrendingUp size={18} />
          </div>
          <div className="workouts-progress-strip-copy">
            <strong>Прогресс</strong>
            <span className="muted">
              {progress.highlight.bodyLatestKg != null ? (
                <>
                  {formatKg(progress.highlight.bodyLatestKg)}
                  {bodyDeltaText ? ` · ${bodyDeltaText} за 30д` : ''}
                </>
              ) : null}
              {progress.highlight.bodyLatestKg != null && liftDelta && progress.highlight.liftName
                ? ' · '
                : null}
              {liftDelta && progress.highlight.liftName ? (
                <>
                  {progress.highlight.liftName}
                  {liftDelta.tone === 'up' ? ' ↑ ' : liftDelta.tone === 'down' ? ' ↓ ' : ' · '}
                  {liftDelta.text}
                </>
              ) : null}
            </span>
          </div>
          <ChevronRight size={18} className="workouts-progress-strip-chevron" aria-hidden />
        </Link>
      ) : null}

      {!loading && !list.length ? (
        <section className="surface workouts-empty">
          <ClipboardList size={28} aria-hidden />
          <p className="empty-copy-title">Пока пусто</p>
          <p className="muted">
            Запиши первую тренировку — так появится история, и ты сможешь следить за прогрессом.
          </p>
        </section>
      ) : null}

      {list.length ? (
        <section className="surface workouts-list-block">
          <SectionTitle>История</SectionTitle>
          <ul className="workouts-list">
            {list.map((w) => (
              <li key={w.id}>
                <Link to={`/app/workouts/${w.id}`} className="workouts-row">
                  <div className="workouts-row-copy">
                    <strong>{w.title}</strong>
                    <span className="muted">
                      {formatWorkoutWhen(w.performedAt)}
                      {w.bodyWeightKg != null ? ` · ${formatKg(w.bodyWeightKg)}` : ''}
                    </span>
                  </div>
                  <span className="dim workouts-row-meta">
                    {w.exerciseCount} упр. · {w.setCount} подх.
                  </span>
                </Link>
              </li>
            ))}
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
    </main>
  )
}
