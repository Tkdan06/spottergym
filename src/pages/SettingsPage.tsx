import { type FormEvent, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { CityCarousel } from '../components/CityCarousel'
import { GymCard } from '../components/GymCard'
import { useApp } from '../context/useApp'
import { EXPERIENCE_LEVELS, GYMS, INTERESTS, SPORTS, getGym } from '../data/mock'
import type { ExperienceLevel, Gender, Intent } from '../types'
import './SettingsPage.css'

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'female', label: 'Женский' },
  { value: 'male', label: 'Мужской' },
]

export function SettingsPage() {
  const { user, updateProfile, logout } = useApp()
  const navigate = useNavigate()
  const [name, setName] = useState(user?.name || '')
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

  const cityGyms = useMemo(() => {
    const q = gymQuery.toLowerCase().trim()
    return GYMS.filter((g) => {
      if (g.city !== city) return false
      if (!q) return true
      return `${g.name} ${g.network} ${g.address}`.toLowerCase().includes(q)
    }).sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  }, [city, gymQuery])

  const selectedGyms = useMemo(
    () => gymIds.map((id) => getGym(id)).filter(Boolean),
    [gymIds],
  )

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
    if (!gymIds.length) return
    const parsedAge = typeof age === 'number' ? age : Number(age)
    if (!Number.isFinite(parsedAge) || parsedAge < 18 || parsedAge > 80) return
    updateProfile({
      name: name.trim(),
      age: parsedAge,
      gender,
      bio: bio.trim(),
      intent,
      experienceLevel,
      gymIds,
      homeGymId: gymIds.includes(homeGymId) ? homeGymId : gymIds[0],
      sports,
      isCoach,
      coachSports: isCoach ? coachSports.filter((s) => sports.includes(s)) : [],
      interests,
      city,
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
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
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
          <textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} />
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
            <p className="muted">Пока нет выбранных залов</p>
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
            <input
              className="search-input"
              placeholder="Поиск клуба в городе"
              value={gymQuery}
              onChange={(e) => setGymQuery(e.target.value)}
            />
          }
        />

        <div className="card-list settings-gym-list">
          {cityGyms.slice(0, 40).map((gym) => (
            <GymCard
              key={gym.id}
              gym={gym}
              selected={gymIds.includes(gym.id)}
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
              else if (!coachSports.length && sports.length) {
                setCoachSports(sports.slice(0, 2))
              }
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
            <p className="field-label">Тренирую</p>
            <div className="chip-grid">
              {(sports.length ? sports : SPORTS).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`chip ${coachSports.includes(s) ? 'coach' : ''}`}
                  onClick={() => {
                    if (!sports.includes(s)) setSports((prev) => [...prev, s])
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

        <button type="submit" className="btn btn-primary btn-block" disabled={!gymIds.length}>
          Сохранить
        </button>
      </form>

      <Link to="/app/feedback" className="btn btn-ghost btn-block">
        Обратная связь
      </Link>
      <Link to="/app/notifications" className="btn btn-ghost btn-block">
        Уведомления
      </Link>

      <section className="safety surface">
        <h2>Безопасность</h2>
        <ul>
          <li>Встречайтесь в публичных зонах зала</li>
          <li>Не передавайте личные данные в первых сообщениях</li>
          <li>Блокировка и жалоба доступны в полной версии продукта</li>
        </ul>
      </section>

      <button
        type="button"
        className="btn btn-danger btn-block"
        onClick={() => {
          logout()
          navigate('/')
        }}
      >
        Выйти
      </button>
    </main>
  )
}
