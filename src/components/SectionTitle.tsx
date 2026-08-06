import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  /** Right-side action: link, button, muted count… */
  action?: ReactNode
  className?: string
  as?: 'h2' | 'h3'
  id?: string
}

/** Canonical block heading — always use instead of bare sized h2. */
export function SectionTitle({ children, action, className = '', as: Tag = 'h2', id }: Props) {
  return (
    <div className={`section-title ${className}`.trim()}>
      <Tag id={id} className="section-heading">
        {children}
      </Tag>
      {action ?? null}
    </div>
  )
}
