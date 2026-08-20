import { createPortal } from 'react-dom'
import './SoftFlash.css'

type Props = {
  message: string
}

/** Quiet success / status flash — not MomentFX celebration. */
export function SoftFlash({ message }: Props) {
  const text = String(message || '').trim()
  if (!text || typeof document === 'undefined') return null
  return createPortal(
    <div className="soft-flash" role="status" aria-live="polite">
      {text}
    </div>,
    document.body,
  )
}
