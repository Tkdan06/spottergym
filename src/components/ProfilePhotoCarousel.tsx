import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Images } from 'lucide-react'
import { MAX_PROFILE_PHOTOS } from '../lib/photos'
import './ProfilePhotoCarousel.css'

type Props = {
  photos: string[]
  fallbackSrc: string
  name: string
  /** Компактный квадрат для своего профиля */
  mine?: boolean
  onOpen: (index: number) => void
  emptyHint?: string
}

export function ProfilePhotoCarousel({
  photos,
  fallbackSrc,
  name,
  mine = false,
  onOpen,
  emptyHint,
}: Props) {
  const list = photos.length ? photos : [fallbackSrc]
  const [index, setIndex] = useState(0)
  const startX = useRef<number | null>(null)
  const startY = useRef<number | null>(null)
  const moved = useRef(false)

  const safeIndex = Math.min(index, list.length - 1)
  const current = list[safeIndex] || fallbackSrc
  const count = photos.length
  const canSwipe = photos.length > 1

  const go = (dir: -1 | 1) => {
    if (!canSwipe) return
    setIndex((i) => (i + dir + photos.length) % photos.length)
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    startX.current = e.clientX
    startY.current = e.clientY
    moved.current = false
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    if (startX.current == null || startY.current == null) return
    const dx = e.clientX - startX.current
    const dy = e.clientY - startY.current
    if (Math.abs(dx) > 12 || Math.abs(dy) > 12) moved.current = true
  }

  const onPointerUp = (e: ReactPointerEvent) => {
    if (startX.current == null) return
    const dx = e.clientX - startX.current
    const dy = e.clientY - (startY.current ?? e.clientY)
    startX.current = null
    startY.current = null

    if (canSwipe && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      go(dx > 0 ? -1 : 1)
      return
    }

    if (!moved.current) onOpen(safeIndex)
  }

  return (
    <div
      className={`profile-carousel ${mine ? 'mine' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        startX.current = null
        startY.current = null
      }}
      role="button"
      tabIndex={0}
      aria-label={
        count
          ? `${name}: фото ${safeIndex + 1} из ${count}. Свайп — листать, нажатие — открыть`
          : emptyHint || `Фото ${name}`
      }
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(safeIndex)
        }
        if (e.key === 'ArrowLeft') go(-1)
        if (e.key === 'ArrowRight') go(1)
      }}
    >
      <img key={`${current}-${safeIndex}`} src={current} alt={name} draggable={false} />

      {count > 0 ? (
        <span className="profile-carousel-count" aria-hidden>
          {safeIndex + 1}/{count}
        </span>
      ) : (
        <span className="profile-carousel-count empty" aria-hidden>
          <Images size={12} />
          {emptyHint || `0/${MAX_PROFILE_PHOTOS}`}
        </span>
      )}

      {canSwipe ? (
        <span className="profile-carousel-dots" aria-hidden>
          {photos.map((_, i) => (
            <i key={i} className={i === safeIndex ? 'on' : ''} />
          ))}
        </span>
      ) : null}
    </div>
  )
}
