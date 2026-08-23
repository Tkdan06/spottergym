import { type FormEvent, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../context/useApp'
import { EMAIL_MAX, PASSWORD_MAX } from '../lib/fieldLimits'
import { registerHref } from '../lib/inviteShare'
import './AuthPages.css'

type LoginLocationState = {
  resetOk?: boolean
}

export function LoginPage() {
  const { login } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const passwordRef = useRef<HTMLInputElement>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState(false)
  const [authFailed, setAuthFailed] = useState(false)

  useEffect(() => {
    const state = location.state as LoginLocationState | null
    if (state?.resetOk) {
      setNotice('Пароль обновлён — войди с новым паролем')
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.pathname, location.state, navigate])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setNotice('')
    setAuthFailed(false)
    setPending(true)
    try {
      await login(email, password)
      navigate('/app', { replace: true })
    } catch (err) {
      // Generic copy — never reveal whether email exists
      const message =
        err instanceof Error && err.message.trim()
          ? err.message
          : 'Неверный email или пароль'
      setError(message)
      setAuthFailed(true)
      setPassword('')
      requestAnimationFrame(() => passwordRef.current?.focus())
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="app-shell">
      <main className="page no-nav auth-page">
        <Link to="/" className="brand-mark auth-brand">
          SPOT<span>TER</span>
        </Link>
        <h1>Вход</h1>
        <p className="muted">Войди, чтобы увидеть кто сейчас в твоём зале</p>

        <form className="auth-form" onSubmit={(e) => void onSubmit(e)}>
          <div className="field">
            <label htmlFor="email" className="sr-only">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setError('')
                setAuthFailed(false)
              }}
              required
              maxLength={EMAIL_MAX}
              autoComplete="email"
              placeholder="Email"
              aria-label="Email"
              aria-invalid={authFailed || undefined}
            />
          </div>
          <div className="field">
            <label htmlFor="password" className="sr-only">
              Пароль
            </label>
            <input
              ref={passwordRef}
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError('')
                setAuthFailed(false)
              }}
              required
              maxLength={PASSWORD_MAX}
              autoComplete="current-password"
              placeholder="Пароль"
              aria-label="Пароль"
              aria-invalid={authFailed || undefined}
              aria-describedby={error ? 'login-error' : undefined}
            />
            <p className={`auth-forgot${authFailed ? ' is-emphasized' : ''}`}>
              <Link to="/forgot-password">Забыли пароль?</Link>
            </p>
          </div>
          {notice ? (
            <p className="feedback-success" role="status">
              {notice}
            </p>
          ) : null}
          {error ? (
            <p id="login-error" className="feedback-error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
            {pending ? 'Входим…' : 'Войти'}
          </button>
        </form>

        <p className="auth-switch muted">
          Нет аккаунта? <Link to={registerHref()}>Зарегистрироваться</Link>
        </p>
      </main>
    </div>
  )
}
