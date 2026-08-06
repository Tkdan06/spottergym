import { type FormEvent, useMemo, useState } from 'react'
import { ArrowLeft, Search, Share2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { CityCarousel } from '../components/CityCarousel'
import { GymCard } from '../components/GymCard'
import { InviteFriendsButton } from '../components/InviteFriendsButton'
import { SectionTitle } from '../components/SectionTitle'
import { useApp } from '../context/useApp'
import {
  COACH_DIRECTIONS,
  EXPERIENCE_LEVELS,
  GYMS,
  INTERESTS,
  SPORTS,
  getGym,
  getUser,
} from '../data/mock'
import { isDemoAccount } from '../lib/demoAccount'
import { gymMatchesQuery } from '../lib/gymSearch'
import { buildRealGymStatsMap } from '../lib/gymStats'
import { BIO_MAX, NAME_MAX, NAME_MIN, USERNAME_MAX, USERNAME_MIN } from '../lib/fieldLimits'
import {
  ageFieldProps,
  bioFieldProps,
  displayNameFieldProps,
  searchFieldProps,
} from '../lib/inputAttrs'
import { isValidUsername, normalizeUsername } from '../lib/username'
import { activeBreakUntil, todayISO } from '../lib/schedule'
import type { ExperienceLevel, Gender, Intent, VisitSlot } from '../types'
import { ScheduleEditor, sortVisitSlots } from '../components/ScheduleEditor'
import './SettingsPage.css'

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'female', label: 'Женский' },
  { value: 'male', label: 'Мужской' },
]

export function SettingsPage() {
  const { user, updateProfile, logout, blockedUserIds, unblockUser } = useApp()
  const navigate = useNavigate()
  const [name, setName] = useState(user?.name || '')
  const [username, setUsername] = useState(user?.username || '')
  const [usernameError, setUsernameError] = useState('')
  const [age, setAge] = useState<number | ''>(user?.age || 25)
  const [gender, setGender] = useState<Gender>(
    user?.gender === 'female' || user?.gender === 'male' ? user.gender : 'male',
  )
  const [bio, setBio] = useState(user?.bio || '')
  const [intent, setIntent] = useState<Intent>(user?.intent || 'both')
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(
    user?.experienceLevel || 'confident',
  )
  const [city, setCity] = useState(user?.city || 'Москва')
  const [gymIds, setGymIds] = useState<string[]>(user?.gymIds || [])
  const [homeGymId, setHomeGymId] = useState(user?.homeGymId || '')
  const [sports, setSports] = useState<string[]>(user?.sports || [])
  const [isCoach, setIsCoach] = useState(user?.isCoach ?? false)
  const [coachSports, setCoachSports] = useState<string[]>(user?.coachSports || [])
  const [interests, setInterests] = useState<string[]>(user?.interests || [])
  const [gymQuery, setGymQuery] = useState('')
  const [visitSlots, setVisitSlots] = useState<VisitSlot[]>(() =>
    sortVisitSlots(user?.visitSlots || []),
  )

  const initialBreak = activeBreakUntil(user?.breakUntil)
  const [breakOn, setBreakOn] = useState(Boolean(initialBreak))
  const [breakUntil, setBreakUntil] = useState(initialBreak || '')

  const cityGyms = useMemo(() => {
    const q = gymQuery.trim()
    return GYMS.filter((g) => {
      if (g.city !== city) return false
      return gymMatchesQuery(g, q)
    }).sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  }, [city, gymQuery])

  const selectedGyms = useMemo(
    () => gymIds.map((id) => getGym(id)).filter(Boolean),
    [gymIds],
  )

  const demoStats = isDemoAccount(user?.email)
  const liveStats = useMemo(() => {
    if (!user || demoStats) return {}
    // Черновик выбранных залов — чтобы счётчик обновлялся до «Сохранить»
    return buildRealGymStatsMap(
      cityGyms.slice(0, 40).map((g) => g.id),
      { ...user, gymIds },
    )
  }, [user, demoStats, cityGyms, gymIds])

  const blockedPeople = useMemo(() => {
    if (!isDemoAccount(user?.email)) return []
    return blockedUserIds
      .map((id) => getUser(id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
  }, [blockedUserIds, user?.email])

  if (!user) return null

  const toggle = (list: string[], value: string, setter: (v: string[]) => void) => {
    setter(list.includes(value) ? list.filter((i) => i !== value) : [...list, value])
  }

  const toggleGym = (id: string) => {
    setGymIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      if (!next.includes(homeGymId)) {
        setHomeGymId(next[0] || '')
      }
      return next
    })
  }

  const onSave = (e: FormEvent) => {
    e.preventDefault()
    const parsedAge = typeof age === 'number' ? age : Number(age)
    if (!Number.isFinite(parsedAge) || parsedAge < 18 || parsedAge > 80) return

    const nextUsername = normalizeUsername(username)
    if (!isValidUsername(nextUsername)) {
      setUsernameError('Ник: 3–20 символов, латиница, цифры и _')
      return
    }
    setUsernameError('')

    const nextBreak =
      breakOn && breakUntil && breakUntil >= todayISO() ? breakUntil : null

    updateProfile({
      name: name.trim(),
      username: nextUsername,
      age: parsedAge,
      gender,
      bio: bio.trim(),
      intent,
      experienceLevel,
      gymIds,
      homeGymId: gymIds.includes(homeGymId) ? homeGymId : gymIds[0] || '',
      sports,
      isCoach,
      coachSports: isCoach ? coachSports : [],
      interests,
      city,
      visitSlots: sortVisitSlots(visitSlots),
      breakUntil: nextBreak,
      ...(nextBreak && user.isActive
        ? {
            isActive: false,
            checkedInGymId: '',
            checkedInAt: '',
            checkedInExpiresAt: '',
            checkInExtendCount: 0,
            checkInCanExtend: false,
          }
        : {}),
    })
    navigate('/app/profile')
  }

  return (
    <main className="page settings-page">
      <button type="button" className="back-link" onClick={() => navigate('/app/profile')}>
        <ArrowLeft size={18} /> Профиль
      </button>
      <h1>Настройки</h1>
      <p className="muted">Редактируй профиль и список своих залов.</p>

      <form className="settings-form" onSubmit={onSave}>
        <div className="field">
          <label htmlFor="name">Имя</label>
          <input
            {...displayNameFieldProps}
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={NAME_MIN}
            maxLength={NAME_MAX}
          />
        </div>
        <div className="field">
          <label htmlFor="username">@ник</label>
          <input
            {...displayNameFieldProps}
            id="username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value.replace(/^@+/, '').toLowerCase())
              setUsernameError('')
            }}
            required
            minLength={USERNAME_MIN}
            maxLength={USERNAME_MAX}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="masha_ddx"
          />
          {usernameError ? <p className="feedback-error">{usernameError}</p> : null}
        </div>
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
          <p className="field-label">Пол</p>
          <div className="chip-grid">
            {GENDERS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`chip ${gender === option.value ? 'active' : ''}`}
                onClick={() => setGender(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="bio">О себе</label>
          <textarea
            {...bioFieldProps}
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={BIO_MAX}
          />
          <p className="dim settings-panel-hint">
            {bio.length}/{BIO_MAX}
          </p>
        </div>

        <section className="stack">
          <div className="section-title">
            <h2>Мои залы · {selectedGyms.length}</h2>
            <Link to="/app/discover" className="muted">
              Каталог
            </Link>
          </div>
          {selectedGyms.length ? (
            <div className="chip-grid">
              {selectedGyms.map((gym) =>
                gym ? (
                  <button
                    key={gym.id}
                    type="button"
                    className={`chip ${homeGymId === gym.id ? 'active' : ''}`}
                    onClick={() => setHomeGymId(gym.id)}
                    title="Сделать основным на главной"
                  >
                    {gym.name}
                  </button>
                ) : null,
              )}
            </div>
          ) : (
            <p className="muted">
              Зал ещё не выбран — добавь из списка ниже. Нет в каталоге? Напиши в обратную связь.
            </p>
          )}
          <p className="dim" style={{ fontSize: '0.82rem' }}>
            Нажми на зал выше, чтобы открывать его на главной. Ниже можно добавить ещё.
          </p>
        </section>

        <CityCarousel
          value={city}
          onChange={(next) => {
            setCity(next)
            setGymQuery('')
          }}
          label="Добавить залы из города"
          hint="Можно состоять сразу в нескольких клубах"
          afterStrip={
            <label className="app-search">
              <Search size={16} aria-hidden />
              <input
                {...searchFieldProps}
                placeholder="Клуб, район или адрес"
                value={gymQuery}
                onChange={(e) => setGymQuery(e.target.value)}
                aria-label="Поиск клуба в городе"
              />
            </label>
          }
        />

        <div className="card-list settings-gym-list">
          {cityGyms.slice(0, 40).map((gym) => (
            <GymCard
              key={gym.id}
              gym={gym}
              selected={gymIds.includes(gym.id)}
              showDemoStats={demoStats}
              membersCount={liveStats[gym.id]?.membersCount}
              activeNow={liveStats[gym.id]?.activeNow}
              onSelect={() => toggleGym(gym.id)}
            />
          ))}
        </div>

        <div>
          <p className="field-label">Намерение</p>
          <div className="chip-grid">
            {(
              [
                ['dating', 'Знакомства'],
                ['buddy', 'Партнёр'],
                ['both', 'Оба'],
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
            Как себя чувствуешь в зале
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
          <p className="field-label">Активности</p>
          <div className="chip-grid">
            {SPORTS.map((s) => (
              <button
                key={s}
                type="button"
                className={`chip ${sports.includes(s) ? 'active' : ''}`}
                onClick={() => {
                  toggle(sports, s, setSports)
                  if (sports.includes(s)) {
                    setCoachSports((prev) => prev.filter((x) => x !== s))
                  }
                }}
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
            <p className="muted">Метка на карточке и фильтр «Тренеры» в зале</p>
          </div>
          <span className={`toggle ${isCoach ? 'on' : ''}`} />
        </button>

        {isCoach ? (
          <div>
            <p className="field-label">Чему тренирую</p>
            <p className="muted" style={{ marginBottom: 8 }}>
              Групповые, персональные и другие направления
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

        <section className="settings-panel">
          <div className="settings-panel-head">
            <h2>Расписание</h2>
            <p className="muted">Для каждого дня — своё время</p>
          </div>
          <ScheduleEditor value={visitSlots} onChange={setVisitSlots} idPrefix="settings" />
        </section>

        <section className="settings-panel">
          <button
            type="button"
            className="toggle-row settings-break-toggle"
            onClick={() => {
              setBreakOn((v) => {
                if (v) {
                  setBreakUntil('')
                  return false
                }
                if (!breakUntil) {
                  const d = new Date()
                  d.setDate(d.getDate() + 7)
                  setBreakUntil(d.toISOString().slice(0, 10))
                }
                return true
              })
            }}
          >
            <div>
              <strong>Перерыв / отпуск</strong>
              <p className="muted">В профиле будет видно, что ты не ходишь в зал</p>
            </div>
            <span className={`toggle ${breakOn ? 'on' : ''}`} />
          </button>
          {breakOn ? (
            <div className="settings-break-fields">
              <div className="field">
                <label htmlFor="breakUntil">До какой даты</label>
                <div className="settings-date-wrap">
                  <input
                    id="breakUntil"
                    type="date"
                    min={todayISO()}
                    value={breakUntil}
                    onChange={(e) => setBreakUntil(e.target.value)}
                    required={breakOn}
                  />
                </div>
              </div>
              <p className="dim settings-panel-hint">
                Статус снимется сам после этой даты — или выключи переключатель, когда вернёшься.
              </p>
            </div>
          ) : null}
        </section>

        <button type="submit" className="btn btn-primary btn-block">
          Сохранить
        </button>
      </form>

      <div className="settings-links">
        {user ? (
          <InviteFriendsButton userId={user.id} className="btn btn-ghost btn-block">
            <Share2 size={16} /> Пригласить друзей
          </InviteFriendsButton>
        ) : null}
        <Link to="/app/feedback" className="btn btn-ghost btn-block">
          Обратная связь
        </Link>
        <Link to="/app/notifications" className="btn btn-ghost btn-block">
          Уведомления
        </Link>
      </div>

      <section className="safety surface">
        <SectionTitle>Безопасность</SectionTitle>
        <ul>
          <li>Встречайтесь в публичных зонах зала</li>
          <li>Не передавайте личные данные в первых сообщениях</li>
          <li>
            Заблокировать или пожаловаться можно в профиле человека — кнопки внизу карточки
          </li>
        </ul>
        {blockedUserIds.length ? (
          <div className="blocked-list">
            <p className="field-label">Чёрный список · {blockedUserIds.length}</p>
            {blockedPeople.map((person) => (
              <div key={person.id} className="blocked-row">
                <span>{person.name}</span>
                <button type="button" className="text-btn" onClick={() => void unblockUser(person.id)}>
                  Разблокировать
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="dim blocked-empty">Пока никого не блокировал</p>
        )}
      </section>

      <button
        type="button"
        className="btn btn-danger btn-block"
        onClick={() => {
          void logout()
          navigate('/')
        }}
      >
        Выйти
      </button>
    </main>
  )
}
