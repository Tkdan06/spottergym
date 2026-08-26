import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SectionTitle } from './SectionTitle'
import { SoftLoader } from './SoftLoader'
import { useApp } from '../context/useApp'
import {
  apiFetchWorkoutInsight,
  apiGenerateWorkoutInsight,
  apiMarkWorkoutInsightViewed,
  type WorkoutInsightFacts,
  type WorkoutInsightState,
} from '../lib/apiClient'
import { formatSignedPercent, ruPlural } from '../lib/workouts'
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

function FactsFallback({ facts }: { facts: WorkoutInsightFacts }) {
  const vol = formatSignedPercent(facts.volume.deltaPercent)
  const items = [sessionsWord(facts.workoutCount.current)]
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

export function WorkoutWeekRecap() {
  const { user, apiOnline } = useApp()
  const [insight, setInsight] = useState<WorkoutInsightState | null>(null)
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
      setInsight(await apiFetchWorkoutInsight())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить разбор')
      setInsight(null)
    } finally {
      setLoading(false)
    }
  }, [allowed, apiOnline])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!insight?.letter || !apiOnline || !allowed) return
    const key = insight.periodStart
    if (viewedFor.current === key) return
    viewedFor.current = key
    void apiMarkWorkoutInsightViewed().catch(() => {
      viewedFor.current = null
    })
  }, [allowed, apiOnline, insight])

  if (!allowed) return null

  const generate = async () => {
    if (!allowed || !apiOnline || generating) return
    setGenerating(true)
    setError('')
    try {
      setInsight(await apiGenerateWorkoutInsight())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось собрать разбор')
    } finally {
      setGenerating(false)
    }
  }

  const letter = insight?.letter
  const facts = insight?.facts
  const showFallback =
    Boolean(insight && !letter && (insight.status === 'offline' || insight.status === 'failed'))
  const recapTitle = (
    <SectionTitle action={insight ? <span className="muted">{insight.periodLabel}</span> : null}>
      Разбор недели
    </SectionTitle>
  )

  return (
    <div id="week-recap" className="workout-week-recap">
      {error ? (
        <p className="feedback-error" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <>
          {recapTitle}
          <SoftLoader label="Загружаем разбор…" />
        </>
      ) : null}

      {!loading && insight && letter ? (
        <section className="surface workout-coach-block">
          {recapTitle}
          <p className="workout-coach-headline">{letter.summary.title}</p>
          {letter.summary.text ? <p className="muted">{letter.summary.text}</p> : null}

          {letter.insights.length ? (
            <ul className="workout-coach-wins">
              {letter.insights.map((item, i) => (
                <li key={`${item.title}-${i}`}>
                  {item.title ? <strong>{item.title}</strong> : null}
                  {item.text ? <p className="muted">{item.text}</p> : null}
                </li>
              ))}
            </ul>
          ) : null}

          {letter.recommendations.length ? (
            <div className="workout-coach-next">
              <p className="workout-coach-next-label">Дальше</p>
              <ul className="workout-coach-wins">
                {letter.recommendations.map((rec, i) => {
                  const logCta = recLooksLikeLogCta(rec.title, rec.text)
                  return (
                    <li key={`${rec.title}-${i}`}>
                      {rec.title ? (
                        logCta ? (
                          <Link to="/app/workouts/new">
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

          <Link to="/app/workouts/new" className="btn btn-primary btn-block">
            <Plus size={16} /> Записать тренировку
          </Link>
        </section>
      ) : null}

      {!loading && insight && !letter && insight.canGenerate ? (
        <section className="surface workouts-empty">
          {recapTitle}
          <p className="empty-copy-title">
            {insight.status === 'failed' ? 'Твой прогресс' : 'Собрать разбор'}
          </p>
          <p className="muted">
            {insight.status === 'failed'
              ? 'Разбор временно недоступен'
              : 'Коротко по дневнику: что изменилось за неделю и что попробовать дальше.'}
          </p>
          {facts ? <FactsFallback facts={facts} /> : null}
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={generating || !apiOnline}
            onClick={() => void generate()}
          >
            {generating ? 'Собираем…' : insight.status === 'failed' ? 'Попробовать снова' : 'Собрать разбор'}
          </button>
        </section>
      ) : null}

      {!loading && insight && !letter && !insight.canGenerate ? (
        <section className="surface workouts-empty">
          {recapTitle}
          <p className="empty-copy-title">
            {insight.status === 'locked'
              ? 'Нужно больше тренировок'
              : insight.status === 'skipped'
                ? 'Пока без разбора'
                : showFallback
                  ? 'Твой прогресс'
                  : 'Разбор появится позже'}
          </p>
          <p className="muted">
            {insight.status === 'locked'
              ? 'Разбор сравнивает эту неделю с предыдущей. Запиши ещё одну тренировку — и можно будет собрать разбор.'
              : insight.status === 'skipped'
                ? 'За неделю цифры почти не сдвинулись. Новый разбор появится, когда будет рекорд, сдвиг объёма или частоты.'
                : showFallback
                  ? 'Разбор временно недоступен'
                  : 'Цифры — на графике выше.'}
          </p>
          {facts ? <FactsFallback facts={facts} /> : null}
        </section>
      ) : null}

      {!loading && !insight && !error ? (
        <section className="surface workouts-empty">
          {recapTitle}
          <p className="empty-copy-title">Разбор появится позже</p>
          <p className="muted">Не удалось получить статус. Обнови страницу.</p>
        </section>
      ) : null}
    </div>
  )
}
