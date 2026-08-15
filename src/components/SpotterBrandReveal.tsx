import { useEffect, useState } from 'react'

const LETTERS = [
  { ch: 'S', accent: false },
  { ch: 'P', accent: false },
  { ch: 'O', accent: false },
  { ch: 'T', accent: false },
  { ch: 'T', accent: true },
  { ch: 'E', accent: true },
  { ch: 'R', accent: true },
] as const

type Props = {
  /** When this changes, the animation replays from the start */
  playKey: number
  className?: string
  /** Fires once when the intro sequence finishes */
  onComplete?: () => void
}

/**
 * Kinetic letter reveal for SPOTTER — test/preview for a post-auth intro.
 * Inspired by bold striped/kinetic identity systems (e.g. North Sea Jazz),
 * adapted to Spotter: Unbounded/brand font, SPOT + accent TER, no purple glow.
 */
export function SpotterBrandReveal({ playKey, className = '', onComplete }: Props) {
  const [phase, setPhase] = useState<'idle' | 'run' | 'done'>('idle')

  useEffect(() => {
    if (playKey < 1) {
      setPhase('idle')
      return
    }
    setPhase('run')
    const doneAt = window.setTimeout(() => {
      setPhase('done')
      onComplete?.()
    }, 1800)
    return () => window.clearTimeout(doneAt)
  }, [playKey, onComplete])

  if (playKey < 1) {
    return (
      <div className={`brand-reveal brand-reveal--idle ${className}`.trim()} aria-hidden>
        <span className="brand-reveal-word">
          {LETTERS.map((letter, i) => (
            <span
              key={`${letter.ch}-${i}`}
              className={`brand-reveal-letter${letter.accent ? ' is-accent' : ''}`}
              style={{ ['--i' as string]: i }}
            >
              {letter.ch}
            </span>
          ))}
        </span>
      </div>
    )
  }

  return (
    <div
      className={[
        'brand-reveal',
        phase === 'run' ? 'is-playing' : '',
        phase === 'done' ? 'is-done' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label="Spotter"
      role="img"
    >
      <div className="brand-reveal-stripes" aria-hidden />
      <span className="brand-reveal-word">
        {LETTERS.map((letter, i) => (
          <span
            key={`${playKey}-${letter.ch}-${i}`}
            className={`brand-reveal-letter${letter.accent ? ' is-accent' : ''}`}
            style={{ ['--i' as string]: i }}
          >
            <span className="brand-reveal-glyph">{letter.ch}</span>
          </span>
        ))}
      </span>
    </div>
  )
}
