import { type FormEvent, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { ApiError, apiChangePassword, getStoredToken } from '../lib/apiClient'
import { saveAccountPassword, verifyAccountPassword } from '../lib/accountAuth'
import { PASSWORD_MAX, PASSWORD_MIN } from '../lib/fieldLimits'
import { useApp } from '../context/useApp'

type FieldKey = 'current' | 'next' | 'confirm'

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  visible,
  onToggleVisible,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  autoComplete: string
  visible: boolean
  onToggleVisible: () => void
  placeholder?: string
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-field">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required
          minLength={id === 'pw-current' ? 1 : PASSWORD_MIN}
          maxLength={PASSWORD_MAX}
          placeholder={placeholder}
          spellCheck={false}
        />
        <button
          type="button"
          className="password-field-toggle"
          onClick={onToggleVisible}
          aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
          aria-pressed={visible}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  )
}

export function ChangePasswordForm() {
  const { user, apiOnline } = useApp()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [visible, setVisible] = useState<Record<FieldKey, boolean>>({
    current: false,
    next: false,
    confirm: false,
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [pending, setPending] = useState(false)

  if (!user) return null

  const toggle = (key: FieldKey) => {
    setVisible((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const current = currentPassword
    const next = newPassword
    const confirm = confirmPassword

    if (next.length < PASSWORD_MIN || next.length > PASSWORD_MAX) {
      setError(`Новый пароль: от ${PASSWORD_MIN} до ${PASSWORD_MAX} символов`)
      return
    }
    if (next !== confirm) {
      setError('Новый пароль и подтверждение не совпадают')
      return
    }
    if (current === next) {
      setError('Новый пароль должен отличаться от текущего')
      return
    }

    setPending(true)
    try {
      if (apiOnline && getStoredToken()) {
        await apiChangePassword(current, next)
        saveAccountPassword(user.email, next)
      } else {
        const verified = verifyAccountPassword(user.email, current)
        if (verified === null) {
          throw new Error('Смена пароля недоступна без сети. Подключись и попробуй снова')
        }
        if (!verified) {
          throw new Error('Неверный текущий пароль')
        }
        saveAccountPassword(user.email, next)
      }

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setVisible({ current: false, next: false, confirm: false })
      setSuccess('Пароль обновлён')
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Не удалось сменить пароль'
      setError(message)
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="settings-panel settings-password-panel" aria-labelledby="password-title">
      <div className="settings-panel-head">
        <h2 id="password-title">Пароль</h2>
        <p className="muted">Смена пароля для входа · {user.email}</p>
      </div>

      <form className="settings-password-form" onSubmit={(e) => void onSubmit(e)} noValidate>
        <PasswordField
          id="pw-current"
          label="Текущий пароль"
          value={currentPassword}
          onChange={(v) => {
            setCurrentPassword(v)
            setError('')
            setSuccess('')
          }}
          autoComplete="current-password"
          visible={visible.current}
          onToggleVisible={() => toggle('current')}
        />
        <PasswordField
          id="pw-new"
          label="Новый пароль"
          value={newPassword}
          onChange={(v) => {
            setNewPassword(v)
            setError('')
            setSuccess('')
          }}
          autoComplete="new-password"
          visible={visible.next}
          onToggleVisible={() => toggle('next')}
          placeholder={`От ${PASSWORD_MIN} символов`}
        />
        <PasswordField
          id="pw-confirm"
          label="Повторите новый пароль"
          value={confirmPassword}
          onChange={(v) => {
            setConfirmPassword(v)
            setError('')
            setSuccess('')
          }}
          autoComplete="new-password"
          visible={visible.confirm}
          onToggleVisible={() => toggle('confirm')}
        />

        <p className="dim settings-panel-hint">
          Не используй пароль от почты или банковских приложений. После смены останешься в аккаунте.
        </p>

        {error ? (
          <p className="feedback-error" role="alert">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="feedback-success" role="status">
            {success}
          </p>
        ) : null}

        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={pending || !currentPassword || !newPassword || !confirmPassword}
        >
          {pending ? 'Сохраняем…' : 'Обновить пароль'}
        </button>
      </form>
    </section>
  )
}
