import { ChevronRight, Heart } from 'lucide-react'
import { Link } from 'react-router-dom'
import { displayName } from '../data/mock'
import { profileImage, profileImageFallback } from '../lib/avatar'
import type { UserProfile } from '../types'
import { SmartImage } from './SmartImage'
import './LikesRow.css'

interface Props {
  count: number
  likers: UserProfile[]
  maxAvatars?: number
  compact?: boolean
  /** Makes the whole row a link (e.g. to who liked you) */
  to?: string
}

function likesLabel(count: number) {
  const n = Math.abs(count) % 100
  const n1 = n % 10
  if (n > 10 && n < 20) return `${count} лайков`
  if (n1 === 1) return `${count} лайк`
  if (n1 >= 2 && n1 <= 4) return `${count} лайка`
  return `${count} лайков`
}

export function LikesRow({ count, likers, maxAvatars = 5, compact, to }: Props) {
  if (count <= 0) {
    const empty = (
      <div className={`likes-row empty ${compact ? 'compact' : ''} ${to ? 'likes-row-link' : ''}`}>
        <div className="likes-main">
          <Heart size={compact ? 13 : 15} aria-hidden />
          <span>Пока нет лайков</span>
        </div>
        {to ? <ChevronRight size={18} className="likes-chevron" aria-hidden /> : null}
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

  // Prefer resolved faces; +N only for likes beyond the face stack (not "unknown to me")
  const shown = likers.slice(0, maxAvatars)
  const extra = Math.max(0, count - shown.length)

  const body = (
    <div className={`likes-row ${compact ? 'compact' : ''} ${to ? 'likes-row-link' : ''}`}>
      <div className="likes-main">
        {shown.length ? (
          <div className="likes-avatars" aria-hidden={Boolean(to)}>
            {shown.map((person) => {
              const name = displayName(person)
              const src = profileImage(person)
              return (
                <SmartImage
                  key={person.id}
                  src={src}
                  fallbackSrc={profileImageFallback(person)}
                  alt={to ? '' : name}
                  title={name}
                  className="likes-avatar"
                  size="avatar"
                  instant
                />
              )
            })}
            {extra > 0 ? <span className="likes-extra">+{extra}</span> : null}
          </div>
        ) : null}
        <span className="likes-count">
          <Heart size={compact ? 12 : 14} fill="currentColor" aria-hidden />
          {compact ? count : likesLabel(count)}
        </span>
      </div>
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
