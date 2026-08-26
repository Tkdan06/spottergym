import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Copy, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'
import { SubpageHeader } from '../components/SubpageHeader'
import { useApp } from '../context/useApp'
import {
  apiCreateWorkout,
  apiDeleteWorkout,
  apiFetchWorkout,
  apiFetchWorkouts,
  apiUpdateWorkout,
  type WorkoutSessionDetail,
} from '../lib/apiClient'
import { WORKOUT_NOTE_MAX } from '../lib/fieldLimits'
import { goWorkoutsHub } from '../lib/workoutsNav'
import { getCheckInStartedAt } from '../lib/presence'
import { useSheetA11y } from '../lib/sheetA11y'
import { useMoment } from '../components/MomentFX'
import { WeightKgSheet, BODY_WEIGHT_MAX_KG, BODY_WEIGHT_MIN_KG } from '../components/WeightKgSheet'
import {
  SetWeightSheet,
  BAR_WEIGHT_MAX_KG,
  BAR_WEIGHT_MIN_KG,
  EXERCISE_NAME_MAX,
  WORKOUT_TITLE_MAX,
  MAX_SETS_PER_EXERCISE,
  MAX_EXERCISES_PER_WORKOUT,
  formatBarWeight,
} from '../components/SetWeightSheet'
import { WorkoutReadonlySets } from '../components/WorkoutReadonlySets'
import {
  formatKg,
  formatWorkoutWhen,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from '../lib/workouts'
import './WorkoutsPage.css'
import './FeedbackPage.css'

type DraftSet = {
  weightKg: string
  reps: string
  weightDelta?: number | null
  repsDelta?: number | null
}
type DraftExercise = {
  trackKey: string
  name: string
  sets: DraftSet[]
}

function newTrackKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 24)
  }
  return `ex${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

function emptySet(): DraftSet {
  return { weightKg: '', reps: '' }
}

function emptyExercise(): DraftExercise {
  return { trackKey: newTrackKey(), name: '', sets: [emptySet()] }
}

function clampBodyWeight(raw: number | null | undefined): number | null {
  if (raw == null || Number.isNaN(raw)) return null
  if (raw < BODY_WEIGHT_MIN_KG || raw > BODY_WEIGHT_MAX_KG) return null
  return Math.round(raw)
}

function clampBarWeight(raw: number): number {
  const n = Math.round(raw * 10) / 10
  return Math.min(BAR_WEIGHT_MAX_KG, Math.max(BAR_WEIGHT_MIN_KG, n))
}

function fromDetail(w: WorkoutSessionDetail): {
  title: string
  when: string
  bodyWeightKg: number | null
  notes: string
  exercises: DraftExercise[]
} {
  return {
    title: w.title.slice(0, WORKOUT_TITLE_MAX),
    when: toDatetimeLocalValue(w.performedAt),
    bodyWeightKg: clampBodyWeight(w.bodyWeightKg),
    notes: String(w.notes || '').slice(0, WORKOUT_NOTE_MAX),
    exercises: w.exercises.slice(0, MAX_EXERCISES_PER_WORKOUT).map((ex) => ({
      trackKey: ex.trackKey || newTrackKey(),
      name: ex.name.slice(0, EXERCISE_NAME_MAX),
      sets: ex.sets.slice(0, MAX_SETS_PER_EXERCISE).map((s) => ({
        weightKg: String(clampBarWeight(s.weightKg)),
        reps: String(s.reps),
        weightDelta: s.weightDelta,
        repsDelta: s.repsDelta,
      })),
    })),
  }
}

function toPayload(
  title: string,
  when: string,
  bodyWeightKg: number | null,
  notes: string,
  exercises: DraftExercise[],
) {
  return {
    title: title.trim().slice(0, WORKOUT_TITLE_MAX),
    performedAt: fromDatetimeLocalValue(when),
    bodyWeightKg: clampBodyWeight(bodyWeightKg),
    notes: notes.trim().slice(0, WORKOUT_NOTE_MAX),
    exercises: exercises
      .slice(0, MAX_EXERCISES_PER_WORKOUT)
      .map((ex) => ({
        trackKey: ex.trackKey || newTrackKey(),
        name: ex.name.trim().slice(0, EXERCISE_NAME_MAX),
        sets: ex.sets
          .slice(0, MAX_SETS_PER_EXERCISE)
          .map((s) => ({
            weightKg: clampBarWeight(Number(String(s.weightKg).replace(',', '.')) || 0),
            reps: Math.max(0, Math.floor(Number(s.reps) || 0)),
          }))
          .filter((s) => s.reps > 0 && s.weightKg >= BAR_WEIGHT_MIN_KG),
      }))
      .filter((ex) => ex.name && ex.sets.length),
  }
}

function notePreview(text: string) {
  const one = text.trim().replace(/\s+/g, ' ')
  if (!one) return ''
  return one.length > 56 ? `${one.slice(0, 55)}…` : one
}

export function WorkoutEditorPage() {
  const { id } = useParams()
  const location = useLocation()
  const isNew = !id || id === 'new'
  const isEditRoute = /\/edit\/?$/.test(location.pathname)
  const isEditing = isNew || isEditRoute
  const isViewing = !isNew && !isEditRoute
  const navigate = useNavigate()
  const { user, apiOnline } = useApp()
  const { celebrate } = useMoment()
  const copyFromId = (location.state as { copyFromId?: string } | null)?.copyFromId

  const [title, setTitle] = useState('')
  const [when, setWhen] = useState(() => toDatetimeLocalValue(new Date()))
  const [bodyWeightKg, setBodyWeightKg] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [noteDraft, setNoteDraft] = useState('')
  const [noteSheetOpen, setNoteSheetOpen] = useState(false)
  const [weightSheetOpen, setWeightSheetOpen] = useState(false)
  const [barWeightTarget, setBarWeightTarget] = useState<{ ei: number; si: number } | null>(null)
  const [exercises, setExercises] = useState<DraftExercise[]>([emptyExercise()])
  const [loading, setLoading] = useState(!isNew || Boolean(copyFromId))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const menuRef = useRef<HTMLDivElement>(null)
  const confirmRef = useRef<HTMLDivElement>(null)
  const noteSheetRef = useRef<HTMLDivElement>(null)
  useSheetA11y(menuOpen, () => setMenuOpen(false), menuRef)
  useSheetA11y(confirmOpen, () => setConfirmOpen(false), confirmRef)
  useSheetA11y(noteSheetOpen, () => setNoteSheetOpen(false), noteSheetRef)

  const defaultWhen = useMemo(() => {
    if (!user) return toDatetimeLocalValue(new Date())
    if (user.isActive) {
      const start = getCheckInStartedAt(user)
      if (start) return toDatetimeLocalValue(start)
    }
    return toDatetimeLocalValue(new Date())
  }, [user])

  useEffect(() => {
    if (isNew && !copyFromId) setWhen(defaultWhen)
  }, [isNew, copyFromId, defaultWhen])

  const loadId = isNew ? copyFromId : id

  useEffect(() => {
    if (!loadId || !apiOnline) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void apiFetchWorkout(loadId)
      .then((w) => {
        if (cancelled) return
        const draft = fromDetail(w)
        setTitle(isNew ? w.title : draft.title)
        setWhen(isNew ? defaultWhen : draft.when)
        if (!isNew) setBodyWeightKg(draft.bodyWeightKg)
        // Fresh session note — don't carry mood from «Повторить»
        setNotes(isNew ? '' : draft.notes)
        setExercises(
          isNew
            ? draft.exercises.map((ex) => ({
                ...ex,
                sets: ex.sets.map((s) => ({ ...s, weightDelta: null, repsDelta: null })),
              }))
            : draft.exercises,
        )
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Не удалось загрузить')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [loadId, apiOnline, isNew, copyFromId, defaultWhen])

  useEffect(() => {
    if (!isNew || !apiOnline) return
    let cancelled = false
    void apiFetchWorkouts({ limit: 20 })
      .then(({ workouts }) => {
        if (cancelled) return
        const lastWithBody = workouts.find((w) => clampBodyWeight(w.bodyWeightKg) != null)
        if (lastWithBody) {
          const kg = clampBodyWeight(lastWithBody.bodyWeightKg)
          if (kg != null) setBodyWeightKg((prev) => (prev != null ? prev : kg))
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isNew, apiOnline])

  const onSave = async () => {
    if (saving || !apiOnline) return
    const payload = toPayload(title, when, bodyWeightKg, notes, exercises)
    if (!payload.title) {
      setError('Укажи название тренировки')
      return
    }
    if (!payload.exercises.length) {
      setError('Добавь хотя бы одно упражнение с подходом')
      return
    }
    setSaving(true)
    setError('')
    try {
      const saved = isNew
        ? await apiCreateWorkout(payload)
        : await apiUpdateWorkout(id!, payload)
      celebrate('workout')
      navigate(`/app/workouts/${saved.id}`, { replace: true })
      const draft = fromDetail(saved)
      setTitle(draft.title)
      setWhen(draft.when)
      setBodyWeightKg(draft.bodyWeightKg)
      setNotes(draft.notes)
      setExercises(draft.exercises)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    if (!id || isNew || deleting) return
    setDeleting(true)
    setError('')
    try {
      await apiDeleteWorkout(id)
      goWorkoutsHub(navigate)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить')
      setConfirmOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  const updateExercise = useCallback((index: number, patch: Partial<DraftExercise>) => {
    setExercises((prev) => prev.map((ex, i) => (i === index ? { ...ex, ...patch } : ex)))
  }, [])

  if (!user) return <Navigate to="/login" replace />

  const pageTitle = isNew ? 'Новая тренировка' : isViewing ? title || 'Тренировка' : 'Редактирование'

  return (
    <main className="page workouts-page workout-editor">
      <SubpageHeader
        title={pageTitle}
        onBack={() => goWorkoutsHub(navigate)}
        action={
          !isNew ? (
            <button
              type="button"
              className="icon-btn"
              aria-label="Ещё"
              onClick={() => setMenuOpen(true)}
            >
              <MoreHorizontal size={20} />
            </button>
          ) : undefined
        }
      />

      {error ? (
        <p className="feedback-error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && isViewing ? (
        <>
          <section className="surface workout-view-meta">
            <p className="muted">{formatWorkoutWhen(fromDatetimeLocalValue(when))}</p>
            {bodyWeightKg != null ? <p>Вес: {formatKg(bodyWeightKg)}</p> : null}
            {notes.trim() ? <p className="workout-view-note">{notes.trim()}</p> : null}
          </section>
          <section className="surface workouts-form-block">
            {exercises.length ? (
              <WorkoutReadonlySets exercises={exercises} />
            ) : (
              <p className="muted">Нет упражнений</p>
            )}
          </section>
        </>
      ) : null}

      {!loading && isEditing ? (
        <>
          <section className="surface workouts-form-block">
            <label className="field">
              <span>Название</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Грудь, ноги, full body…"
                maxLength={WORKOUT_TITLE_MAX}
              />
            </label>
            <label className="field">
              <span>Дата и время</span>
              <input
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
              />
            </label>
            <div className="field">
              <span>Твой вес</span>
              <button
                type="button"
                className="workout-weight-trigger"
                onClick={() => setWeightSheetOpen(true)}
              >
                {bodyWeightKg != null ? (
                  <strong>{bodyWeightKg} кг</strong>
                ) : (
                  <span className="muted">Выбрать</span>
                )}
              </button>
            </div>
            <button
              type="button"
              className="workout-note-link"
              onClick={() => {
                setNoteDraft(notes)
                setNoteSheetOpen(true)
              }}
            >
              <Pencil size={14} aria-hidden />
              <span className={notes.trim() ? '' : 'muted'}>
                {notes.trim() ? notePreview(notes) : 'Заметка'}
              </span>
            </button>
          </section>

          <section className="workouts-exercises">
            {exercises.map((ex, ei) => (
                <article key={ex.trackKey || ei} className="surface workout-exercise-card">
                  <div className="workout-exercise-head">
                    <input
                      className="workout-exercise-name"
                      value={ex.name}
                      onChange={(e) => updateExercise(ei, { name: e.target.value })}
                      placeholder="Упражнение"
                      maxLength={EXERCISE_NAME_MAX}
                    />
                    {exercises.length > 1 ? (
                      <button
                        type="button"
                        className="section-action"
                        onClick={() => setExercises((prev) => prev.filter((_, i) => i !== ei))}
                      >
                        Удалить
                      </button>
                    ) : null}
                  </div>
                  <div className="workout-sets-head" aria-hidden>
                    <span>Подход</span>
                    <span>Кг</span>
                    <span>Повт.</span>
                    <span />
                  </div>
                  {ex.sets.map((set, si) => (
                    <div key={si} className="workout-set-row">
                      <span className="dim">{si + 1}</span>
                      <button
                        type="button"
                        className="workout-set-weight-btn"
                        aria-label={`Вес, подход ${si + 1}`}
                        onClick={() => setBarWeightTarget({ ei, si })}
                      >
                        {set.weightKg ? (
                          <strong>
                            {formatBarWeight(Number(set.weightKg.replace(',', '.')) || 0)}
                          </strong>
                        ) : (
                          <span className="muted">&nbsp;</span>
                        )}
                      </button>
                      <input
                        inputMode="numeric"
                        value={set.reps}
                        placeholder=""
                        onChange={(e) => {
                          const sets = ex.sets.map((s, j) =>
                            j === si ? { ...s, reps: e.target.value } : s,
                          )
                          updateExercise(ei, { sets })
                        }}
                        aria-label={`Повторы, подход ${si + 1}`}
                      />
                      <button
                        type="button"
                        className="icon-btn workout-set-remove"
                        aria-label="Удалить подход"
                        disabled={ex.sets.length <= 1}
                        onClick={() => {
                          const sets = ex.sets.filter((_, j) => j !== si)
                          updateExercise(ei, { sets: sets.length ? sets : [emptySet()] })
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-ghost btn-block"
                    disabled={ex.sets.length >= MAX_SETS_PER_EXERCISE}
                    onClick={() => {
                      if (ex.sets.length >= MAX_SETS_PER_EXERCISE) return
                      updateExercise(ei, { sets: [...ex.sets, emptySet()] })
                    }}
                  >
                    <Plus size={16} /> Подход
                    {ex.sets.length >= MAX_SETS_PER_EXERCISE
                      ? ` · макс. ${MAX_SETS_PER_EXERCISE}`
                      : ''}
                  </button>
                </article>
            ))}

            <button
              type="button"
              className="btn btn-soft btn-block"
              disabled={exercises.length >= MAX_EXERCISES_PER_WORKOUT}
              onClick={() => {
                if (exercises.length >= MAX_EXERCISES_PER_WORKOUT) return
                setExercises((prev) => [...prev, emptyExercise()])
              }}
            >
              <Plus size={16} /> Упражнение
              {exercises.length >= MAX_EXERCISES_PER_WORKOUT
                ? ` · макс. ${MAX_EXERCISES_PER_WORKOUT}`
                : ''}
            </button>
          </section>

          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={saving || !apiOnline}
            onClick={() => void onSave()}
          >
            {saving ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </>
      ) : null}

      {menuOpen ? (
        <div className="app-sheet" role="dialog" aria-modal="true" aria-label="Действия">
          <button
            type="button"
            className="app-sheet-backdrop"
            aria-label="Закрыть"
            onClick={() => setMenuOpen(false)}
          />
          <div className="app-sheet-panel" ref={menuRef}>
            <div className="app-sheet-grab" aria-hidden />
            {isViewing ? (
              <button
                type="button"
                className="sheet-action"
                onClick={() => {
                  setMenuOpen(false)
                  navigate(`/app/workouts/${id}/edit`)
                }}
              >
                <Pencil size={18} /> Редактировать
              </button>
            ) : null}
            <button
              type="button"
              className="sheet-action"
              onClick={() => {
                setMenuOpen(false)
                navigate('/app/workouts/new', { state: { copyFromId: id } })
              }}
            >
              <Copy size={18} /> Скопировать как новую
            </button>
            <button
              type="button"
              className="sheet-action is-danger"
              onClick={() => {
                setMenuOpen(false)
                setConfirmOpen(true)
              }}
            >
              <Trash2 size={18} /> Удалить
            </button>
            <button type="button" className="sheet-action" onClick={() => setMenuOpen(false)}>
              Отмена
            </button>
          </div>
        </div>
      ) : null}

      {confirmOpen ? (
        <div className="app-sheet" role="dialog" aria-modal="true" aria-labelledby="workout-del-title">
          <button
            type="button"
            className="app-sheet-backdrop"
            aria-label="Закрыть"
            onClick={() => setConfirmOpen(false)}
          />
          <div className="app-sheet-panel" ref={confirmRef}>
            <div className="app-sheet-grab" aria-hidden />
            <h3 id="workout-del-title">Удалить тренировку?</h3>
            <p className="muted">Запись исчезнет из истории.</p>
            <button
              type="button"
              className="btn btn-danger btn-block"
              disabled={deleting}
              onClick={() => void onDelete()}
            >
              {deleting ? 'Удаляем…' : 'Удалить'}
            </button>
            <button
              type="button"
              className="sheet-action"
              disabled={deleting}
              onClick={() => setConfirmOpen(false)}
            >
              Отмена
            </button>
          </div>
        </div>
      ) : null}

      {noteSheetOpen ? (
        <div
          className="app-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="workout-note-title"
        >
          <button
            type="button"
            className="app-sheet-backdrop"
            aria-label="Закрыть"
            onClick={() => setNoteSheetOpen(false)}
          />
          <div className="app-sheet-panel workout-note-sheet" ref={noteSheetRef}>
            <div className="app-sheet-grab" aria-hidden />
            <h3 id="workout-note-title">Заметка</h3>
            <label className="field">
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value.slice(0, WORKOUT_NOTE_MAX))}
                maxLength={WORKOUT_NOTE_MAX}
                rows={5}
                placeholder="Как прошла тренировка?"
                autoFocus
              />
            </label>
            <p className="dim workout-note-count">
              {noteDraft.length}/{WORKOUT_NOTE_MAX}
            </p>
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={() => {
                setNotes(noteDraft.trim().slice(0, WORKOUT_NOTE_MAX))
                setNoteSheetOpen(false)
              }}
            >
              Готово
            </button>
            {noteDraft.trim() || notes.trim() ? (
              <button
                type="button"
                className="sheet-action"
                onClick={() => {
                  setNoteDraft('')
                  setNotes('')
                  setNoteSheetOpen(false)
                }}
              >
                Убрать заметку
              </button>
            ) : (
              <button type="button" className="sheet-action" onClick={() => setNoteSheetOpen(false)}>
                Отмена
              </button>
            )}
          </div>
        </div>
      ) : null}

      <WeightKgSheet
        open={weightSheetOpen}
        value={bodyWeightKg}
        onClose={() => setWeightSheetOpen(false)}
        onConfirm={(kg) => {
          setBodyWeightKg(kg)
          setWeightSheetOpen(false)
        }}
      />

      <SetWeightSheet
        open={barWeightTarget != null}
        value={
          barWeightTarget
            ? (() => {
                const raw = exercises[barWeightTarget.ei]?.sets[barWeightTarget.si]?.weightKg
                if (!raw) return null
                const n = Number(String(raw).replace(',', '.'))
                return Number.isFinite(n) && n > 0 ? n : null
              })()
            : null
        }
        onClose={() => setBarWeightTarget(null)}
        onConfirm={(kg) => {
          if (!barWeightTarget) return
          const { ei, si } = barWeightTarget
          setExercises((prev) =>
            prev.map((ex, i) => {
              if (i !== ei) return ex
              const sets = ex.sets.map((s, j) =>
                j === si ? { ...s, weightKg: String(kg) } : s,
              )
              return { ...ex, sets }
            }),
          )
          setBarWeightTarget(null)
        }}
      />
    </main>
  )
}
