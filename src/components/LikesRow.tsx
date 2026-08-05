import { ChevronRight, Heart } from 'lucide-react'
import { Link } from 'react-router-dom'
import { displayName } from '../data/mock'
import { profileImage } from '../lib/avatar'
import type { UserProfile } from '../types'
import './LikesRow.css'

interface Props {
  count: number
  likers: UserProfile[]
  maxAvatars?: number
  compact?: boolean
  /** Makes the whole row a link (e.g. to who liked you) */
  to?: string
}

export function LikesRow({ count, likers, maxAvatars = 5, compact, to }: Props) {
  if (count <= 0) {
    const empty = (
      <div className={`likes-row empty ${compact ? 'compact' : ''} ${to ? 'likes-row-link' : ''}`}>
        <Heart size={14} />
        <span>Пока нет лайков</span>
        {to ? <ChevronRight size={16} className="likes-chevron" aria-hidden /> : null}
      </div>
    )
    return to ? (
      <Link to={to} className="likes-row-anchor" aria-label="Кто лайкнул">
        {empty}
      </Link>
    ) : (
      empty
    )
  }

  const shown = likers.slice(0, maxAvatars)
  const extra = Math.max(0, count - shown.length)

  const body = (
    <div className={`likes-row ${compact ? 'compact' : ''} ${to ? 'likes-row-link' : ''}`}>
      <div className="likes-avatars" aria-hidden={Boolean(to)}>
        {shown.map((person) => {
          const name = displayName(person)
          const src = profileImage(person)
          return (
            <img
              key={person.id}
              src={src}
              alt={to ? '' : name}
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
      {to ? <ChevronRight size={18} className="likes-chevron" aria-hidden /> : null}
    </div>
  )

  if (to) {
    return (
      <Link to={to} className="likes-row-anchor" aria-label={`Кто лайкнул · ${count}`}>
        {body}
      </Link>
    )
  }

  return body
}
