import { useEffect, useState } from 'react'
import './SoftLoader.css'

/** Default ring delay for list slots that mount SoftLoader immediately. */
export const SOFT_LOADER_DELAY_MS = 320

type Props = {
  label?: string
  className?: string
  /** Hide the ring until this delay — skip flicker on fast answers. Slot stays reserved. */
  delayMs?: number
}

/** List-region loader. Sit it in the feed slot under stable chrome, never above a primary CTA. */
export function SoftLoader({ label = 'Загружаем…', className = '', delayMs = 0 }: Props) {
  const [showRing, setShowRing] = useState(delayMs <= 0)

  useEffect(() => {
    if (delayMs <= 0) {
      setShowRing(true)
      return
    }
    setShowRing(false)
    const id = window.setTimeout(() => setShowRing(true), delayMs)
    return () => window.clearTimeout(id)
  }, [delayMs])

  return (
    <div
      className={`soft-loader ${showRing ? '' : 'is-waiting'} ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {showRing ? (
        <>
          <span className="soft-loader-ring" aria-hidden />
          <p className="soft-loader-label">{label}</p>
        </>
      ) : (
        <span className="sr-only">{label}</span>
      )}
    </div>
  )
}
