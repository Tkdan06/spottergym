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

const steps = ['Город', 'Зал', 'О себе', 'Расписание', 'Приватность'] as const

/** Одна подсказка под заголовком — одинаковый паттерн на всех шагах */
const STEP_LEADS = [
  'Выбери город — список от большего числа клубов к меньшему',
  'Выбери клуб из списка или нажми «Пропустить» и добавь позже',
  'Быстрые ответы о себе — поля со звёздочкой обязательны',
  'Когда обычно в зале — для каждого дня можно своё время',
  'Как тебя видят другие и открыт ли ты к знакомству',
] as const

const BIO_PROMPTS = [
  'Ищу компанию для тренировок',
  'Открыт к знакомствам в зале',
  'Новичок — буду рад советам',
  'Силовые, прогресс и дисциплина',
]

function initialAge(userAge: number | undefined): number | '' {
  if (typeof userAge === 'number' && userAge >= 18 && userAge <= 80) return userAge
  return ''
}

export function OnboardingPage() {
  const { user, completeOnboarding } = useApp()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [city, setCity] = useState(user?.city || 'Москва')
  const [gymIds, setGymIds] = useState<string[]>(user?.gymIds?.length ? user.gymIds : [])
  const [age, setAge] = useState<number | ''>(() => initialAge(user?.age))
  const [bio, setBio] = useState(user?.bio || '')
  const [intent, setIntent] = useState<Intent | null>(user?.intent || null)
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | null>(
    user?.experienceLevel || null,
  )
  const [interests, setInterests] = useState<string[]>(user?.interests || [])
  const [sports, setSports] = useState<string[]>(user?.sports || [])
  const [isCoach, setIsCoach] = useState(user?.isCoach ?? false)
  const [coachSports, setCoachSports] = useState<string[]>(user?.coachSports || [])
  const [lookingToMeet, setLookingToMeet] = useState(user?.lookingToMeet ?? true)
  const [privacy, setPrivacy] = useState<PrivacyMode>(user?.privacy || 'open')
  const [showOptionalAbout, setShowOptionalAbout] = useState(
    () => Boolean(user?.interests?.length),
  )
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
  const [gymNetwork, setGymNetwork] = useState('Все сети')

  const cityNetworks = useMemo(() => {
    const counts = new Map<string, number>()
    for (const g of GYMS) {
      if (g.city !== city) continue
      counts.set(g.network, (counts.get(g.network) || 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ru'))
      .map(([network, count]) => ({ network, count }))
  }, [city])

  const networkRank = useMemo(() => {
    const rank = new Map<string, number>()
    cityNetworks.forEach((row, i) => rank.set(row.network, i))
    return rank
  }, [cityNetworks])

  const cityGyms = useMemo(() => {
    const q = gymQuery.toLowerCase().trim()
    return GYMS.filter((g) => {
      if (g.city !== city) return false
      if (gymNetwork !== 'Все сети' && g.network !== gymNetwork) return false
      if (!q) return true
      return `${g.name} ${g.network} ${g.address} ${g.district}`.toLowerCase().includes(q)
    }).sort((a, b) => {
      const ar = networkRank.get(a.network) ?? 999
      const br = networkRank.get(b.network) ?? 999
      if (ar !== br) return ar - br
      return a.name.localeCompare(b.name, 'ru')
    })
  }, [city, gymNetwork, gymQuery, networkRank])

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

  // Не даём document/body скроллить страницу целиком — иначе «уедет» нижняя панель
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prevHtml = html.style.overflow
    const prevBody = body.style.overflow
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prevHtml
      body.style.overflow = prevBody
    }
  }, [])

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
  const intentOk = intent !== null
  const experienceOk = experienceLevel !== null

  const aboutMissing = (() => {
    if (step !== 2) return [] as string[]
    const missing: string[] = []
    if (!ageOk) missing.push('возраст')
    if (!intentOk) missing.push('цель')
    if (!experienceOk) missing.push('уровень')
    if (!sports.length) missing.push('активность')
    if (!bioOk) missing.push('о себе')
    if (isCoach && coachSports.length === 0) missing.push('направления тренера')
    return missing
  })()

  const canNext = () => {
    if (step === 0) return Boolean(city)
    if (step === 1) return true // зал необязателен — можно пропустить и добавить позже
    if (step === 2) return aboutMissing.length === 0
    if (step === 3) return visitSlots.length > 0
    return true
  }

  const goBack = () => setStep((s) => Math.max(0, s - 1))
  const goNext = () => setStep((s) => s + 1)

  const applyBioPrompt = (prompt: string) => {
    setBio((prev) => {
      const trimmed = prev.trim()
      if (!trimmed) return prompt
      if (trimmed.includes(prompt)) return trimmed
      return `${trimmed.replace(/[.!?]*$/, '')}. ${prompt}`
    })
  }

  const finish = () => {
    const parsedAge = typeof age === 'number' ? age : Number(age)
    if (!Number.isFinite(parsedAge) || parsedAge < 18 || parsedAge > 80) return
    if (!intent || !experienceLevel) return
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
          <div className="stepper" aria-hidden>
            {steps.map((label, i) => (
              <span key={label} className={i <= step ? 'dot on' : 'dot'} title={label} />
            ))}
          </div>
          <h1 className="page-title">{steps[step]}</h1>
          <p className="muted onboarding-step-lead">
            {step === 1 && gymIds.length
              ? `${STEP_LEADS[1]} · выбрано ${gymIds.length}`
              : STEP_LEADS[step]}
          </p>
        </div>

        <div className={`onboarding-body ${step === 1 ? 'gym-step' : ''}`}>
        {step === 0 && (
          <CityCarousel
            value={city}
            onChange={(next) => {
              setCity(next)
              setGymQuery('')
              setGymNetwork('Все сети')
            }}
            variant="full"
            quickLayout="grid"
            label="Выбранный город"
            hint="Города по числу клубов — от большего к меньшему"
          />
        )}

        {step === 1 && (
          <section className="stack onboarding-gym-step">
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
            {cityNetworks.length ? (
              <div className="filter-row onboarding-networks" role="toolbar" aria-label="Сети">
                <button
                  type="button"
                  className={`chip ${gymNetwork === 'Все сети' ? 'active' : ''}`}
                  onClick={() => setGymNetwork('Все сети')}
                >
                  Все сети
                </button>
                {cityNetworks.map(({ network, count }) => (
                  <button
                    key={network}
                    type="button"
                    className={`chip ${gymNetwork === network ? 'active' : ''}`}
                    onClick={() => setGymNetwork(network)}
                  >
                    {network.replace(' Fitness', '').replace('. Fitness', '')}
                    <span className="chip-count">{count}</span>
                  </button>
                ))}
              </div>
            ) : null}
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
                  <p className="empty-copy-title">
                    {gymQuery.trim() || gymNetwork !== 'Все сети'
                      ? 'Такого клуба пока нет'
                      : 'Пока нет залов в городе'}
                  </p>
                  <p className="empty-copy-lead">
                    {gymQuery.trim() || gymNetwork !== 'Все сети'
                      ? 'Смени фильтр или пропусти шаг — зал добавишь позже в настройках'
                      : 'Смени город или пропусти шаг и добавь зал позже'}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="stack onboarding-form">
            {aboutMissing.length ? (
              <p className="onboarding-missing dim" role="status">
                Осталось: {aboutMissing.join(', ')}
              </p>
            ) : null}

            <div className="field">
              <label htmlFor="age">Возраст *</label>
              <input
                {...ageFieldProps}
                id="age"
                value={age}
                placeholder="Например, 28"
                onChange={(e) => {
                  const next = e.target.value
                  if (next === '') {
                    setAge('')
                    return
                  }
                  const n = Number(next)
                  if (Number.isFinite(n)) setAge(n)
                }}
                required
              />
              <p className="dim onboarding-field-hint">От 18 до 80</p>
            </div>

            <div>
              <p className="field-label">Что ищешь *</p>
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
              <p className="field-label">Уровень в зале *</p>
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
              <p className="field-label">
                Виды активности *{' '}
                <span className="dim">{sports.length ? `· ${sports.length}` : '· выбери хотя бы один'}</span>
              </p>
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

            <div className="field">
              <label htmlFor="bio">О себе *</label>
              <div className="filter-row onboarding-bio-prompts" role="group" aria-label="Быстрые фразы">
                {BIO_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="chip"
                    onClick={() => applyBioPrompt(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              <textarea
                {...bioFieldProps}
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Можно нажать фразу выше или написать своими словами"
                maxLength={BIO_MAX}
              />
              <p className="dim onboarding-field-hint">
                {!bioOk
                  ? `Ещё ${Math.max(0, BIO_MIN - bio.trim().length)} символов до минимума`
                  : `${bio.length}/${BIO_MAX}`}
              </p>
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
                <p className="muted">Метка в карточке и направления</p>
              </div>
              <span className={`toggle ${isCoach ? 'on' : ''}`} />
            </button>
            {isCoach ? (
              <div>
                <p className="field-label">Чему тренирую *</p>
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
              </div>
            ) : null}

            <button
              type="button"
              className="btn btn-soft btn-block onboarding-optional-toggle"
              onClick={() => setShowOptionalAbout((v) => !v)}
              aria-expanded={showOptionalAbout}
            >
              {showOptionalAbout ? 'Скрыть интересы' : 'Интересы — по желанию'}
            </button>

            {showOptionalAbout ? (
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
            ) : null}
          </section>
        )}

        {step === 3 && (
          <section className="stack">
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
          <div
            className={`onboarding-actions-row${step === 0 ? ' is-single' : ''}`}
          >
            {step > 0 ? (
              <button type="button" className="btn btn-soft" onClick={goBack}>
                Назад
              </button>
            ) : null}
            {step < steps.length - 1 ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={!canNext()}
                onClick={goNext}
              >
                {step === 1 && !gymIds.length ? 'Пропустить' : 'Дальше'}
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={finish}>
                В зал
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
