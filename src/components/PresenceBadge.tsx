import './PresenceBadge.css'

interface Props {
  active: boolean
  compact?: boolean
  gymName?: string
}

export function PresenceBadge({ active, compact, gymName }: Props) {
  if (active) {
    return (
      <span className={`presence-badge on ${compact ? 'compact' : ''}`}>
        <span className="online-dot" />
        {compact ? 'В зале' : gymName ? `В зале · ${gymName}` : 'Сейчас в зале'}
      </span>
    )
  }

  return (
    <span className={`presence-badge off ${compact ? 'compact' : ''}`}>
      Не в зале
    </span>
  )
}
