import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Dumbbell, ThumbsUp } from 'lucide-react'
import { useApp } from '../context/useApp'
import type { Gender } from '../types'
import './MomentFX.css'

export type MomentKind = 'checkin' | 'checkout' | 'workout'

type MomentPayload = {
  kind: MomentKind
  title: string
  subtitle?: string
}

type MomentApi = {
  celebrate: (kind: MomentKind) => void
}

const MomentContext = createContext<MomentApi | null>(null)

type Line = { title: string; subtitle: string }

function momentLines(kind: MomentKind, gender: Gender): Line[] {
  const female = gender === 'female'

  if (kind === 'checkin') {
    return [
      { title: 'Ты в зале', subtitle: 'Поехали' },
      { title: 'Статус включён', subtitle: 'Тренировка начинается' },
      { title: 'На месте', subtitle: 'Хорошей тренировки' },
    ]
  }

  if (kind === 'checkout') {
    return [
      {
        title: 'Готово',
        subtitle: female ? 'Сегодня ты стала сильнее' : 'Сегодня ты стал сильнее',
      },
      {
        title: 'Тренировка завершена',
        subtitle: female ? 'Отлично — отдыхай' : 'Красава — отдыхай',
      },
      { title: 'Отличная работа', subtitle: 'Зал засчитан' },
      { title: 'Ты молодец', subtitle: 'До следующей тренировки' },
    ]
  }

  return [
    { title: 'Записано', subtitle: 'Ещё один шаг вперёд' },
    { title: 'Класс', subtitle: 'Дневник обновлён' },
    { title: 'Есть', subtitle: 'Прогресс сохранён' },
  ]
}

function pickCopy(kind: MomentKind, gender: Gender) {
  const list = momentLines(kind, gender)
  return list[Math.floor(Math.random() * list.length)]
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

type Particle = { id: number; left: number; delay: number; duration: number; drift: number; hue: number }

/** Sparks around the toast card only — not a second mid-screen show. */
function buildParticles(kind: MomentKind): Particle[] {
  if (prefersReducedMotion()) return []
  const count = kind === 'checkout' ? 12 : 8
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: 12 + Math.random() * 76,
    delay: Math.random() * 0.18,
    duration: 0.7 + Math.random() * 0.4,
    drift: -28 + Math.random() * 56,
    hue: kind === 'checkin' ? 72 + Math.random() * 40 : 35 + Math.random() * 90,
  }))
}

function MomentIcon({ kind }: { kind: MomentKind }) {
  if (kind === 'checkin') return <Dumbbell size={22} strokeWidth={2.4} aria-hidden />
  return <ThumbsUp size={22} strokeWidth={2.4} aria-hidden />
}

/** Frequent actions stay short; long dark overlays add friction on the 40th visit. */
function momentDurationMs(kind: MomentKind) {
  if (prefersReducedMotion()) return 1200
  if (kind === 'checkout') return 1800
  return 1600
}

export function MomentProvider({ children }: { children: ReactNode }) {
  const { user } = useApp()
  const gender: Gender = user?.gender === 'female' ? 'female' : 'male'
  const [moment, setMoment] = useState<(MomentPayload & { key: number; particles: Particle[] }) | null>(
    null,
  )
  const timerRef = useRef<number | null>(null)

  const clear = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = null
    setMoment(null)
  }, [])

  const celebrate = useCallback(
    (kind: MomentKind) => {
      const copy = pickCopy(kind, gender)
      if (timerRef.current) window.clearTimeout(timerRef.current)
      setMoment({
        key: Date.now(),
        kind,
        title: copy.title,
        subtitle: copy.subtitle,
        particles: buildParticles(kind),
      })
      timerRef.current = window.setTimeout(() => {
        setMoment(null)
        timerRef.current = null
      }, momentDurationMs(kind))
    },
    [gender],
  )

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    },
    [],
  )

  const api = useMemo(() => ({ celebrate }), [celebrate])

  return (
    <MomentContext.Provider value={api}>
      {children}
      {moment
        ? createPortal(
            <div
              key={moment.key}
              className={`moment-fx moment-fx--${moment.kind}`}
              role="status"
              aria-live="polite"
            >
              <button
                type="button"
                className="moment-fx-scrim"
                aria-label="Закрыть"
                onClick={clear}
              />
              <div className="moment-fx-card">
                <div className="moment-fx-sparks" aria-hidden>
                  {moment.particles.map((p) => (
                    <i
                      key={p.id}
                      className="moment-fx-particle"
                      style={
                        {
                          left: `${p.left}%`,
                          '--drift': `${p.drift}px`,
                          '--delay': `${p.delay}s`,
                          '--dur': `${p.duration}s`,
                          '--hue': String(p.hue),
                        } as CSSProperties
                      }
                    />
                  ))}
                </div>
                <span className="moment-fx-icon">
                  <MomentIcon kind={moment.kind} />
                </span>
                <div className="moment-fx-copy">
                  <strong>{moment.title}</strong>
                  {moment.subtitle ? <span>{moment.subtitle}</span> : null}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </MomentContext.Provider>
  )
}

export function useMoment() {
  const ctx = useContext(MomentContext)
  if (!ctx) {
    return {
      celebrate: (_kind: MomentKind) => {},
    }
  }
  return ctx
}
