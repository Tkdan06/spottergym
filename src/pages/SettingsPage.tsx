import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ChangePasswordForm } from '../components/ChangePasswordForm'
import { SectionTitle } from '../components/SectionTitle'
import { SubpageHeader } from '../components/SubpageHeader'
import { useApp } from '../context/useApp'
import {
  COACH_DIRECTIONS,
  EXPERIENCE_LEVELS,
  INTERESTS,
  SPORTS,
  displayName,
  getGym,
  getUser,
} from '../data/mock'
import { apiDeleteAccount } from '../lib/apiClient'
import { isDemoAccount } from '../lib/demoAccount'
import { BIO_MAX, INSTAGRAM_MAX, NAME_MAX, NAME_MIN, USERNAME_MAX, USERNAME_MIN } from '../lib/fieldLimits'
import {
  ageFieldProps,
  bioFieldProps,
  displayNameFieldProps,
} from '../lib/inputAttrs'
import { isValidInstagram, normalizeInstagram } from '../lib/instagram'
import { isValidUsername, normalizeUsername } from '../lib/username'
import { activeBreakUntil, todayISO } from '../lib/schedule'
import type { ExperienceLevel, Gender, Intent } from '../types'
import './FeedbackPage.css'
import './SettingsPage.css'

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'female', label: 'Женский' },
  { value: 'male', label: 'Мужской' },
]

export function SettingsPage() {
  const {
    user,
    updateProfile,
    logout,
    blockedUserIds,
    unblockUser,
    directory,
    fetchUserById,
  } = useApp()
  const navigate = useNavigate()
  const [name, setName] = useState(user?.name || '')
  const [username, setUsername] = useState(user?.username || '')
  const [usernameError, setUsernameError] = useState('')
  const [instagram, setInstagram] = useState(user?.instagram || '')
  const [instagramError, setInstagramError] = useState('')
  const [ageError, setAgeError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
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

  const initialBreak = activeBreakUntil(user?.breakUntil)
  const [breakOn, setBreakOn] = useState(Boolean(initialBreak))
  const [breakUntil, setBreakUntil] = useState(initialBreak || '')
  const [blockedPeople, setBlockedPeople] = useState<{ id: string; name: string }[]>([])
  const [deleteStep, setDeleteStep] = useState<'idle' | 'confirm'>('idle')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Sync after catalog join/leave (settings remount or live user update)
  useEffect(() => {
    if (!user) return
    setGymIds(user.gymIds || [])
    setHomeGymId(user.homeGymId || '')
    setCity(user.city || 'Москва')
  }, [user?.gymIds?.join(','), user?.homeGymId, user?.city])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const rows = await Promise.all(
        blockedUserIds.map(async (id) => {
          const fromDir = directory.find((u) => u.id === id)
          if (fromDir) return { id, name: displayName(fromDir) }
          const demo = getUser(id)
          if (demo && isDemoAccount(user?.email)) return { id, name: displayName(demo) }
          try {
            const person = await fetchUserById(id)
            return { id, name: displayName(person) }
          } catch {
            return { id, name: 'Пользователь' }
          }
        }),
      )
      if (!cancelled) setBlockedPeople(rows)
    })()
    return () => {
      cancelled = true
    }
  }, [blockedUserIds, directory, fetchUserById, user?.email])

  const selectedGyms = useMemo(
    () => gymIds.map((id) => getGym(id)).filter(Boolean),
    [gymIds],
  )

  if (!user) return <Navigate to="/login" replace />

  const toggle = (list: string[], value: string, setter: (v: string[]) => void) => {
    setter(list.includes(value) ? list.filter((i) => i !== value) : [...list, value])
  }

  const toggleGym = (id: string) => {
    setGymIds((prev) => {
      if (prev.includes(id) && prev.length <= 1) {
        setSaveError('Нельзя убрать последний зал. Сначала добавь другой.')
        return prev
      }
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      if (!next.includes(homeGymId)) {
        setHomeGymId(next[0] || '')
      }
      setSaveError('')
      return next
    })
  }

  const onSave = (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    const parsedAge = Math.round(typeof age === 'number' ? age : Number(age))
    if (!Number.isFinite(parsedAge) || parsedAge < 18 || parsedAge > 80) {
      setAgeError('Укажи возраст от 18 до 80')
      return
    }
    setAgeError('')

    const nextUsername = normalizeUsername(username)
    if (!isValidUsername(nextUsername)) {
      setUsernameError('Ник: 3–20 символов, латиница, цифры и _')
      return
    }
    setUsernameError('')

    const nextInstagram = normalizeInstagram(instagram)
    if (!isValidInstagram(nextInstagram)) {
      setInstagramError('Instagram: до 30 символов, латиница, цифры, точка и _')
      return
    }
    setInstagramError('')

    if (gymIds.length < 1) {
      setSaveError('Нужен хотя бы один зал')
      return
    }

    const nextBreak =
      breakOn && breakUntil && breakUntil >= todayISO() ? breakUntil : null

    setSaving(true)
    setSaveError('')
    void Promise.resolve(
      updateProfile({
        name: name.trim(),
        username: nextUsername,
        instagram: nextInstagram,
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
        breakUntil: nextBreak,
      }),
    )
      .then(() => {
        navigate('/app/profile')
      })
      .catch((err: unknown) => {
        setSaveError(err instanceof Error ? err.message : 'Не удалось сохранить')
      })
      .finally(() => setSaving(false))
  }

  return (
    <main className="page settings-page">
      <SubpageHeader title="Настройки" onBack={() => navigate('/app/profile')} />

      {isDemoAccount(user.email) ? (
        <p className="demo-local-banner" role="status">
          Демо-аккаунт: изменения и люди в зале локальные. Для проверки продакшена используй
          обычный аккаунт.
        </p>
      ) : null}

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
          <label htmlFor="instagram">Instagram</label>
          <input
            {...displayNameFieldProps}
            id="instagram"
            value={instagram}
            onChange={(e) => {
              setInstagram(e.target.value.replace(/^@+/, ''))
              setInstagramError('')
            }}
            maxLength={INSTAGRAM_MAX + 40}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="username или ссылка"
            inputMode="url"
          />
          {instagramError ? <p className="feedback-error">{instagramError}</p> : null}
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
              setAgeError('')
            }}
            required
          />
          {ageError ? (
            <p className="feedback-error" role="alert">
              {ageError}
            </p>
          ) : null}
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

        <section className="stack settings-gyms">
          <div className="section-title">
            <h2>Мои залы · {selectedGyms.length}</h2>
          </div>
          {selectedGyms.length ? (
            <>
              <div className="chip-grid settings-gym-chips">
                {selectedGyms.map((gym) =>
                  gym ? (
                    <div
                      key={gym.id}
                      className={`settings-gym-chip ${homeGymId === gym.id ? 'is-home' : ''}`}
                    >
                      <button
                        type="button"
                        className="settings-gym-chip-main"
                        onClick={() => setHomeGymId(gym.id)}
                        title="Открывать на главной"
                      >
                        {gym.name}
                        {homeGymId === gym.id ? (
                          <span className="settings-gym-home-tag">главный</span>
                        ) : null}
                      </button>
                      <button
                        type="button"
                        className="settings-gym-chip-remove"
                        aria-label={`Убрать ${gym.name}`}
                        onClick={() => toggleGym(gym.id)}
                      >
                        <X size={14} aria-hidden />
                      </button>
                    </div>
                  ) : null,
                )}
              </div>
            </>
          ) : (
            <p className="muted">
              Зал ещё не выбран. Открой каталог — там город и клубы. Нет в каталоге? Запроси
              добавление зала.
            </p>
          )}
          <Link to="/app/discover?from=settings" className="btn btn-soft btn-block">
            <Plus size={18} aria-hidden /> Добавить зал в каталоге
          </Link>
          {!selectedGyms.length ? (
            <Link to="/app/feedback?topic=gym" className="section-action">
              Запросить добавление зала
            </Link>
          ) : null}
        </section>

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
          <button
            type="button"
            className="toggle-row settings-break-toggle"
            role="switch"
            aria-checked={breakOn}
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

        <section className="settings-panel">
          <button
            type="button"
            className="toggle-row"
            role="switch"
            aria-checked={isCoach}
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
            <div className="settings-coach-fields">
              <p className="field-label">Чему тренирую</p>
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
        </section>

        {saveError ? (
          <p className="feedback-error" role="alert">
            {saveError}
          </p>
        ) : null}
        <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
          {saving ? 'Сохраняем…' : 'Сохранить'}
        </button>
      </form>

      <section className="settings-support">
        <SectionTitle>Поддержка</SectionTitle>
        <Link to="/app/feedback" className="btn btn-ghost btn-block">
          Обратная связь
        </Link>
      </section>

      <ChangePasswordForm />

      <section className="safety surface">
        <SectionTitle>Безопасность</SectionTitle>
        <ul>
          <li>Встречайтесь в публичных зонах зала</li>
          <li>Не передавайте личные данные в первых сообщениях</li>
          <li>
            Заблокировать или пожаловаться можно в профиле человека — меню «⋯» справа
            вверху
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

      <section className="settings-account-end" aria-label="Сессия">
        <button
          type="button"
          className="btn btn-ghost btn-block"
          onClick={() => {
            void (async () => {
              await logout()
              navigate('/login', { replace: true })
            })()
          }}
        >
          Выйти
        </button>
        {deleteStep === 'idle' ? (
          <button
            type="button"
            className="settings-delete-trigger"
            onClick={() => {
              setDeleteError('')
              setDeleteStep('confirm')
            }}
          >
            Удалить аккаунт
          </button>
        ) : (
          <div className="settings-delete-confirm">
            <p className="muted">
              Переписка останется как «Удалённый пользователь». Это необратимо.
            </p>
            {deleteError ? (
              <p className="feedback-error" role="alert">
                {deleteError}
              </p>
            ) : null}
            <button
              type="button"
              className="btn btn-danger btn-sm btn-block"
              disabled={deleteBusy}
              onClick={() => {
                setDeleteBusy(true)
                setDeleteError('')
                void apiDeleteAccount()
                  .then(async () => {
                    await logout()
                    navigate('/', { replace: true })
                  })
                  .catch((err: unknown) => {
                    setDeleteError(err instanceof Error ? err.message : 'Не удалось удалить')
                  })
                  .finally(() => setDeleteBusy(false))
              }}
            >
              {deleteBusy ? 'Удаляем…' : 'Удалить навсегда'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-block"
              disabled={deleteBusy}
              onClick={() => setDeleteStep('idle')}
            >
              Отмена
            </button>
          </div>
        )}
      </section>
    </main>
  )
}
