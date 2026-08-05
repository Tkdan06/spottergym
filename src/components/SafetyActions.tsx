import { type FormEvent, useEffect, useRef, useState } from 'react'
import { Ban, Flag, MoreHorizontal } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/useApp'
import { displayName } from '../data/mock'
import { REPORT_NOTE_MAX } from '../lib/fieldLimits'
import { messageFieldProps } from '../lib/inputAttrs'
import { REPORT_REASONS, type ReportReasonId } from '../lib/userBlocks'
import type { UserProfile } from '../types'
import './SafetyActions.css'

interface Props {
  person: UserProfile
}

export function SafetyActions({ person }: Props) {
  const { user, blockUser, unblockUser, reportUser, isBlocked } = useApp()
  const navigate = useNavigate()
  const rootRef = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mode, setMode] = useState<'idle' | 'block' | 'report'>('idle')
  const [reason, setReason] = useState<ReportReasonId>('spam')
  const [note, setNote] = useState('')
  const [done, setDone] = useState<'blocked' | 'reported' | ''>('')
  const [error, setError] = useState('')

  const blocked = user ? isBlocked(person.id) : false
  const name = displayName(person)

  useEffect(() => {
    if (!menuOpen) return
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const el = rootRef.current
      if (el && !el.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('touchstart', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('touchstart', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  useEffect(() => {
    if (mode !== 'block' && mode !== 'report') return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMode('idle')
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [mode])

  if (!user || person.id === user.id) return null

  const openBlock = () => {
    setMenuOpen(false)
    setMode('block')
  }

  const openReport = () => {
    setMenuOpen(false)
    setMode('report')
  }

  const onBlock = () => {
    void (async () => {
      try {
        await blockUser(person.id)
        setDone('blocked')
        setMode('idle')
        navigate('/app', { replace: true })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось заблокировать')
      }
    })()
  }

  const onUnblock = () => {
    setMenuOpen(false)
    void (async () => {
      try {
        await unblockUser(person.id)
        setDone('')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось разблокировать')
      }
    })()
  }

  const onReport = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const ticket = await reportUser(person.id, reason, note)
      setDone('reported')
      setMode('idle')
      setNote('')
      navigate(`/app/feedback/${ticket.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить жалобу')
    }
  }

  return (
    <div className="safety-actions" ref={rootRef}>
      <button
        type="button"
        className="icon-btn safety-menu-trigger"
        aria-label="Ещё действия"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
      >
        <MoreHorizontal size={20} />
      </button>

      {menuOpen ? (
        <div className="safety-menu" role="menu" aria-label="Действия безопасности">
          {blocked ? (
            <button type="button" className="safety-menu-item" role="menuitem" onClick={onUnblock}>
              <Ban size={16} />
              Разблокировать
            </button>
          ) : (
            <button type="button" className="safety-menu-item" role="menuitem" onClick={openBlock}>
              <Ban size={16} />
              Заблокировать
            </button>
          )}
          <button type="button" className="safety-menu-item" role="menuitem" onClick={openReport}>
            <Flag size={16} />
            Пожаловаться
          </button>
        </div>
      ) : null}

      {done === 'reported' ? (
        <p className="dim safety-note">Жалоба отправлена в поддержку</p>
      ) : null}
      {error ? <p className="safety-error">{error}</p> : null}

      {mode === 'block' ? (
        <div className="safety-sheet" role="dialog" aria-modal="true" aria-label="Блокировка">
          <button
            type="button"
            className="safety-sheet-backdrop"
            aria-label="Закрыть"
            onClick={() => setMode('idle')}
          />
          <div className="safety-sheet-panel">
            <div className="safety-sheet-grab" aria-hidden />
            <h3>Заблокировать {name}?</h3>
            <p className="muted">
              Профиль исчезнет из зала и из чатов. Разблокировать можно в настройках.
            </p>
            <button type="button" className="btn btn-danger btn-block" onClick={onBlock}>
              Заблокировать
            </button>
            <button type="button" className="btn btn-ghost btn-block" onClick={() => setMode('idle')}>
              Отмена
            </button>
          </div>
        </div>
      ) : null}

      {mode === 'report' ? (
        <div className="safety-sheet" role="dialog" aria-modal="true" aria-label="Жалоба">
          <button
            type="button"
            className="safety-sheet-backdrop"
            aria-label="Закрыть"
            onClick={() => setMode('idle')}
          />
          <form className="safety-sheet-panel" onSubmit={onReport}>
            <div className="safety-sheet-grab" aria-hidden />
            <h3>Жалоба на {name}</h3>
            <p className="muted">Уйдёт в поддержку как обращение по безопасности.</p>
            <div className="chip-grid">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`chip ${reason === r.id ? 'active' : ''}`}
                  onClick={() => setReason(r.id)}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <label className="field">
              <span>Комментарий (необязательно)</span>
              <textarea
                {...messageFieldProps}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Коротко, что произошло"
                maxLength={REPORT_NOTE_MAX}
              />
            </label>
            <button type="submit" className="btn btn-primary btn-block">
              Отправить жалобу
            </button>
            <button type="button" className="btn btn-ghost btn-block" onClick={() => setMode('idle')}>
              Отмена
            </button>
          </form>
        </div>
      ) : null}
    </div>
  )
}
