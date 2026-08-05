import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { VisitSlot } from '../types'
import { ScheduleEditor, sortVisitSlots } from './ScheduleEditor'
import './ScheduleSheet.css'

interface Props {
  open: boolean
  initialSlots: VisitSlot[]
  onClose: () => void
  onSave: (slots: VisitSlot[]) => void
}

export function ScheduleSheet({ open, initialSlots, onClose, onSave }: Props) {
  const [slots, setSlots] = useState<VisitSlot[]>(() => sortVisitSlots(initialSlots))

  useEffect(() => {
    if (!open) return
    setSlots(sortVisitSlots(initialSlots))
  }, [open, initialSlots])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="schedule-sheet" role="presentation">
      <button
        type="button"
        className="schedule-sheet-backdrop"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <div
        className="schedule-sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-sheet-title"
      >
        <header className="schedule-sheet-top">
          <h2 id="schedule-sheet-title">Расписание</h2>
          <button type="button" className="schedule-sheet-close" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </header>

        <div className="schedule-sheet-body">
          <ScheduleEditor dense value={slots} onChange={setSlots} idPrefix="sheet" />
        </div>

        <footer className="schedule-sheet-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              onSave(sortVisitSlots(slots))
              onClose()
            }}
          >
            Сохранить
          </button>
        </footer>
      </div>
    </div>
  )
}
