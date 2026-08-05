import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'
import { CityCarousel } from '../components/CityCarousel'
import { GymCard } from '../components/GymCard'
import { ScheduleEditor, sortVisitSlots } from '../components/ScheduleEditor'
import { useApp } from '../context/useApp'
import { COACH_DIRECTIONS, EXPERIENCE_LEVELS, GYMS, INTERESTS, SPORTS } from '../data/mock'
import { isDemoAccount } from '../lib/demoAccount'
import { buildRealGymStatsMap } from '../lib/gymStats'
import { BIO_MAX, BIO_MIN } from '../lib/fieldLimits'
import { ageFieldProps, bioFieldProps, searchFieldProps } from '../lib/inputAttrs'
import type { ExperienceLevel, Intent, PrivacyMode, VisitSlot } from '../types'
import './OnboardingPage.css'

const steps = ['Город', 'Зал', 'О себе', 'Расписание', 'Приватность']

export function OnboardingPage() {
  const { user, completeOnboarding } = useApp()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [city, setCity] = useState(user?.city || 'Москва')
  const [gymIds, setGymIds] = useState<string[]>(user?.gymIds?.length ? user.gymIds : [])
  const [age, setAge] = useState<number | ''>(user?.age || 25)
  const [bio, setBio] = useState(user?.bio || '')
  const [intent, setIntent] = useState<Intent>(user?.intent || 'both')
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(
    user?.experienceLevel || 'confident',
  )
  const [interests, setInterests] = useState<string[]>(user?.interests || [])
  const [sports, setSports] = useState<string[]>(user?.sports || [])
  const [isCoach, setIsCoach] = useState(user?.isCoach ?? false)
  const [coachSports, setCoachSports] = useState<string[]>(user?.coachSports || [])
  const [lookingToMeet, setLookingToMeet] = useState(user?.lookingToMeet ?? true)
  const [privacy, setPrivacy] = useState<PrivacyMode>(user?.privacy || 'open')
  const [visitSlots, setVisitSlots] = useState<VisitSlot[]>(() =>
    sortVisitSlots(
      user?.visitSlots?.length
        ? user.visitSlots
        : [
            { day: 'Пн', from: '19:00', to: '21:00' },
            { day: 'Ср', from: '19:00', to: '21:00' },
            { day: 'Пт', from: '19:00', to: '21:00' },
          ],
    ),
  )
  const [gymQuery, setGymQuery] = useState('')

  const cityGyms = useMemo(() => {
    const q = gymQuery.toLowerCase().trim()
    return GYMS.filter((g) => {
      if (g.city !== city) return false
      if (!q) return true
      return `${g.name} ${g.network} ${g.address} ${g.district}`.toLowerCase().includes(q)
    }).sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  }, [city, gymQuery])

  const demoStats = isDemoAccount(user?.email)
  const liveStats = useMemo(() => {
    if (!user || demoStats) return {}
    return buildRealGymStatsMap(
      cityGyms.map((g) => g.id),
      { ...user, gymIds },
    )
  }, [user, demoStats, cityGyms, gymIds])

  useEffect(() => {
    if (user?.onboardingDone) {
      navigate('/app', { replace: true })
    }
  }, [user?.onboardingDone, navigate])

  if (!user) return <Navigate to="/register" replace />
  if (user.onboardingDone) return null

  const toggle = (list: string[], value: string, setter: (v: string[]) => void) => {
    setter(list.includes(value) ? list.filter((i) => i !== value) : [...list, value])
  }

  const toggleSport = (value: string) => {
    setSports((prev) =>
      prev.includes(value) ? prev.filter((i) => i !== value) : [...prev, value],
    )
  }

  const bioOk = bio.trim().length >= BIO_MIN
  const ageOk = (() => {
    const parsedAge = typeof age === 'number' ? age : Number(age)
    return Number.isFinite(parsedAge) && parsedAge >= 18 && parsedAge <= 80
  })()

  const canNext = () => {
    if (step === 0) return Boolean(city)
    if (step === 1) return gymIds.length > 0
    if (step === 2) {
      if (!ageOk || !bioOk || sports.length === 0) return false
      if (isCoach && coachSports.length === 0) return false
      return true
    }
    if (step === 3) return visitSlots.length > 0
    return true
  }

  const finish = () => {
    const parsedAge = typeof age === 'number' ? age : Number(age)
    if (!Number.isFinite(parsedAge) || parsedAge < 18 || parsedAge > 80) return
    void completeOnboarding({
      city,
      gymIds,
      homeGymId: gymIds[0] || '',
      age: parsedAge,
      bio: bio.trim(),
      intent,
      experienceLevel,
      interests,
      sports,
      isCoach,
      coachSports: isCoach ? coachSports : [],
      lookingToMeet,
      privacy,
      visitSlots: sortVisitSlots(visitSlots),
      // Пока нет своего фото — гендерный плейсхолдер из avatar
      photos: [],
    })
    // переход на /app — в useEffect после onboardingDone (см. выше)
  }

  return (
    <div className="app-shell">
      <main className="page no-nav onboarding">
        <div className="onboarding-top">
          <p className="brand-mark onboarding-brand">
            SPOT<span>TER</span>
          </p>
          <div className="stepper">
            {steps.map((label, i) => (
              <span key={label} className={i <= step ? 'dot on' : 'dot'} title={label} />
            ))}
          </div>
          {step !== 0 ? <h1>{steps[step]}</h1> : null}
        </div>

        <div className={`onboarding-body ${step === 1 ? 'gym-step' : ''}`}>
        {step === 0 && (
          <CityCarousel
            value={city}
            onChange={(next) => {
              setCity(next)
              setGymQuery('')
            }}
            label="Шаг 1 · Город"
            hint="Листай карусель — сначала крупные города, дальше вся Россия"
          />
        )}

        {step === 1 && (
          <section className="stack onboarding-gym-step">
            <p className="muted">
              Выбери один или несколько клубов · выбрано {gymIds.length}
            </p>
            <label className="app-search">
              <Search size={16} aria-hidden />
              <input
                {...searchFieldProps}
                placeholder="Клуб, район или адрес"
                value={gymQuery}
                onChange={(e) => setGymQuery(e.target.value)}
                aria-label="Поиск клуба"
              />
            </label>
            <div className="card-list gym-pick-list">
              {cityGyms.length ? (
                cityGyms.map((gym) => (
                  <GymCard
                    key={gym.id}
                    gym={gym}
                    selected={gymIds.includes(gym.id)}
                    showDemoStats={demoStats}
                    membersCount={liveStats[gym.id]?.membersCount}
                    activeNow={liveStats[gym.id]?.activeNow}
                    onSelect={() => toggle(gymIds, gym.id, setGymIds)}
                  />
                ))
              ) : (
                <div className="empty-copy" role="status">
                  <p className="empty-copy-title">Пока нет залов</p>
                  <p className="empty-copy-lead">Выбери другой город</p>
                </div>
              )}
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="stack onboarding-form">
            <div className="field">
              <label htmlFor="age">Возраст</label>
              <input
                {...ageFieldProps}
                id="age"
                value={age}
                onChange={(e) => {
                  const next = e.target.value
                  setAge(next === '' ? '' : Number(next))
                }}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="bio">О себе</label>
              <textarea
                {...bioFieldProps}
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Цели, стиль тренировок, что ищешь в зале"
                maxLength={BIO_MAX}
              />
              <p className="dim onboarding-field-hint">
                {!bioOk
                  ? `Минимум ${BIO_MIN} символов${
                      bio.trim().length ? ` · ещё ${BIO_MIN - bio.trim().length}` : ''
                    }`
                  : `${bio.length}/${BIO_MAX}`}
              </p>
            </div>
            <div>
              <p className="field-label">Что ищешь</p>
              <div className="chip-grid">
                {(
                  [
                    ['dating', 'Знакомства'],
                    ['buddy', 'Партнёр по залу'],
                    ['both', 'И то, и другое'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`chip ${intent === value ? 'active' : ''}`}
                    onClick={() => setIntent(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="field-label">Уровень</p>
              <p className="muted" style={{ marginBottom: 8 }}>
                Как себя чувствуешь в зале — без стажа в годах
              </p>
              <div className="chip-grid">
                {EXPERIENCE_LEVELS.map((level) => (
                  <button
                    key={level.value}
                    type="button"
                    className={`chip ${experienceLevel === level.value ? 'active' : ''}`}
                    onClick={() => setExperienceLevel(level.value)}
                    title={level.hint}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="field-label">Виды активности</p>
              <div className="chip-grid">
                {SPORTS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`chip ${sports.includes(s) ? 'active' : ''}`}
                    onClick={() => toggleSport(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              className="toggle-row"
              onClick={() => {
                setIsCoach((v) => {
                  if (v) setCoachSports([])
                  return !v
                })
              }}
            >
              <div>
                <strong>Я тренер</strong>
                <p className="muted">Карточка с меткой «Тренер» и направлениями</p>
              </div>
              <span className={`toggle ${isCoach ? 'on' : ''}`} />
            </button>
            {isCoach ? (
              <div>
                <p className="field-label">Чему тренирую</p>
                <p className="muted" style={{ marginBottom: 8 }}>
                  Групповые, персональные и другие направления — выбери хотя бы одно.
                </p>
                <div className="chip-grid">
                  {COACH_DIRECTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`chip ${coachSports.includes(s) ? 'coach' : ''}`}
                      onClick={() => toggle(coachSports, s, setCoachSports)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                {isCoach && !coachSports.length ? (
                  <p className="dim onboarding-field-hint">Выбери направление — иначе «Дальше» неактивна</p>
                ) : null}
              </div>
            ) : null}
            <div>
              <p className="field-label">Интересы</p>
              <div className="chip-grid">
                {INTERESTS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`chip ${interests.includes(s) ? 'active' : ''}`}
                    onClick={() => toggle(interests, s, setInterests)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="stack">
            <p className="muted">Когда обычно в зале — для каждого дня можно своё время.</p>
            <ScheduleEditor value={visitSlots} onChange={setVisitSlots} idPrefix="onboard" />
          </section>
        )}

        {step === 4 && (
          <section className="stack privacy-step">
            <button
              type="button"
              className={`privacy-card ${privacy === 'open' ? 'active' : ''}`}
              onClick={() => setPrivacy('open')}
            >
              <h3>Открытый профиль</h3>
              <p className="muted">Имя, фото и статус видны другим в зале.</p>
            </button>
            <button
              type="button"
              className={`privacy-card ${privacy === 'anonymous' ? 'active' : ''}`}
              onClick={() => setPrivacy('anonymous')}
            >
              <h3>Анонимный режим</h3>
              <p className="muted">Виден только аватар-заглушка. Можно открыться позже в чате.</p>
            </button>
            <button
              type="button"
              className="toggle-row"
              onClick={() => setLookingToMeet((v) => !v)}
            >
              <div>
                <strong>Открыт к знакомству</strong>
                <p className="muted">Показать статус «можно написать»</p>
              </div>
              <span className={`toggle ${lookingToMeet ? 'on' : ''}`} />
            </button>
          </section>
        )}
        </div>

        <div className="onboarding-actions">
          {step > 0 ? (
            <button type="button" className="btn btn-ghost" onClick={() => setStep((s) => s - 1)}>
              Назад
            </button>
          ) : (
            <span />
          )}
          {step < steps.length - 1 ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canNext()}
              onClick={() => setStep((s) => s + 1)}
            >
              Дальше
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={finish}>
              В зал
            </button>
          )}
        </div>
      </main>
    </div>
  )
}
