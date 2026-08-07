import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, apiForgotPassword } from '../lib/apiClient'
import { EMAIL_MAX } from '../lib/fieldLimits'
import './AuthPages.css'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [pending, setPending] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setPending(true)
    try {
      await apiForgotPassword(email.trim())
      setDone(true)
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Не удалось отправить письмо',
      )
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
        <h1>Восстановление</h1>
        <p className="muted">Укажи email аккаунта — пришлём ссылку для нового пароля</p>

        {done ? (
          <div className="auth-success-panel">
            <p className="feedback-success" role="status">
              Если аккаунт с таким email есть — мы отправили ссылку для сброса пароля. Проверь
              почту и папку «Спам».
            </p>
            <Link to="/login" className="btn btn-primary btn-block">
              К входу
            </Link>
          </div>
        ) : (
          <form className="auth-form" onSubmit={(e) => void onSubmit(e)}>
            <div className="field">
              <label htmlFor="forgot-email" className="sr-only">
                Email
              </label>
              <input
                id="forgot-email"
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
            {error ? (
              <p className="feedback-error" role="alert">
                {error}
              </p>
            ) : null}
            <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
              {pending ? 'Отправляем…' : 'Отправить ссылку'}
            </button>
          </form>
        )}

        <p className="auth-switch muted">
          Вспомнил пароль? <Link to="/login">Войти</Link>
        </p>
      </main>
    </div>
  )
}
