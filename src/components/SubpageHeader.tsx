import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'

type BackProps = {
  onClick: () => void
  label?: string
}

/**
 * Light icon-only back control. Same ArrowLeft as the rest of the app.
 * 44×44 hit area, no chrome — do not use `.icon-btn` for page-header back.
 */
export function SubpageBack({ onClick, label = 'Назад' }: BackProps) {
  return (
    <button type="button" className="subpage-back" onClick={onClick} aria-label={label}>
      <ArrowLeft size={20} strokeWidth={2} aria-hidden />
    </button>
  )
}

type Props = {
  title: ReactNode
  onBack: () => void
  /** Right-side control (⋯, refresh, mark-all). Omit when unused. */
  action?: ReactNode
  backLabel?: string
}

/**
 * Secondary-screen chrome: [back icon] [current page title] [optional action].
 * Root tabs (Мой зал / Залы / Чаты / Профиль) must not use this.
 */
export function SubpageHeader({ title, onBack, action, backLabel = 'Назад' }: Props) {
  return (
    <header className="subpage-top">
      <SubpageBack onClick={onBack} label={backLabel} />
      <h1 className="page-title">{title}</h1>
      {action ? <div className="page-header-actions">{action}</div> : null}
    </header>
  )
}
