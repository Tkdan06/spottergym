import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { SpotterBrandReveal } from '../components/SpotterBrandReveal'
import '../components/SpotterBrandReveal.css'
import './BrandMotionLabPage.css'

/**
 * Sandbox for the SPOTTER letter intro (post-registration / first home).
 * Open: /brand-lab — press Start to replay.
 */
export function BrandMotionLabPage() {
  const [playKey, setPlayKey] = useState(0)
  const [status, setStatus] = useState('Жми «Старт»')

  const start = useCallback(() => {
    setStatus('Идёт анимация…')
    setPlayKey((n) => n + 1)
  }, [])

  return (
    <main className="brand-lab">
      <header className="brand-lab-top">
        <Link to="/" className="brand-lab-back">
          ← На главную
        </Link>
        <p className="brand-lab-kicker">Motion lab</p>
        <h1 className="page-title">SPOTTER letter reveal</h1>
        <p className="muted brand-lab-lead">
          Черновик интро после регистрации / онбординга. Референс по духу: bold kinetic letters +
          stripe sweep (North Sea Jazz identity), в палитре и шрифте Spotter.
        </p>
      </header>

      <section className="brand-lab-stage surface" aria-live="polite">
        <SpotterBrandReveal
          playKey={playKey}
          onComplete={() => setStatus('Готово — можно запустить ещё раз')}
        />
        <p className="dim brand-lab-status">{status}</p>
      </section>

      <div className="brand-lab-actions">
        <button type="button" className="btn btn-primary btn-block" onClick={start}>
          Старт
        </button>
        <button
          type="button"
          className="btn btn-soft btn-block"
          onClick={() => {
            setPlayKey(0)
            setStatus('Сброшено')
          }}
        >
          Сброс
        </button>
      </div>

      <section className="brand-lab-notes muted">
        <p>
          <strong>Идея:</strong> буквы выезжают снизу со stagger, лёгкий skew → snap; по слову
          пробегает диагональная «полоса» accent; <span className="brand-lab-accent">TER</span> в
          фирменном зелёном.
        </p>
        <p>
          Дальше можно повесить этот экран на переход онбординг → /app (один раз на устройство) и
          добавить fade-out в Home.
        </p>
      </section>
    </main>
  )
}
