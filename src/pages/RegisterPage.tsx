import { type FormEvent, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../context/useApp'
import {
  EMAIL_MAX,
  NAME_MAX,
  NAME_MIN,
  PASSWORD_MAX,
  PASSWORD_MIN,
} from '../lib/fieldLimits'
import { displayNameFieldProps } from '../lib/inputAttrs'
import { persistInviteFrom } from '../lib/inviteShare'
import { trackLanding } from '../lib/landingTrack'
import { captureMarketingParams, captureSearchTouch } from '../lib/utm'
import { consumeTermsAcceptedFlag } from '../lib/termsAcceptance'
import type { Gender } from '../types'
import './AuthPages.css'

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
]

type RegisterLocationState = {
  termsAccepted?: boolean
}

export function RegisterPage() {
  const { register } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [gender, setGender] = useState<Gender | null>(null)
  const [ageOk, setAgeOk] = useState(false)
  const [termsOk, setTermsOk] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    persistInviteFrom(searchParams.get('invite'))
    captureMarketingParams(location.search)
    captureSearchTouch()
    trackLanding('register_view', { path: '/register' })
  }, [searchParams, location.search])

  useEffect(() => {
    const state = location.state as RegisterLocationState | null
    if (state?.termsAccepted || consumeTermsAcceptedFlag()) {
      setTermsOk(true)
      navigate(location.pathname + location.search, { replace: true, state: null })
    }
  }, [location.pathname, location.search, location.state, navigate])

  const canSubmit = Boolean(ageOk && termsOk && gender)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit || !gender) return
    setError('')
    try {
      await register(name.trim(), email, password, gender)
      trackLanding('register_success', { path: '/register' })
      navigate('/onboarding')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось зарегистрироваться')
    }
  }

  return (
    <div className="app-shell">
      <main className="page no-nav auth-page">
        <Link to="/" className="brand-mark auth-brand">
          SPOT<span>TER</span>
        </Link>
        <h1>Регистрация</h1>
        <p className="muted">Создай аккаунт — дальше выберешь свой зал</p>

        <form className="auth-form" onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="name" className="sr-only">
              Имя
            </label>
            <input
              {...displayNameFieldProps}
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={NAME_MIN}
              maxLength={NAME_MAX}
              placeholder="Имя"
              aria-label="Имя"
            />
          </div>
          <div className="field">
            <span className="field-label" id="gender-label">
              Пол
            </span>
            <div className="chip-grid" role="group" aria-labelledby="gender-label">
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
            <label htmlFor="email" className="sr-only">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={EMAIL_MAX}
              placeholder="Email"
              aria-label="Email"
            />
          </div>
          <div className="field">
            <label htmlFor="password" className="sr-only">
              Пароль
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={PASSWORD_MIN}
              maxLength={PASSWORD_MAX}
              placeholder="Пароль"
              aria-label="Пароль"
            />
          </div>

          <label className="age-check">
            <input type="checkbox" checked={ageOk} onChange={(e) => setAgeOk(e.target.checked)} />
            <span>Мне есть 18 лет. Я понимаю правила безопасного общения</span>
          </label>

          <label className="age-check terms-check">
            <input
              type="checkbox"
              checked={termsOk}
              onChange={(e) => setTermsOk(e.target.checked)}
            />
            <span>
              Я принимаю{' '}
              <Link
                to="/terms?from=register"
                className="terms-inline-link"
                onClick={(e) => e.stopPropagation()}
              >
                Пользовательское соглашение
              </Link>{' '}
              и даю согласие на обработку персональных данных
            </span>
          </label>

          {error ? <p className="feedback-error">{error}</p> : null}
          <button
            className="btn btn-primary btn-block"
            type="submit"
            disabled={!canSubmit}
          >
            Продолжить
          </button>
        </form>

        <p className="auth-switch muted">
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </main>
    </div>
  )
}
