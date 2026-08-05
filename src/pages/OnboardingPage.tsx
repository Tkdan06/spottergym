import { useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { CityCarousel } from '../components/CityCarousel'
import { GymCard } from '../components/GymCard'
import { useApp } from '../context/useApp'
import { EXPERIENCE_LEVELS, GYMS, INTERESTS, SPORTS, WEEKDAYS } from '../data/mock'
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
  const [selectedDays, setSelectedDays] = useState<string[]>(['Пн', 'Ср', 'Пт'])
  const [from, setFrom] = useState('19:00')
  const [to, setTo] = useState('21:00')
  const [gymQuery, setGymQuery] = useState('')

  const cityGyms = useMemo(() => {
    const q = gymQuery.toLowerCase().trim()
    return GYMS.filter((g) => {
      if (g.city !== city) return false
      if (!q) return true
      return `${g.name} ${g.network} ${g.address} ${g.district}`.toLowerCase().includes(q)
    }).sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  }, [city, gymQuery])

  if (!user) return <Navigate to="/register" replace />
  if (user.onboardingDone) return <Navigate to="/app" replace />

  const toggle = (list: string[], value: string, setter: (v: string[]) => void) => {
    setter(list.includes(value) ? list.filter((i) => i !== value) : [...list, value])
  }

  const toggleSport = (value: string) => {
    setSports((prev) => {
      const next = prev.includes(value) ? prev.filter((i) => i !== value) : [...prev, value]
      setCoachSports((cs) => cs.filter((s) => next.includes(s)))
      return next
    })
  }

  const canNext = () => {
    if (step === 0) return Boolean(city)
    if (step === 1) return gymIds.length > 0
    if (step === 2) {
      const parsedAge = typeof age === 'number' ? age : Number(age)
      if (!Number.isFinite(parsedAge) || parsedAge < 18 || parsedAge > 80) return false
      if (bio.trim().length < 10 || sports.length === 0) return false
      if (isCoach && coachSports.length === 0) return false
      return true
    }
    if (step === 3) return selectedDays.length > 0
    return true
  }

  const finish = () => {
    const parsedAge = typeof age === 'number' ? age : Number(age)
    if (!Number.isFinite(parsedAge) || parsedAge < 18 || parsedAge > 80) return
    const visitSlots: VisitSlot[] = selectedDays.map((day) => ({ day, from, to }))
    completeOnboarding({
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
      visitSlots,
      // Пока нет своего фото — гендерный плейсхолдер из avatar
      photos: [],
    })
    navigate('/app')
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
          <section className="stack">
            <p className="muted">
              Выбери один или несколько клубов · выбрано {gymIds.length}
            </p>
            <input
              className="search-input"
              placeholder="Начни вводить название или адрес"
              value={gymQuery}
              onChange={(e) => setGymQuery(e.target.value)}
            />
            <div className="card-list gym-pick-list">
              {cityGyms.length ? (
                cityGyms.map((gym) => (
                  <GymCard
                    key={gym.id}
                    gym={gym}
                    selected={gymIds.includes(gym.id)}
                    onSelect={() => toggle(gymIds, gym.id, setGymIds)}
                  />
                ))
              ) : (
                <div className="empty-state">В этом городе пока нет залов в демо.</div>
              )}
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="stack onboarding-form">
            <div className="field">
              <label htmlFor="age">Возраст</label>
              <input
                id="age"
                type="number"
                min={18}
                max={80}
                inputMode="numeric"
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
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Цели, стиль тренировок, что ищешь в зале"
              />
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
                <p className="field-label">Тренирую</p>
                <p className="muted" style={{ marginBottom: 8 }}>
                  Выбери направления из своих активностей — они будут видны на карточке.
                </p>
                <div className="chip-grid">
                  {(sports.length ? sports : SPORTS).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`chip ${coachSports.includes(s) ? 'coach' : ''}`}
                      onClick={() => {
                        if (!sports.includes(s)) {
                          setSports((prev) => [...prev, s])
                        }
                        toggle(coachSports, s, setCoachSports)
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
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
            <p className="muted">Когда обычно бываешь в зале — так проще пересечься.</p>
            <div className="chip-grid">
              {WEEKDAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  className={`chip ${selectedDays.includes(day) ? 'active' : ''}`}
                  onClick={() => toggle(selectedDays, day, setSelectedDays)}
                >
                  {day}
                </button>
              ))}
            </div>
            <div className="time-row">
              <div className="field">
                <label htmlFor="from">С</label>
                <input id="from" type="time" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="to">До</label>
                <input id="to" type="time" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
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
