import { type FormEvent, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../context/useApp'
import { consumeTermsAcceptedFlag } from '../lib/termsAcceptance'
import type { Gender } from '../types'
import './AuthPages.css'

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'female', label: 'Женский' },
  { value: 'male', label: 'Мужской' },
]

type RegisterLocationState = {
  termsAccepted?: boolean
}

export function RegisterPage() {
  const { register } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [gender, setGender] = useState<Gender | null>(null)
  const [ageOk, setAgeOk] = useState(false)
  const [termsOk, setTermsOk] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const state = location.state as RegisterLocationState | null
    if (state?.termsAccepted || consumeTermsAcceptedFlag()) {
      setTermsOk(true)
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.pathname, location.state, navigate])

  const canSubmit = Boolean(ageOk && termsOk && gender)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit || !gender) return
    setError('')
    try {
      register(name.trim(), email, password, gender)
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
        <p className="muted">Создай аккаунт и привяжи свой зал за пару минут.</p>

        <form className="auth-form" onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="name">Имя</label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              placeholder="Как к тебе обращаться"
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
            <p className="auth-hint">Нужен для аватарки, если пока нет своего фото.</p>
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Пароль</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={4}
            />
          </div>

          <label className="age-check">
            <input type="checkbox" checked={ageOk} onChange={(e) => setAgeOk(e.target.checked)} />
            <span>Мне есть 18 лет. Я понимаю правила безопасного общения.</span>
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
