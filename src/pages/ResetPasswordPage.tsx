import { type FormEvent, useMemo, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError, apiResetPassword } from '../lib/apiClient'
import { PASSWORD_MAX, PASSWORD_MIN } from '../lib/fieldLimits'
import './AuthPages.css'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = useMemo(() => (params.get('token') || '').trim(), [params])

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!token) {
      setError('Ссылка недействительна — запроси восстановление снова')
      return
    }
    if (newPassword.length < PASSWORD_MIN || newPassword.length > PASSWORD_MAX) {
      setError(`Пароль: от ${PASSWORD_MIN} до ${PASSWORD_MAX} символов`)
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают')
      return
    }

    setPending(true)
    try {
      await apiResetPassword(token, newPassword)
      navigate('/login', { replace: true, state: { resetOk: true } })
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Не удалось обновить пароль',
      )
    } finally {
      setPending(false)
    }
  }

  if (!token) {
    return (
      <div className="app-shell">
        <main className="page no-nav auth-page">
          <Link to="/" className="brand-mark auth-brand">
            SPOT<span>TER</span>
          </Link>
          <h1>Ссылка недействительна</h1>
          <p className="muted">Запроси новую ссылку для восстановления пароля</p>
          <Link to="/forgot-password" className="btn btn-primary btn-block">
            Восстановить пароль
          </Link>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <main className="page no-nav auth-page">
        <Link to="/" className="brand-mark auth-brand">
          SPOT<span>TER</span>
        </Link>
        <h1>Новый пароль</h1>
        <p className="muted">Придумай пароль для входа в Spotter</p>

        <form className="auth-form" onSubmit={(e) => void onSubmit(e)} noValidate>
          <div className="field">
            <label htmlFor="reset-new">Новый пароль</label>
            <div className="password-field">
              <input
                id="reset-new"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={PASSWORD_MIN}
                maxLength={PASSWORD_MAX}
                autoComplete="new-password"
                placeholder={`От ${PASSWORD_MIN} символов`}
                spellCheck={false}
              />
              <button
                type="button"
                className="password-field-toggle"
                onClick={() => setShowNew((v) => !v)}
                aria-label={showNew ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div className="field">
            <label htmlFor="reset-confirm">Повтори пароль</label>
            <div className="password-field">
              <input
                id="reset-confirm"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={PASSWORD_MIN}
                maxLength={PASSWORD_MAX}
                autoComplete="new-password"
                spellCheck={false}
              />
              <button
                type="button"
                className="password-field-toggle"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error ? (
            <p className="feedback-error" role="alert">
              {error}
            </p>
          ) : null}

          <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
            {pending ? 'Сохраняем…' : 'Сохранить пароль'}
          </button>
        </form>

        <p className="auth-switch muted">
          <Link to="/forgot-password">Запросить ссылку снова</Link>
        </p>
      </main>
    </div>
  )
}
