import { useEffect, useState } from 'react'
import { formatCheckInElapsed } from '../lib/presence'

/** Ticking elapsed label since check-in ISO time; empty when inactive. */
export function useCheckInElapsed(checkedInAt: string | undefined | null, active: boolean): string {
  const [label, setLabel] = useState('')

  useEffect(() => {
    if (!active || !checkedInAt) {
      setLabel('')
      return
    }
    const started = Date.parse(checkedInAt)
    if (!Number.isFinite(started)) {
      setLabel('')
      return
    }
    const tick = () => setLabel(formatCheckInElapsed(Date.now() - started))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [active, checkedInAt])

  return label
}
