import { useCallback, useEffect, useRef, useState } from 'react'
import { ListChecks, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SectionTitle } from './SectionTitle'
import { SoftLoader } from './SoftLoader'
import { useApp } from '../context/useApp'
import {
  apiFetchWorkoutMonthly,
  apiGenerateWorkoutMonthly,
  apiMarkWorkoutMonthlyRecommendationClicked,
  apiMarkWorkoutMonthlyViewed,
  type WorkoutMonthlyFacts,
  type WorkoutMonthlyState,
} from '../lib/apiClient'
import { formatSignedPercent, formatVsPreviousPeriod, ruPlural } from '../lib/workouts'
import { WORKOUT_RECAP_ADMIN_ONLY } from '../lib/workoutRecap'

function sessionsWord(n: number) {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return `${n} тренировок`
  if (last === 1) return `${n} тренировка`
  if (last >= 2 && last <= 4) return `${n} тренировки`
  return `${n} тренировок`
}

function recLooksLikeLogCta(title: string, text: string) {
  return /записать тренировк|запиши тренировк|добавить тренировк/i.test(`${title} ${text}`)
}

function FactsFallback({ facts }: { facts: WorkoutMonthlyFacts }) {
  const vol = formatSignedPercent(facts.volume.deltaPercent)
  const vs = formatVsPreviousPeriod(facts.workoutCount.delta, facts.workoutCount.previous)
  const items = [sessionsWord(facts.workoutCount.current)]
  if (vs) items.push(vs)
  if (vol) items.push(`${vol} объёма`)
  if (facts.prs.count > 0) {
    items.push(
      `${facts.prs.count} ${ruPlural(facts.prs.count, 'новый рекорд', 'новых рекорда', 'новых рекордов')}`,
    )
  }
  return (
    <ul className="workout-coach-chips">
      {items.map((c) => (
        <li key={c}>{c}</li>
      ))}
    </ul>
  )
}

export function WorkoutMonthRecap() {
  const { user, apiOnline } = useApp()
  const [monthly, setMonthly] = useState<WorkoutMonthlyState | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const viewedFor = useRef<string | null>(null)
  const allowed = !WORKOUT_RECAP_ADMIN_ONLY || Boolean(user?.isAdmin)

  const load = useCallback(async () => {
    if (!allowed || !apiOnline) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      setMonthly(await apiFetchWorkoutMonthly())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить разбор месяца')
      setMonthly(null)
    } finally {
      setLoading(false)
    }
  }, [allowed, apiOnline])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!monthly?.letter || !apiOnline || !allowed) return
    const key = monthly.periodStart
    if (viewedFor.current === key) return
    viewedFor.current = key
    void apiMarkWorkoutMonthlyViewed().catch(() => {
      viewedFor.current = null
    })
  }, [allowed, apiOnline, monthly])

  if (!allowed) return null

  const generate = async () => {
    if (!allowed || !apiOnline || generating) return
    setGenerating(true)
    setError('')
    try {
      setMonthly(await apiGenerateWorkoutMonthly())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось собрать разбор месяца')
    } finally {
      setGenerating(false)
    }
  }

  const markRecClick = () => {
    void apiMarkWorkoutMonthlyRecommendationClicked().catch(() => {})
  }

  const letter = monthly?.letter
  const facts = monthly?.facts
  const showFallback =
    Boolean(monthly && !letter && (monthly.status === 'offline' || monthly.status === 'failed'))
  const recapTitle = (
    <SectionTitle
      action={
        monthly ? (
          <span className="muted">
            {monthly.periodLabel}
            <span className="dim"> · цифры за 30 дней</span>
          </span>
        ) : null
      }
    >
      Твой месяц
    </SectionTitle>
  )

  return (
    <div id="month-recap" className="workout-week-recap">
      {error ? (
        <p className="feedback-error" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <>
          {recapTitle}
          <SoftLoader label="Загружаем разбор месяца…" />
        </>
      ) : null}

      {!loading && monthly && letter ? (
        <section className="surface workout-coach-block">
          {recapTitle}
          <p className="workout-coach-headline">{letter.headline.title}</p>
          {letter.headline.text ? <p className="muted">{letter.headline.text}</p> : null}

          {letter.wins.length ? (
            <div className="workout-coach-next">
              <p className="workout-coach-next-label">Главный прогресс</p>
              <ul className="workout-coach-wins">
                {letter.wins.map((item, i) => (
                  <li key={`${item.title}-${i}`}>
                    {item.title ? <strong>{item.title}</strong> : null}
                    {item.text ? <p className="muted">{item.text}</p> : null}
                    {item.why ? <p className="muted">{item.why}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {letter.attention.length ? (
            <div className="workout-coach-next">
              <p className="workout-coach-next-label">Стоит обратить внимание</p>
              <ul className="workout-coach-wins">
                {letter.attention.map((item, i) => (
                  <li key={`${item.title}-${i}`}>
                    {item.title ? <strong>{item.title}</strong> : null}
                    {item.text ? <p className="muted">{item.text}</p> : null}
                    {item.why ? <p className="muted">{item.why}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {letter.recommendations.length ? (
            <div className="workout-coach-next">
              <p className="workout-coach-next-label">На следующий месяц</p>
              <ul className="workout-coach-wins">
                {letter.recommendations.map((rec, i) => {
                  const logCta = recLooksLikeLogCta(rec.title, rec.text)
                  return (
                    <li key={`${rec.title}-${i}`}>
                      {rec.title ? (
                        logCta ? (
                          <Link to="/app/workouts/new" onClick={markRecClick}>
                            <strong>{rec.title}</strong>
                          </Link>
                        ) : (
                          <strong>{rec.title}</strong>
                        )
                      ) : null}
                      {rec.text ? <p className="muted">{rec.text}</p> : null}
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}

          {letter.wrap ? <p className="muted">{letter.wrap}</p> : null}

          <Link to="/app/workouts/new" className="btn btn-primary btn-block" onClick={markRecClick}>
            <Plus size={16} /> Записать тренировку
          </Link>
        </section>
      ) : null}

      {!loading && monthly && !letter && monthly.canGenerate ? (
        <section className="surface workouts-empty">
          {recapTitle}
          <ListChecks size={28} aria-hidden />
          <p className="empty-copy-title">
            {monthly.status === 'failed' ? 'Твой месяц' : 'Собрать разбор месяца'}
          </p>
          <p className="muted">
            {monthly.status === 'failed'
              ? 'Разбор временно недоступен'
              : 'Как ты тренировался в последние 30 дней и куда двигаешься.'}
          </p>
          {facts ? <FactsFallback facts={facts} /> : null}
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={generating || !apiOnline}
            onClick={() => void generate()}
          >
            {generating
              ? 'Собираем…'
              : monthly.status === 'failed'
                ? 'Попробовать снова'
                : 'Собрать разбор'}
          </button>
        </section>
      ) : null}

      {!loading && monthly && !letter && !monthly.canGenerate ? (
        <section className="surface workouts-empty">
          {recapTitle}
          <ListChecks size={28} aria-hidden />
          <p className="empty-copy-title">
            {monthly.status === 'locked'
              ? 'Пока мало данных'
              : monthly.status === 'skipped'
                ? 'Пока без разбора'
                : showFallback
                  ? 'Твой месяц'
                  : 'Разбор появится позже'}
          </p>
          <p className="muted">
            {monthly.status === 'locked'
              ? 'Пока недостаточно данных за месяц.'
              : monthly.status === 'skipped'
                ? 'В этом месяце нет заметных изменений для нового анализа.'
                : showFallback
                  ? 'Разбор временно недоступен'
                  : 'Цифры — на графике выше.'}
          </p>
          {facts ? <FactsFallback facts={facts} /> : null}
        </section>
      ) : null}

      {!loading && !monthly && !error ? (
        <section className="surface workouts-empty">
          {recapTitle}
          <p className="empty-copy-title">Разбор появится позже</p>
          <p className="muted">Не удалось получить статус. Обнови страницу.</p>
        </section>
      ) : null}
    </div>
  )
}
