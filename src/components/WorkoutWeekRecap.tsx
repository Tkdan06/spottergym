import { useCallback, useEffect, useState } from 'react'
import { ListChecks, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/useApp'
import {
  apiFetchWorkoutCoach,
  apiGenerateWorkoutCoach,
  type WorkoutCoachState,
} from '../lib/apiClient'

function nextMondayLabel(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', {
    timeZone: 'Europe/Moscow',
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  })
}

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
  const { apiOnline } = useApp()
  const [coach, setCoach] = useState<WorkoutCoachState | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!apiOnline) {
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
  }, [apiOnline])

  useEffect(() => {
    void load()
  }, [load])

  const generate = async () => {
    if (!apiOnline || generating) return
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
  const nextLabel = coach ? nextMondayLabel(coach.nextAt) : ''

  return (
    <div id="week-recap" className="workout-week-recap">
      <header className="workout-week-recap-head">
        <h2 className="workout-coach-h">Разбор недели</h2>
        {coach ? <p className="muted">{coach.periodLabel}</p> : null}
      </header>

      {error ? (
        <p className="feedback-error" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? <p className="muted">Загружаем…</p> : null}

      {!loading && coach && letter ? (
        <>
          <section
            className={`activity-summary workout-coach-verdict is-${letter.weekVerdict.tone}`}
            aria-label="Вердикт недели"
          >
            <span className="activity-summary-label">Неделя</span>
            <strong className="activity-summary-total">{letter.headline}</strong>
            {letter.weekVerdict.text ? (
              <p className="activity-summary-sessions muted">{letter.weekVerdict.text}</p>
            ) : null}
          </section>

          {letter.wins.length ? (
            <section className="surface workout-coach-block">
              <h2 className="workout-coach-h">Что получилось</h2>
              <ul className="workout-coach-wins">
                {letter.wins.map((w, i) => (
                  <li key={`${w.title}-${i}`}>
                    {w.title ? <strong>{w.title}</strong> : null}
                    {w.text ? <p className="muted">{w.text}</p> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="surface workout-coach-block workout-coach-next">
            <h2 className="workout-coach-h">{letter.nextSession.title || 'Следующая тренировка'}</h2>
            {letter.nextSession.focus ? (
              <p className="muted workout-coach-focus">{letter.nextSession.focus}</p>
            ) : null}
            <ol className="workout-coach-steps">
              {letter.nextSession.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            <Link to="/app/workouts/new" className="btn btn-primary btn-block">
              <Plus size={16} /> Записать тренировку
            </Link>
          </section>

          {letter.distance30 && (letter.distance30.text || letter.distance30.change) ? (
            <section className="surface workout-coach-block workout-coach-distance">
              <h2 className="workout-coach-h">На дистанции</h2>
              {letter.distance30.text ? <p>{letter.distance30.text}</p> : null}
              {letter.distance30.change ? (
                <p className="muted">{letter.distance30.change}</p>
              ) : null}
            </section>
          ) : null}

          {letter.distance90?.text ? (
            <p className="dim workout-coach-d90">{letter.distance90.text}</p>
          ) : null}

          <p className="dim workout-coach-foot">
            По твоим записям, не консультация врача.
            {nextLabel ? ` Следующий разбор — с ${nextLabel}.` : ''}
          </p>
        </>
      ) : null}

      {!loading && coach && !letter && coach.canGenerate ? (
        <section className="surface workouts-empty">
          <ListChecks size={28} aria-hidden />
          <p className="empty-copy-title">Собрать разбор за неделю</p>
          <p className="muted">
            По дневнику: засчиталась ли неделя и что делать в следующий заход.
          </p>
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
                ? 'На сервере нет ключа GigaChat. Запрос к модели не отправлялся.'
                : 'Разбор сейчас недоступен. Цифры из дневника — на графике выше.'}
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
