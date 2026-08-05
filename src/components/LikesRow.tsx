import { Heart } from 'lucide-react'
import { displayName } from '../data/mock'
import { profileImage } from '../lib/avatar'
import type { UserProfile } from '../types'
import './LikesRow.css'

interface Props {
  count: number
  likers: UserProfile[]
  maxAvatars?: number
  compact?: boolean
}

export function LikesRow({ count, likers, maxAvatars = 5, compact }: Props) {
  if (count <= 0) {
    return compact ? null : (
      <div className="likes-row empty">
        <Heart size={14} />
        <span>Пока нет лайков</span>
      </div>
    )
  }

  const shown = likers.slice(0, maxAvatars)
  const extra = Math.max(0, count - shown.length)

  return (
    <div className={`likes-row ${compact ? 'compact' : ''}`}>
      <div className="likes-avatars" aria-label={`Лайкнули ${count}`}>
        {shown.map((person) => {
          const name = displayName(person)
          const src = profileImage(person)
          return (
            <img
              key={person.id}
              src={src}
              alt={name}
              title={name}
              className="likes-avatar"
            />
          )
        })}
        {extra > 0 ? <span className="likes-extra">+{extra}</span> : null}
      </div>
      <span className="likes-count">
        <Heart size={compact ? 12 : 14} fill="currentColor" />
        {count}
      </span>
    </div>
  )
}
