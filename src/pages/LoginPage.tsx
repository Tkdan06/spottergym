import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../context/useApp'
import { MASTER_ADMIN_EMAIL } from '../lib/adminConfig'
import './AuthPages.css'

export function LoginPage() {
  const { login } = useApp()
  const navigate = useNavigate()
  const [email, setEmail] = useState('demo@spotter.app')
  const [password, setPassword] = useState('demo')
  const [error, setError] = useState('')

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      login(email, password)
      navigate('/app')
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
        <p className="muted">Войди, чтобы увидеть кто сейчас в твоём зале.</p>

        <form className="auth-form" onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
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
              autoComplete="current-password"
            />
          </div>
          {error ? <p className="feedback-error">{error}</p> : null}
          <button className="btn btn-primary btn-block" type="submit">
            Войти
          </button>
        </form>

        <p className="auth-switch muted">
          Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
        </p>
        <p className="dim auth-hint">
          Демо: любой email. Админ: {MASTER_ADMIN_EMAIL} (Богдан).
        </p>
      </main>
    </div>
  )
}
