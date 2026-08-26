import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
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

function distinctDetail(primary: string, extra?: string | null) {
  const a = primary.trim()
  const b = (extra || '').trim()
  if (!b || b === a) return null
  return b
}

function RecapItem({
  title,
  text,
  detail,
  value,
  valueTone = 'up',
  href,
  onTitleClick,
}: {
  title: string
  text: string
  detail?: string | null
  value?: string | null
  valueTone?: 'up' | 'flat'
  href?: string
  onTitleClick?: () => void
}) {
  const heading = title.trim()
  const body = text.trim()
  const rawAside = value?.trim() || ''
  const aside = rawAside && !heading.includes(rawAside) ? rawAside : null
  const note = detail?.trim() || null
  if (!heading && !body && !note) return null

  const titleNode = heading ? (
    href ? (
      <Link to={href} className="workout-recap-item-title" onClick={onTitleClick}>
        {heading}
      </Link>
    ) : (
      <strong className="workout-recap-item-title">{heading}</strong>
    )
  ) : null

  return (
    <li className="workout-recap-item">
      {titleNode || aside ? (
        <div className="workout-recap-item-head">
          {titleNode}
          {aside ? (
            <span
              className={`workout-recap-item-value${valueTone === 'up' ? ' is-up' : ' is-flat'}`}
            >
              {aside}
            </span>
          ) : null}
        </div>
      ) : null}
      {body ? <p className="muted">{body}</p> : null}
      {note ? <p className="dim workout-recap-item-detail">{note}</p> : null}
    </li>
  )
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
  const [open, setOpen] = useState(false)
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
      setOpen(true)
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
        letter ? (
          <button
            type="button"
            className="section-action workout-recap-toggle"
            aria-expanded={open}
            aria-label={open ? 'Свернуть разбор месяца' : 'Посмотреть разбор'}
            onClick={() => setOpen((v) => !v)}
          >
            <ChevronDown size={16} aria-hidden className={open ? 'is-open' : undefined} />
          </button>
        ) : monthly ? (
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
    <div id="month-recap" className="workout-week-recap workout-month-recap">
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
          {open ? (
            <div className="workout-recap-body">
              <div className="workout-recap-lead">
                <p className="workout-recap-caption dim">
                  {monthly.periodLabel}
                  <span> · цифры за 30 дней</span>
                </p>
                {letter.headline.title && letter.headline.title !== 'Твой месяц' ? (
                  <p className="workout-recap-lead-title">{letter.headline.title}</p>
                ) : null}
                {letter.headline.text ? <p className="muted">{letter.headline.text}</p> : null}
              </div>

              {letter.wins.length ? (
                <section className="workout-recap-section" aria-label="Главный прогресс">
                  <p className="workout-recap-kicker">Главный прогресс</p>
                  <ul className="workout-recap-list">
                    {letter.wins.map((item, i) => (
                      <RecapItem
                        key={`${item.title}-${i}`}
                        title={item.title}
                        text={item.text}
                        detail={distinctDetail(item.text, item.why)}
                        value={item.value}
                        valueTone="up"
                      />
                    ))}
                  </ul>
                </section>
              ) : null}

              {letter.attention.length ? (
                <section className="workout-recap-section" aria-label="Стоит обратить внимание">
                  <p className="workout-recap-kicker">Стоит обратить внимание</p>
                  <ul className="workout-recap-list">
                    {letter.attention.map((item, i) => (
                      <RecapItem
                        key={`${item.title}-${i}`}
                        title={item.title}
                        text={item.text}
                        detail={distinctDetail(item.text, item.why)}
                        value={item.value}
                        valueTone="flat"
                      />
                    ))}
                  </ul>
                </section>
              ) : null}

              {letter.recommendations.length ? (
                <section className="workout-recap-section" aria-label="На следующий месяц">
                  <p className="workout-recap-kicker">На следующий месяц</p>
                  <ul className="workout-recap-list">
                    {letter.recommendations.map((rec, i) => {
                      const logCta = recLooksLikeLogCta(rec.title, rec.text)
                      return (
                        <RecapItem
                          key={`${rec.title}-${i}`}
                          title={rec.title}
                          text={rec.text}
                          detail={distinctDetail(rec.text, rec.reason)}
                          href={logCta ? '/app/workouts/new' : undefined}
                          onTitleClick={logCta ? markRecClick : undefined}
                        />
                      )
                    })}
                  </ul>
                </section>
              ) : null}

              {letter.wrap ? <p className="workout-recap-wrap dim">{letter.wrap}</p> : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {!loading && monthly && !letter && monthly.canGenerate ? (
        <section className="surface workouts-empty">
          {recapTitle}
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
          <p className="empty-copy-title">
            {monthly.status === 'locked'
              ? 'Нужно больше тренировок'
              : monthly.status === 'skipped'
                ? 'Пока без разбора'
                : showFallback
                  ? 'Твой месяц'
                  : 'Разбор появится позже'}
          </p>
          <p className="muted">
            {monthly.status === 'locked'
              ? 'Разбор месяца сравнивает последние 30 дней с предыдущими. Нужно минимум четыре тренировки, чтобы было с чем сравнить.'
              : monthly.status === 'skipped'
                ? 'За месяц цифры почти не сдвинулись. Новый разбор появится, когда будет рекорд, сдвиг объёма или частоты.'
                : showFallback
                  ? 'Разбор временно недоступен'
                  : 'Цифры — в блоках ниже.'}
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
