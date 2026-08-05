import type { MessageStatus } from '../types'
import './MessageTicks.css'

interface Props {
  status: MessageStatus
}

export function MessageTicks({ status }: Props) {
  if (status === 'sending') {
    return (
      <span className="msg-ticks sending" aria-label="Отправляется" title="Отправляется">
        <ClockIcon />
      </span>
    )
  }

  if (status === 'sent') {
    return (
      <span className="msg-ticks sent" aria-label="Отправлено" title="Отправлено">
        <CheckIcon />
      </span>
    )
  }

  if (status === 'delivered') {
    return (
      <span className="msg-ticks delivered" aria-label="Доставлено" title="Доставлено">
        <DoubleCheckIcon />
      </span>
    )
  }

  return (
    <span className="msg-ticks read" aria-label="Прочитано" title="Прочитано">
      <DoubleCheckIcon />
    </span>
  )
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4.5V8l2.2 1.4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="14" aria-hidden="true">
      <path
        d="M3.2 8.2 6.1 11l6.7-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DoubleCheckIcon() {
  return (
    <svg viewBox="0 0 20 16" width="18" height="14" aria-hidden="true">
      <path
        d="M1.6 8.2 4.5 11l6.7-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.4 8.2 9.3 11l6.7-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
