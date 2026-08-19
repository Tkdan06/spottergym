import { useEffect, useMemo, useRef, useState } from 'react'
import { useSheetA11y } from '../lib/sheetA11y'
import './WeightKgSheet.css'
import './SetWeightSheet.css'

export const BAR_WEIGHT_MIN_KG = 1
export const BAR_WEIGHT_MAX_KG = 300
export const EXERCISE_NAME_MAX = 60
export const WORKOUT_TITLE_MAX = 40
export const MAX_SETS_PER_EXERCISE = 6
export const MAX_EXERCISES_PER_WORKOUT = 10

const FRACS = [0, 0.1, 0.2, 0.3, 0.4, 0.5] as const
const ITEM_H = 44
const VISIBLE = 5

type Props = {
  open: boolean
  value: number | null
  onClose: () => void
  onConfirm: (kg: number) => void
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

function splitKg(raw: number | null): { whole: number; frac: number } {
  if (raw == null || !Number.isFinite(raw)) {
    return { whole: 20, frac: 0.5 }
  }
  const clamped = Math.min(BAR_WEIGHT_MAX_KG, Math.max(BAR_WEIGHT_MIN_KG, raw))
  const whole = Math.min(BAR_WEIGHT_MAX_KG, Math.max(BAR_WEIGHT_MIN_KG, Math.floor(clamped)))
  let frac = round1(clamped - Math.floor(clamped))
  if (frac > 0.5) {
    // Snap odd decimals (e.g. 0.75 from old data) to nearest allowed
    frac = 0.5
  }
  const nearest = FRACS.reduce((best, f) => (Math.abs(f - frac) < Math.abs(best - frac) ? f : best), 0)
  return { whole, frac: nearest }
}

function combine(whole: number, frac: number) {
  const total = round1(whole + frac)
  return Math.min(BAR_WEIGHT_MAX_KG, Math.max(BAR_WEIGHT_MIN_KG, total))
}

export function formatBarWeight(kg: number) {
  const n = round1(kg)
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

function WheelColumn({
  values,
  value,
  label,
  format = (n: number) => String(n),
  onChange,
}: {
  values: number[]
  value: number
  label: string
  format?: (n: number) => string
  onChange: (n: number) => void
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const settleTimer = useRef(0)
  const pad = Math.floor(VISIBLE / 2)

  useEffect(() => {
    const idx = values.indexOf(value)
    const el = listRef.current
    if (!el || idx < 0) return
    requestAnimationFrame(() => {
      el.scrollTop = idx * ITEM_H
    })
  }, [values, value])

  const snap = () => {
    const el = listRef.current
    if (!el) return
    const idx = Math.min(values.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)))
    const next = values[idx]
    onChange(next)
    const target = idx * ITEM_H
    if (Math.abs(el.scrollTop - target) > 0.5) {
      el.scrollTo({ top: target, behavior: 'smooth' })
    }
  }

  return (
    <div className="set-weight-col" aria-label={label}>
      <div className="set-weight-col-label muted">{label}</div>
      <div className="weight-kg-wheel set-weight-wheel" style={{ height: ITEM_H * VISIBLE }}>
        <div className="weight-kg-wheel-fade weight-kg-wheel-fade-top" aria-hidden />
        <div className="weight-kg-wheel-fade weight-kg-wheel-fade-bottom" aria-hidden />
        <div className="weight-kg-wheel-highlight" aria-hidden />
        <div
          ref={listRef}
          className="weight-kg-wheel-list"
          onScroll={() => {
            window.clearTimeout(settleTimer.current)
            settleTimer.current = window.setTimeout(snap, 80)
          }}
          role="listbox"
          aria-label={label}
        >
          <div style={{ height: ITEM_H * pad }} aria-hidden />
          {values.map((n) => (
            <button
              key={n}
              type="button"
              role="option"
              aria-selected={n === value}
              className={`weight-kg-wheel-item ${n === value ? 'is-active' : ''}`}
              style={{ height: ITEM_H }}
              onClick={() => {
                onChange(n)
                const idx = values.indexOf(n)
                listRef.current?.scrollTo({ top: idx * ITEM_H, behavior: 'smooth' })
              }}
            >
              {format(n)}
            </button>
          ))}
          <div style={{ height: ITEM_H * pad }} aria-hidden />
        </div>
      </div>
    </div>
  )
}

export function SetWeightSheet({ open, value, onClose, onConfirm }: Props) {
  const wholes = useMemo(() => {
    const out: number[] = []
    for (let kg = BAR_WEIGHT_MIN_KG; kg <= BAR_WEIGHT_MAX_KG; kg += 1) out.push(kg)
    return out
  }, [])
  const fracs = useMemo(() => [...FRACS], [])
  const panelRef = useRef<HTMLDivElement>(null)
  const [whole, setWhole] = useState(20)
  const [frac, setFrac] = useState(0.5)

  useSheetA11y(open, onClose, panelRef, undefined, { autoFocus: false })

  useEffect(() => {
    if (!open) return
    const split = splitKg(value)
    // Default fraction to 0.5 when opening a fresh/empty set
    if (value == null) {
      setWhole(20)
      setFrac(0.5)
    } else {
      setWhole(split.whole)
      setFrac(split.frac)
    }
  }, [open, value])

  if (!open) return null

  const total = combine(whole, frac)

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
        aria-label="Вес на штанге"
      >
        <div className="weight-kg-sheet-grab" aria-hidden />
        <h3>Вес</h3>
        <p className="muted weight-kg-sheet-lead">Килограммы и доли — по умолчанию +0,5</p>

        <div className="set-weight-dual">
          <WheelColumn
            values={wholes}
            value={whole}
            label="кг"
            onChange={(n) => {
              // Keep total ≤ 300 when frac pushes over
              const next = combine(n, frac)
              if (next > BAR_WEIGHT_MAX_KG) {
                setWhole(BAR_WEIGHT_MAX_KG)
                setFrac(0)
              } else {
                setWhole(n)
              }
            }}
          />
          <WheelColumn
            values={fracs}
            value={frac}
            label="доля"
            format={(n) => (n === 0 ? '0' : n.toFixed(1))}
            onChange={(n) => {
              if (whole >= BAR_WEIGHT_MAX_KG && n > 0) {
                setFrac(0)
                return
              }
              setFrac(n)
            }}
          />
        </div>

        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => onConfirm(total)}
        >
          Готово · {formatBarWeight(total)} кг
        </button>
        <button type="button" className="btn btn-ghost btn-block" onClick={onClose}>
          Отмена
        </button>
      </div>
    </div>
  )
}
