import { useRef } from 'react'
import { useSheetA11y } from '../lib/sheetA11y'
import { WORKOUT_FELT_OPTIONS, type WorkoutFelt } from '../lib/workouts'

export function WorkoutFeltSheet({
  open,
  value,
  onSelect,
  onClose,
}: {
  open: boolean
  value: WorkoutFelt | null
  onSelect: (felt: WorkoutFelt) => void
  onClose: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  useSheetA11y(open, onClose, panelRef)

  if (!open) return null

  return (
    <div className="app-sheet" role="dialog" aria-modal="true" aria-labelledby="workout-felt-title">
      <button type="button" className="app-sheet-backdrop" aria-label="Закрыть" onClick={onClose} />
      <div className="app-sheet-panel" ref={panelRef}>
        <div className="app-sheet-grab" aria-hidden />
        <h3 id="workout-felt-title">Как прошла тренировка?</h3>
        <div className="seg seg--fill" role="radiogroup" aria-labelledby="workout-felt-title">
          {WORKOUT_FELT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={value === opt.id}
              className={`seg-item${value === opt.id ? ' is-active' : ''}`}
              onClick={() => onSelect(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
