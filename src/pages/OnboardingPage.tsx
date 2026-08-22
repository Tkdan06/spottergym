import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { CityCarousel } from '../components/CityCarousel'
import { ElsewhereGymBanner } from '../components/ElsewhereGymBanner'
import { GymCard } from '../components/GymCard'
import { ScheduleEditor, sortVisitSlots } from '../components/ScheduleEditor'
import { useApp } from '../context/useApp'
import { EXPERIENCE_LEVELS, GYMS, SPORTS } from '../data/mock'
import { apiFetchGyms } from '../lib/apiClient'
import { isDemoAccount } from '../lib/demoAccount'
import {
  buildElsewhereSuggestions,
  ELSEWHERE_QUERY_MIN,
  searchElsewhereLocal,
  type ElsewhereSuggestion,
} from '../lib/elsewhereGyms'
import { BIO_MAX, BIO_MIN } from '../lib/fieldLimits'
import { gymMatchesQuery } from '../lib/gymSearch'
import { buildRealGymStatsMap } from '../lib/gymStats'
import { ageFieldProps, bioFieldProps, searchFieldProps } from '../lib/inputAttrs'
import {
  clearOnboardingDraft,
  loadOnboardingDraft,
  saveOnboardingDraft,
} from '../lib/onboardingDraft'
import type { ExperienceLevel, Gym, Intent, PrivacyMode, VisitSlot } from '../types'
import './OnboardingPage.css'

const steps = ['Город', 'Зал', 'О себе', 'Расписание', 'Приватность'] as const

const STEP_LEADS = [
  'Выбери свой город',
  'Выбери свой клуб из списка или нажми «Пропустить» и добавь позже',
  'Коротко о себе — так проще найти людей в своём клубе',
  'Когда обычно в зале — для каждого дня можно своё время',
  'Как тебя видят другие и открыт ли ты к знакомству',
] as const

/** Короче список — полное редактирование в настройках */
const ONBOARDING_SPORTS = SPORTS.filter((s) =>
  [
    'Тренажёрный зал',
    'Силовые',
    'Функционал',
    'Кроссфит',
    'Hyrox',
    'Бег',
    'Йога',
    'Бокс / единоборства',
    'Групповые тренировки',
  ].includes(s),
)

const BIO_PROMPTS = [
  'Ищу компанию для тренировок',
  'Открыт к знакомствам в зале',
  'Новичок — буду рад советам',
]

const DEFAULT_SLOTS: VisitSlot[] = [
  { day: 'Пн', from: '19:00', to: '21:00' },
  { day: 'Ср', from: '19:00', to: '21:00' },
  { day: 'Пт', from: '19:00', to: '21:00' },
]

function initialAge(userAge: number | undefined): number | '' {
  if (typeof userAge === 'number' && userAge >= 18 && userAge <= 80) return userAge
  return ''
}

export function OnboardingPage() {
  const { user, completeOnboarding, apiOnline } = useApp()
  const draft = user ? loadOnboardingDraft(user.id) : null

  const [step, setStep] = useState(draft?.step ?? 0)
  const [city, setCity] = useState(draft?.city || user?.city || 'Москва')
  const [gymIds, setGymIds] = useState<string[]>(
    draft?.gymIds?.length ? draft.gymIds : user?.gymIds?.length ? user.gymIds : [],
  )
  const [age, setAge] = useState<number | ''>(() => draft?.age ?? initialAge(user?.age))
  const [bio, setBio] = useState(draft?.bio || user?.bio || '')
  const [intent, setIntent] = useState<Intent | null>(draft?.intent ?? user?.intent ?? null)
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | null>(
    draft?.experienceLevel ?? user?.experienceLevel ?? null,
  )
  const [sports, setSports] = useState<string[]>(draft?.sports?.length ? draft.sports : user?.sports || [])
  const [lookingToMeet, setLookingToMeet] = useState(true)
  const [privacy, setPrivacy] = useState<PrivacyMode>(draft?.privacy || user?.privacy || 'open')
  const [visitSlots, setVisitSlots] = useState<VisitSlot[]>(() =>
    sortVisitSlots(
      draft?.visitSlots?.length
        ? draft.visitSlots
        : user?.visitSlots?.length
          ? user.visitSlots
          : DEFAULT_SLOTS,
    ),
  )
  const [gymQuery, setGymQuery] = useState(draft?.gymQuery || '')
  const [gymNetwork, setGymNetwork] = useState(draft?.gymNetwork || 'Все сети')
  const [remoteGyms, setRemoteGyms] = useState<Gym[] | null>(null)
  const [elsewhereRemote, setElsewhereRemote] = useState<Gym[] | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState('')

  const demoStats = isDemoAccount(user?.email)

  // Keep first paint at the top — focus/keyboard from city sheet must not leave the page scrolled
  useEffect(() => {
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
    const body = document.querySelector('.onboarding-body')
    if (body instanceof HTMLElement) body.scrollTop = 0
  }, [step])

  useEffect(() => {
    if (!user || user.onboardingDone) return
    saveOnboardingDraft({
      userId: user.id,
      step,
      city,
      gymIds,
      age,
      bio,
      intent,
      experienceLevel,
      sports,
      lookingToMeet,
      privacy,
      visitSlots,
      gymQuery,
      gymNetwork,
    })
  }, [
    user,
    step,
    city,
    gymIds,
    age,
    bio,
    intent,
    experienceLevel,
    sports,
    lookingToMeet,
    privacy,
    visitSlots,
    gymQuery,
    gymNetwork,
  ])

  useEffect(() => {
    if (step !== 1) return
    if (!apiOnline || demoStats) {
      setRemoteGyms(null)
      return
    }
    let cancelled = false
    // Полный каталог города — сети/поиск фильтруем на клиенте, чтобы чипы не схлопывались
    void apiFetchGyms({ city })
      .then((list) => {
        if (!cancelled) setRemoteGyms(list)
      })
      .catch(() => {
        if (!cancelled) setRemoteGyms(null)
      })
    return () => {
      cancelled = true
    }
  }, [apiOnline, demoStats, city, step])

  const cityCatalog = useMemo(() => {
    if (remoteGyms) return remoteGyms.filter((g) => g.city === city)
    return GYMS.filter((g) => g.city === city)
  }, [city, remoteGyms])

  const cityNetworks = useMemo(() => {
    const counts = new Map<string, number>()
    for (const g of cityCatalog) {
      counts.set(g.network, (counts.get(g.network) || 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ru'))
      .map(([network, count]) => ({ network, count }))
  }, [cityCatalog])

  const networkRank = useMemo(() => {
    const rank = new Map<string, number>()
    cityNetworks.forEach((row, i) => rank.set(row.network, i))
    return rank
  }, [cityNetworks])

  const cityGyms = useMemo(() => {
    const q = gymQuery.trim()
    return cityCatalog
      .filter((g) => {
        if (gymNetwork !== 'Все сети' && g.network !== gymNetwork) return false
        return gymMatchesQuery(g, q)
      })
      .sort((a, b) => {
        const ar = networkRank.get(a.network) ?? 999
        const br = networkRank.get(b.network) ?? 999
        if (ar !== br) return ar - br
        return a.name.localeCompare(b.name, 'ru')
      })
  }, [cityCatalog, gymNetwork, gymQuery, networkRank])

  const liveStats = useMemo(() => {
    if (!user || demoStats) return {}
    if (remoteGyms) {
      const map: Record<string, { membersCount: number; activeNow: number }> = {}
      for (const g of cityGyms) {
        map[g.id] = { membersCount: g.membersCount, activeNow: g.activeNow }
      }
      return map
    }
    return buildRealGymStatsMap(
      cityGyms.map((g) => g.id),
      { ...user, gymIds },
    )
  }, [user, demoStats, remoteGyms, cityGyms, gymIds])

  const elsewhereQuery = gymQuery.trim()
  const needElsewhere =
    step === 1 && cityGyms.length === 0 && elsewhereQuery.length >= ELSEWHERE_QUERY_MIN

  useEffect(() => {
    if (!needElsewhere) {
      setElsewhereRemote(null)
      return
    }
    if (!apiOnline || demoStats) {
      setElsewhereRemote(null)
      return
    }
    let cancelled = false
    void apiFetchGyms({
      q: elsewhereQuery,
      elsewhere: true,
      excludeCity: city,
    })
      .then((list) => {
        if (!cancelled) setElsewhereRemote(list)
      })
      .catch(() => {
        if (!cancelled) setElsewhereRemote(null)
      })
    return () => {
      cancelled = true
    }
  }, [needElsewhere, apiOnline, demoStats, elsewhereQuery, city])

  const elsewhereSuggestions: ElsewhereSuggestion[] = useMemo(() => {
    if (!needElsewhere) return []
    const source =
      apiOnline && !demoStats && elsewhereRemote
        ? elsewhereRemote
        : searchElsewhereLocal(elsewhereQuery, city)
    return buildElsewhereSuggestions(source)
  }, [needElsewhere, apiOnline, demoStats, elsewhereRemote, elsewhereQuery, city])

  useEffect(() => {
    if (user?.onboardingDone) clearOnboardingDraft()
  }, [user?.onboardingDone])

  useEffect(() => {
    if (!user || user.onboardingDone) return
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
  }, [user, user?.onboardingDone])

  if (!user) return <Navigate to="/login" replace />
  // Не return null — иначе пустой фон (Safari) пока navigate не сработает
  if (user.onboardingDone) return <Navigate to="/app" replace />

  const toggle = (list: string[], value: string, setter: (v: string[]) => void) => {
    setter(list.includes(value) ? list.filter((i) => i !== value) : [...list, value])
  }

  const bioOk = bio.trim().length >= BIO_MIN
  const ageOk = (() => {
    const parsedAge = typeof age === 'number' ? age : Number(age)
    return Number.isFinite(parsedAge) && parsedAge >= 18 && parsedAge <= 80
  })()

  const canNext = () => {
    if (step === 0) return Boolean(city)
    if (step === 1) return true
    if (step === 2) {
      return ageOk && intent !== null && experienceLevel !== null && sports.length > 0 && bioOk
    }
    if (step === 3) return visitSlots.length > 0
    return true
  }

  const goBack = () => {
    setFinishError('')
    setStep((s) => Math.max(0, s - 1))
  }
  const goNext = () => {
    setFinishError('')
    setStep((s) => s + 1)
  }

  const changeCity = (next: string) => {
    if (next === city) return
    setCity(next)
    setGymIds([])
    setGymQuery('')
    setGymNetwork('Все сети')
  }

  /** Смена города из поисковой подсказки — запрос оставляем */
  const switchCityFromSearch = (next: string) => {
    if (next === city) return
    setCity(next)
    setGymIds([])
    setGymNetwork('Все сети')
  }

  const applyBioPrompt = (prompt: string) => {
    setBio((prev) => {
      const trimmed = prev.trim()
      if (!trimmed) return prompt
      if (trimmed.includes(prompt)) return trimmed
      return `${trimmed.replace(/[.!?]*$/, '')}. ${prompt}`
    })
  }

  const resetOnboardingForm = () => {
    setFinishError('')
    setFinishing(false)
    setStep(0)
    setCity(user.city || 'Москва')
    setGymIds([])
    setAge(initialAge(user.age))
    setBio('')
    setIntent(null)
    setExperienceLevel(null)
    setSports([])
    setLookingToMeet(true)
    setPrivacy('open')
    setVisitSlots(sortVisitSlots(DEFAULT_SLOTS))
    setGymQuery('')
    setGymNetwork('Все сети')
    clearOnboardingDraft()
  }

  const finish = async () => {
    const parsedAge = typeof age === 'number' ? age : Number(age)
    if (!Number.isFinite(parsedAge) || parsedAge < 18 || parsedAge > 80) return
    if (!intent || !experienceLevel) return
    setFinishError('')
    setFinishing(true)
    try {
      const result = await completeOnboarding({
        city,
        gymIds,
        homeGymId: gymIds[0] || '',
        age: parsedAge,
        bio: bio.trim(),
        intent,
        experienceLevel,
        interests: [],
        sports,
        isCoach: false,
        coachSports: [],
        lookingToMeet,
        privacy,
        visitSlots: sortVisitSlots(visitSlots),
        photos: [],
      })
      if (result && result.ok === false) {
        setFinishError(result.error)
        setFinishing(false)
        return
      }
      clearOnboardingDraft()
    } catch {
      setFinishError('Не удалось сохранить данные. Проверь интернет и начни заново')
      setFinishing(false)
    }
  }

  return (
    <div className="app-shell">
      <main className="page no-nav onboarding">
        <div className="onboarding-top">
          <p className="brand-mark onboarding-brand">
            SPOT<span>TER</span>
          </p>
          <div
            className="stepper"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={steps.length}
            aria-valuenow={step + 1}
            aria-label={`Шаг ${step + 1} из ${steps.length}: ${steps[step]}`}
          >
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
              onChange={changeCity}
              variant="full"
              label="Выбранный город"
              hint="Выбери свой город"
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
              <div className="card-list card-list--cards gym-pick-list">
                {elsewhereSuggestions.length ? (
                  <ElsewhereGymBanner
                    suggestions={elsewhereSuggestions}
                    onSwitchCity={switchCityFromSearch}
                  />
                ) : null}
                {cityGyms.length ? (
                  cityGyms.map((gym, index) => (
                    <GymCard
                      key={gym.id}
                      gym={gym}
                      selected={gymIds.includes(gym.id)}
                      showDemoStats={demoStats}
                      membersCount={liveStats[gym.id]?.membersCount}
                      activeNow={liveStats[gym.id]?.activeNow}
                      priority={index < 4}
                      onSelect={() => toggle(gymIds, gym.id, setGymIds)}
                    />
                  ))
                ) : (
                  <div className="empty-copy" role="status">
                    <p className="empty-copy-title">
                      {elsewhereSuggestions.length
                        ? 'В этом городе такого клуба нет'
                        : gymQuery.trim() || gymNetwork !== 'Все сети'
                          ? 'Такого клуба пока нет'
                          : 'Пока нет залов в городе'}
                    </p>
                    <p className="empty-copy-lead">
                      {elsewhereSuggestions.length
                        ? 'Смени город по подсказке выше — или пропусти шаг'
                        : gymQuery.trim() || gymNetwork !== 'Все сети'
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
                <p className="field-label">Виды активности *</p>
                <div className="chip-grid">
                  {ONBOARDING_SPORTS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`chip ${sports.includes(s) ? 'active' : ''}`}
                      onClick={() => toggle(sports, s, setSports)}
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
                <p className="muted">Имя, фото и статус видны другим в зале</p>
              </button>
              <button
                type="button"
                className={`privacy-card ${privacy === 'anonymous' ? 'active' : ''}`}
                onClick={() => setPrivacy('anonymous')}
              >
                <h3>Анонимный режим</h3>
                <p className="muted">
                  Вместо фото будет нейтральная картинка — открыться можно позже в профиле
                </p>
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
          {finishError ? (
            <div className="onboarding-finish-error" role="alert">
              <p>{finishError}</p>
              <button type="button" className="btn btn-soft btn-block" onClick={resetOnboardingForm}>
                Начать заново
              </button>
            </div>
          ) : null}
          <div className={`onboarding-actions-row${step === 0 ? ' is-single' : ''}`}>
            {step > 0 ? (
              <button
                type="button"
                className="btn btn-soft"
                onClick={goBack}
                disabled={finishing}
              >
                Назад
              </button>
            ) : null}
            {step < steps.length - 1 ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={!canNext() || finishing}
                onClick={goNext}
              >
                {step === 1 && !gymIds.length ? 'Пропустить' : 'Дальше'}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled={finishing}
                onClick={() => void finish()}
              >
                {finishing ? 'Сохраняем…' : 'В зал'}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
