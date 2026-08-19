import { useEffect, useMemo, useRef, useState } from 'react'
import { useSheetA11y } from '../lib/sheetA11y'
import './WeightKgSheet.css'

export const BODY_WEIGHT_MIN_KG = 30
export const BODY_WEIGHT_MAX_KG = 250

const ITEM_H = 44
const VISIBLE = 5

type Props = {
  open: boolean
  value: number | null
  onClose: () => void
  onConfirm: (kg: number | null) => void
}

function clampKg(n: number) {
  return Math.min(BODY_WEIGHT_MAX_KG, Math.max(BODY_WEIGHT_MIN_KG, Math.round(n)))
}

function buildValues() {
  const out: number[] = []
  for (let kg = BODY_WEIGHT_MIN_KG; kg <= BODY_WEIGHT_MAX_KG; kg += 1) out.push(kg)
  return out
}

export function WeightKgSheet({ open, value, onClose, onConfirm }: Props) {
  const values = useMemo(() => buildValues(), [])
  const panelRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState(() =>
    value != null ? clampKg(value) : 70,
  )
  const scrolling = useRef(false)
  const settleTimer = useRef(0)

  useSheetA11y(open, onClose, panelRef, undefined, { autoFocus: false })

  useEffect(() => {
    if (!open) return
    const initial = value != null ? clampKg(value) : 70
    setDraft(initial)
    const idx = values.indexOf(initial)
    const el = listRef.current
    if (!el || idx < 0) return
    requestAnimationFrame(() => {
      el.scrollTop = idx * ITEM_H
    })
  }, [open, value, values])

  const snapToNearest = () => {
    const el = listRef.current
    if (!el) return
    const idx = Math.round(el.scrollTop / ITEM_H)
    const safe = Math.min(values.length - 1, Math.max(0, idx))
    const kg = values[safe]
    setDraft(kg)
    const target = safe * ITEM_H
    if (Math.abs(el.scrollTop - target) > 0.5) {
      el.scrollTo({ top: target, behavior: 'smooth' })
    }
  }

  const onScroll = () => {
    scrolling.current = true
    window.clearTimeout(settleTimer.current)
    settleTimer.current = window.setTimeout(() => {
      scrolling.current = false
      snapToNearest()
    }, 80)
  }

  if (!open) return null

  const pad = Math.floor(VISIBLE / 2)

  return (
    <div className="weight-kg-sheet" role="presentation">
      <button
        type="button"
        className="weight-kg-sheet-backdrop"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="weight-kg-sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Твой вес"
      >
        <div className="weight-kg-sheet-grab" aria-hidden />
        <h3>Твой вес</h3>
        <p className="muted weight-kg-sheet-lead">Выбери значение в килограммах</p>

        <div className="weight-kg-wheel" style={{ height: ITEM_H * VISIBLE }}>
          <div className="weight-kg-wheel-fade weight-kg-wheel-fade-top" aria-hidden />
          <div className="weight-kg-wheel-fade weight-kg-wheel-fade-bottom" aria-hidden />
          <div className="weight-kg-wheel-highlight" aria-hidden />
          <div
            ref={listRef}
            className="weight-kg-wheel-list"
            onScroll={onScroll}
            role="listbox"
            aria-label="Килограммы"
          >
            <div style={{ height: ITEM_H * pad }} aria-hidden />
            {values.map((kg) => (
              <button
                key={kg}
                type="button"
                role="option"
                aria-selected={kg === draft}
                className={`weight-kg-wheel-item ${kg === draft ? 'is-active' : ''}`}
                style={{ height: ITEM_H }}
                onClick={() => {
                  setDraft(kg)
                  const idx = values.indexOf(kg)
                  listRef.current?.scrollTo({ top: idx * ITEM_H, behavior: 'smooth' })
                }}
              >
                {kg}
              </button>
            ))}
            <div style={{ height: ITEM_H * pad }} aria-hidden />
          </div>
          <span className="weight-kg-wheel-unit" aria-hidden>
            кг
          </span>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => onConfirm(draft)}
        >
          Готово · {draft} кг
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-block"
          onClick={() => onConfirm(null)}
        >
          Не указывать
        </button>
      </div>
    </div>
  )
}
