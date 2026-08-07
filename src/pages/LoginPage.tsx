import { type FormEvent, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../context/useApp'
import { EMAIL_MAX, PASSWORD_MAX } from '../lib/fieldLimits'
import './AuthPages.css'

type LoginLocationState = {
  resetOk?: boolean
}

export function LoginPage() {
  const { login } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

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
    try {
      await login(email, password)
      // После flushSync в login user уже в контексте — сразу в приложение
      navigate('/app', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось войти')
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

        <form className="auth-form" onSubmit={onSubmit}>
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
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={EMAIL_MAX}
              autoComplete="email"
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              maxLength={PASSWORD_MAX}
              autoComplete="current-password"
              placeholder="Пароль"
              aria-label="Пароль"
            />
            <p className="auth-forgot">
              <Link to="/forgot-password">Забыли пароль?</Link>
            </p>
          </div>
          {notice ? (
            <p className="feedback-success" role="status">
              {notice}
            </p>
          ) : null}
          {error ? <p className="feedback-error">{error}</p> : null}
          <button className="btn btn-primary btn-block" type="submit">
            Войти
          </button>
        </form>

        <p className="auth-switch muted">
          Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
        </p>
      </main>
    </div>
  )
}
