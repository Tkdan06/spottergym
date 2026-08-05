import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import {
  checkSiteLockCredentials,
  fetchSiteLockRemote,
  isSiteLockUnlocked,
  setSiteLockUnlocked,
  siteLockEnvForceOff,
  siteLockEnvForceOn,
} from '../config/siteLock'
import './SiteLockGate.css'

type Phase = 'loading' | 'open' | 'locked'

export function SiteLockGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [hint, setHint] = useState('Закрытый тест Spotter')
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function boot() {
      if (siteLockEnvForceOff()) {
        if (!cancelled) setPhase('open')
        return
      }

      if (isSiteLockUnlocked() && !siteLockEnvForceOn()) {
        // уже входили в этой вкладке — пускаем сразу, но всё равно сверим флаг
      }

      const remote = await fetchSiteLockRemote()
      if (cancelled) return

      const enabled = siteLockEnvForceOn() ? true : remote.enabled
      setHint(remote.hint || 'Закрытый тест Spotter')

      if (!enabled) {
        setPhase('open')
        return
      }

      if (isSiteLockUnlocked()) {
        setPhase('open')
        return
      }

      setPhase('locked')
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const ok = checkSiteLockCredentials(user, password)
    if (!ok) {
      setError('Неверный логин или пароль')
      setBusy(false)
      return
    }
    setSiteLockUnlocked(true)
    setPhase('open')
    setBusy(false)
  }

  if (phase === 'loading') {
    return (
      <div className="site-lock" aria-busy="true">
        <div className="site-lock-card">
          <p className="brand-mark">
            SPOT<span>TER</span>
          </p>
          <p className="muted">Проверяем доступ…</p>
        </div>
      </div>
    )
  }

  if (phase === 'open') return <>{children}</>

  return (
    <div className="site-lock">
      <form className="site-lock-card" onSubmit={onSubmit}>
        <p className="brand-mark">
          SPOT<span>TER</span>
        </p>
        <h1>Закрытый доступ</h1>
        <p className="muted site-lock-hint">{hint}</p>

        <label className="field">
          <span>Логин</span>
          <input
            autoComplete="username"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="Логин"
            required
            autoFocus
          />
        </label>

        <label className="field">
          <span>Пароль</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
            required
          />
        </label>

        {error ? <p className="site-lock-error">{error}</p> : null}

        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          Войти на сайт
        </button>
      </form>
    </div>
  )
}
