import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import {
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import {
  MAX_PROFILE_PHOTOS,
  clampPhotos,
  optimizeImageFile,
  removePhotoAt,
  setMainPhoto,
} from '../lib/photos'
import './PhotoGalleryModal.css'

type Props = {
  open: boolean
  onClose: () => void
  photos: string[]
  /** Плейсхолдер, если своих фото ещё нет */
  fallbackSrc: string
  name: string
  editable?: boolean
  onChangePhotos?: (photos: string[]) => void
  initialIndex?: number
}

export function PhotoGalleryModal({
  open,
  onClose,
  photos,
  fallbackSrc,
  name,
  editable = false,
  onChangePhotos,
  initialIndex = 0,
}: Props) {
  const titleId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const touchX = useRef<number | null>(null)
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')

  const list = clampPhotos(photos)
  const hasPhotos = list.length > 0
  const slides = hasPhotos ? list : editable ? [fallbackSrc] : [fallbackSrc]
  const count = slides.length
  const canEdit = Boolean(editable && onChangePhotos)
  const atLimit = list.length >= MAX_PROFILE_PHOTOS
  const showingPlaceholder = !hasPhotos

  useEffect(() => {
    if (!open) return
    setIndex(Math.min(Math.max(initialIndex, 0), Math.max(count - 1, 0)))
    setError('')
    setFlash('')
  }, [open, initialIndex, count])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const go = useCallback(
    (dir: -1 | 1) => {
      if (count <= 1) return
      setIndex((i) => (i + dir + count) % count)
      setError('')
      setFlash('')
    },
    [count],
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, go])

  if (!open) return null

  const current = slides[index] || fallbackSrc
  const isMain = hasPhotos && index === 0

  const notify = (text: string) => {
    setFlash(text)
    window.setTimeout(() => setFlash(''), 1600)
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    touchX.current = e.clientX
  }

  const onPointerUp = (e: ReactPointerEvent) => {
    if (touchX.current == null) return
    const dx = e.clientX - touchX.current
    touchX.current = null
    if (Math.abs(dx) < 48) return
    go(dx > 0 ? -1 : 1)
  }

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !onChangePhotos) return
    if (atLimit) {
      setError(`Можно загрузить не больше ${MAX_PROFILE_PHOTOS} фото`)
      return
    }
    setBusy(true)
    setError('')
    try {
      const dataUrl = await optimizeImageFile(file)
      const next = clampPhotos([...list, dataUrl])
      onChangePhotos(next)
      setIndex(next.length - 1)
      notify('Фото добавлено')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обработать фото')
    } finally {
      setBusy(false)
    }
  }

  const handleSetMain = () => {
    if (!onChangePhotos || !hasPhotos || index === 0) return
    onChangePhotos(setMainPhoto(list, index))
    setIndex(0)
    notify('Аватар обновлён')
  }

  const handleDelete = () => {
    if (!onChangePhotos || !hasPhotos) return
    const next = removePhotoAt(list, index)
    onChangePhotos(next)
    setIndex((i) => Math.min(i, Math.max(next.length - 1, 0)))
    notify(next.length ? 'Фото удалено' : 'Галерея очищена')
  }

  const onDialogKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
    }
  }

  return createPortal(
    <div className="photo-modal" role="presentation" onKeyDown={onDialogKeyDown}>
      <button
        type="button"
        className="photo-modal-backdrop"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <div
        className="photo-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="photo-modal-head">
          <div>
            <p className="photo-modal-kicker">{canEdit ? 'Мои фото' : 'Фото'}</p>
            <h2 id={titleId}>{name}</h2>
          </div>
          <button type="button" className="photo-modal-icon" onClick={onClose} aria-label="Закрыть">
            <X size={20} />
          </button>
        </header>

        <div
          className="photo-modal-stage"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            touchX.current = null
          }}
        >
          {count > 1 ? (
            <button
              type="button"
              className="photo-modal-nav prev"
              onClick={() => go(-1)}
              aria-label="Предыдущее фото"
            >
              <ChevronLeft size={22} />
            </button>
          ) : null}

          <div className="photo-modal-frame" key={`${current}-${index}`}>
            <img src={current} alt={`${name} — фото ${index + 1}`} draggable={false} />
            {showingPlaceholder ? (
              <div className="photo-modal-empty" role="status">
                <p>Пока нет своих фото</p>
                <span>Добавь до {MAX_PROFILE_PHOTOS} снимков — первый станет аватаром</span>
              </div>
            ) : null}
            {canEdit && isMain ? <span className="photo-modal-badge">Аватар</span> : null}
          </div>

          {count > 1 ? (
            <button
              type="button"
              className="photo-modal-nav next"
              onClick={() => go(1)}
              aria-label="Следующее фото"
            >
              <ChevronRight size={22} />
            </button>
          ) : null}
        </div>

        {count > 1 ? (
          <div className="photo-modal-dots" role="tablist" aria-label="Фотографии">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === index}
                className={`photo-dot ${i === index ? 'active' : ''}`}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        ) : null}

        {hasPhotos ? (
          <div className="photo-modal-thumbs">
            {list.map((src, i) => (
              <button
                key={`${i}-${src.slice(0, 24)}`}
                type="button"
                className={`photo-thumb ${i === index ? 'active' : ''} ${i === 0 ? 'main' : ''}`}
                onClick={() => setIndex(i)}
              >
                <img src={src} alt="" />
              </button>
            ))}
            {canEdit && !atLimit ? (
              <button
                type="button"
                className="photo-thumb add"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                aria-label="Добавить фото"
              >
                <ImagePlus size={18} />
              </button>
            ) : null}
          </div>
        ) : null}

        {(flash || error) && (
          <p className={`photo-modal-toast ${error ? 'error' : ''}`}>{error || flash}</p>
        )}

        {canEdit ? (
          <footer className="photo-modal-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => fileRef.current?.click()}
              disabled={busy || atLimit}
            >
              <ImagePlus size={16} />
              {busy ? 'Обработка…' : atLimit ? 'Лимит 3 фото' : 'Загрузить'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleSetMain}
              disabled={!hasPhotos || isMain || busy}
            >
              <Star size={16} />В аватар
            </button>
            <button
              type="button"
              className="btn btn-danger-ghost"
              onClick={handleDelete}
              disabled={!hasPhotos || busy}
            >
              <Trash2 size={16} />
              Удалить
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*"
              hidden
              onChange={handleUpload}
            />
          </footer>
        ) : (
          <p className="photo-modal-hint muted">
            {hasPhotos
              ? `${index + 1} из ${list.length} · листай влево или вправо`
              : 'Фото скрыто или ещё не загружено'}
          </p>
        )}
      </div>
    </div>,
    document.body,
  )
}
