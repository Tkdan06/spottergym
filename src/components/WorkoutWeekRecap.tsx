import { useCallback, useEffect, useState } from 'react'
import { ListChecks, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SectionTitle } from './SectionTitle'
import { SoftLoader } from './SoftLoader'
import { useApp } from '../context/useApp'
import {
  apiFetchWorkoutCoach,
  apiGenerateWorkoutCoach,
  type WorkoutCoachState,
} from '../lib/apiClient'
import { WORKOUT_RECAP_ADMIN_ONLY } from '../lib/workoutRecap'

function sessionsWord(n: number) {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return `${n} тренировок`
  if (last === 1) return `${n} тренировка`
  if (last >= 2 && last <= 4) return `${n} тренировки`
  return `${n} тренировок`
}

function needCopy(n: number) {
  if (n <= 0) return 'Нужно минимум 4 тренировки за 21 день, чтобы появился разбор.'
  return `Нужно ещё ${sessionsWord(n)} за 21 день, чтобы появился разбор.`
}

function FactChips({ coach }: { coach: WorkoutCoachState }) {
  const split = coach.facts.weekSplit
  const chips: string[] = [`На этой неделе — ${sessionsWord(coach.facts.weekSessions)}`]
  if (split.lower || split.upper) {
    chips.push(`Верх ${split.upper} · низ ${split.lower}`)
  }
  if (coach.facts.weekPrevSessions > 0) {
    chips.push(`Прошлая неделя — ${sessionsWord(coach.facts.weekPrevSessions)}`)
  }
  return (
    <ul className="workout-coach-chips">
      {chips.map((c) => (
        <li key={c}>{c}</li>
      ))}
    </ul>
  )
}

export function WorkoutWeekRecap() {
  const { user, apiOnline } = useApp()
  const [coach, setCoach] = useState<WorkoutCoachState | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const allowed = !WORKOUT_RECAP_ADMIN_ONLY || Boolean(user?.isAdmin)

  const load = useCallback(async () => {
    if (!allowed || !apiOnline) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      setCoach(await apiFetchWorkoutCoach())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить разбор')
      setCoach(null)
    } finally {
      setLoading(false)
    }
  }, [allowed, apiOnline])

  useEffect(() => {
    void load()
  }, [load])

  if (!allowed) return null

  const generate = async () => {
    if (!allowed || !apiOnline || generating) return
    setGenerating(true)
    setError('')
    try {
      setCoach(await apiGenerateWorkoutCoach())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось собрать разбор')
    } finally {
      setGenerating(false)
    }
  }

  const letter = coach?.letter

  return (
    <div id="week-recap" className="workout-week-recap">
      <SectionTitle action={coach ? <span className="muted">{coach.periodLabel}</span> : null}>
        Разбор недели
      </SectionTitle>

      {error ? (
        <p className="feedback-error" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? <SoftLoader label="Загружаем разбор…" /> : null}

      {!loading && coach && letter ? (
        <section className="surface workout-coach-block">
          <p className="workout-coach-headline">{letter.headline}</p>
          {letter.weekVerdict.text ? <p className="muted">{letter.weekVerdict.text}</p> : null}

          {letter.wins.length ? (
            <ul className="workout-coach-wins">
              {letter.wins.map((w, i) => (
                <li key={`${w.title}-${i}`}>
                  {w.title ? <strong>{w.title}</strong> : null}
                  {w.text ? <p className="muted">{w.text}</p> : null}
                </li>
              ))}
            </ul>
          ) : null}

          {letter.nextSession.steps.length || letter.nextSession.focus ? (
            <div className="workout-coach-next">
              <p className="workout-coach-next-label">Дальше</p>
              {letter.nextSession.focus ? (
                <p className="muted">{letter.nextSession.focus}</p>
              ) : null}
              {letter.nextSession.steps.length ? (
                <ol className="workout-coach-steps">
                  {letter.nextSession.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              ) : null}
            </div>
          ) : null}

          <Link to="/app/workouts/new" className="btn btn-primary btn-block">
            <Plus size={16} /> Записать тренировку
          </Link>
        </section>
      ) : null}

      {!loading && coach && !letter && coach.canGenerate ? (
        <section className="surface workouts-empty">
          <ListChecks size={28} aria-hidden />
          <p className="empty-copy-title">Собрать разбор</p>
          <p className="muted">Коротко по дневнику: что вышло за неделю и что делать дальше.</p>
          <FactChips coach={coach} />
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={generating || !apiOnline}
            onClick={() => void generate()}
          >
            {generating ? 'Собираем…' : 'Собрать разбор'}
          </button>
        </section>
      ) : null}

      {!loading && coach && !letter && !coach.canGenerate ? (
        <section className="surface workouts-empty">
          <ListChecks size={28} aria-hidden />
          <p className="empty-copy-title">
            {coach.status === 'locked'
              ? 'Пока рано'
              : !coach.configured
                ? 'GigaChat не подключён'
                : 'Разбор появится позже'}
          </p>
          <p className="muted">
            {coach.status === 'locked'
              ? needCopy(coach.sessionsNeeded)
              : !coach.configured
                ? 'На сервере нет ключа GigaChat.'
                : 'Цифры — на графике выше.'}
          </p>
          <FactChips coach={coach} />
        </section>
      ) : null}

      {!loading && !coach && !error ? (
        <section className="surface workouts-empty">
          <p className="empty-copy-title">Разбор появится позже</p>
          <p className="muted">Не удалось получить статус. Обнови страницу.</p>
        </section>
      ) : null}
    </div>
  )
}
