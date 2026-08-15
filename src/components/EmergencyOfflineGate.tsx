import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import {
  apiAdminEmergencyRecover,
  apiFetchHealth,
} from '../lib/apiClient'
import './EmergencyOfflineGate.css'

type Phase = 'loading' | 'open' | 'emergency'

export function EmergencyOfflineGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showRecover, setShowRecover] = useState(false)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let fails = 0

    const schedule = (ms: number) => {
      timer = setTimeout(() => {
        void tick()
      }, ms)
    }

    async function tick() {
      try {
        const health = await apiFetchHealth()
        if (cancelled) return
        fails = 0
        if (health.emergency) {
          setPhase('emergency')
          schedule(12_000)
          return
        }
        setPhase('open')
      } catch {
        if (cancelled) return
        fails += 1
        // Don't brick local/offline SPA if API is simply down
        setPhase((prev) => {
          if (prev === 'emergency') return 'emergency'
          if (fails >= 2) return 'open'
          return 'loading'
        })
        if (fails < 2) schedule(2_000)
      }
    }

    void tick()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [])

  const onRecover = (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    void apiAdminEmergencyRecover(email, password)
      .then(() => {
        setPassword('')
        setPhase('open')
        window.location.reload()
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Не удалось включить')
      })
      .finally(() => setBusy(false))
  }

  if (phase === 'loading') {
    return (
      <div className="emergency-gate emergency-gate-loading" role="status">
        <p>Spotter</p>
      </div>
    )
  }

  if (phase === 'emergency') {
    return (
      <div className="emergency-gate" role="alert">
        <div className="emergency-gate-card">
          <p className="emergency-gate-brand">Spotter</p>
          <h1>Сервис отключён</h1>
          <p className="emergency-gate-copy">
            Доступ временно закрыт. Если ты главный админ — можно включить снова.
          </p>
          {!showRecover ? (
            <button
              type="button"
              className="emergency-gate-link"
              onClick={() => setShowRecover(true)}
            >
              Включить сервис
            </button>
          ) : (
            <form className="emergency-gate-form" onSubmit={onRecover}>
              <label>
                Email
                <input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label>
                Пароль
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              {error ? <p className="emergency-gate-error">{error}</p> : null}
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'Включаем…' : 'Включить'}
              </button>
            </form>
          )}
        </div>
      </div>
    )
  }

  return <>{children}</>
}
