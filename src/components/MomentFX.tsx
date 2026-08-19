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
import { ThumbsUp } from 'lucide-react'
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

function buildParticles(kind: MomentKind): Particle[] {
  if (prefersReducedMotion()) return []
  const count = kind === 'checkin' ? 10 : kind === 'checkout' ? 22 : 14
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: 8 + Math.random() * 84,
    delay: Math.random() * 0.25,
    duration: 0.85 + Math.random() * 0.55,
    drift: -40 + Math.random() * 80,
    hue: kind === 'checkin' ? 72 + Math.random() * 40 : 35 + Math.random() * 90,
  }))
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
      const ms = prefersReducedMotion() ? 1400 : kind === 'checkout' ? 2200 : 1700
      timerRef.current = window.setTimeout(() => {
        setMoment(null)
        timerRef.current = null
      }, ms)
    },
    [gender],
  )

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
  }, [])

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
              <div className="moment-fx-burst" aria-hidden>
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
                {moment.kind === 'workout' || moment.kind === 'checkout' ? (
                  <span className="moment-fx-thumb">
                    <ThumbsUp size={28} strokeWidth={2.4} />
                  </span>
                ) : (
                  <span className="moment-fx-pulse" />
                )}
              </div>
              <div className="moment-fx-toast">
                <strong>{moment.title}</strong>
                {moment.subtitle ? <span>{moment.subtitle}</span> : null}
              </div>
              <button type="button" className="moment-fx-dismiss" aria-label="Закрыть" onClick={clear} />
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
