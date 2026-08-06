import { WEEKDAYS } from '../data/mock'
import type { VisitSlot } from '../types'
import './ScheduleEditor.css'

const DEFAULT_FROM = '19:00'
const DEFAULT_TO = '21:00'

const TIME_PRESETS = [
  { from: '07:00', to: '09:00', label: '7–9' },
  { from: '12:00', to: '14:00', label: '12–14' },
  { from: '18:00', to: '20:00', label: '18–20' },
  { from: '19:00', to: '21:00', label: '19–21' },
  { from: '20:00', to: '22:00', label: '20–22' },
] as const

export function sortVisitSlots(slots: VisitSlot[]): VisitSlot[] {
  const order = new Map(WEEKDAYS.map((d, i) => [d, i]))
  return [...slots].sort(
    (a, b) => (order.get(a.day) ?? 99) - (order.get(b.day) ?? 99),
  )
}

function slotMap(slots: VisitSlot[]) {
  const map = new Map<string, VisitSlot>()
  for (const s of slots) {
    if (WEEKDAYS.includes(s.day)) map.set(s.day, s)
  }
  return map
}

interface Props {
  value: VisitSlot[]
  onChange: (slots: VisitSlot[]) => void
  idPrefix?: string
  /** Плотнее в шите профиля */
  dense?: boolean
}

export function ScheduleEditor({ value, onChange, idPrefix = 'sched', dense }: Props) {
  const byDay = slotMap(value)
  const lastTimes = value[value.length - 1]

  const setDay = (day: string, next: VisitSlot | null) => {
    const rest = value.filter((s) => s.day !== day)
    onChange(sortVisitSlots(next ? [...rest, next] : rest))
  }

  const toggleDay = (day: string) => {
    if (byDay.has(day)) {
      setDay(day, null)
      return
    }
    setDay(day, {
      day,
      from: lastTimes?.from || DEFAULT_FROM,
      to: lastTimes?.to || DEFAULT_TO,
    })
  }

  return (
    <div className={`schedule-editor ${dense ? 'dense' : ''}`}>
      {WEEKDAYS.map((day) => {
        const slot = byDay.get(day)
        const on = Boolean(slot)
        const fromId = `${idPrefix}-${day}-from`
        const toId = `${idPrefix}-${day}-to`
        return (
          <div key={day} className={`schedule-day ${on ? 'on' : ''}`}>
            <button
              type="button"
              className={`schedule-day-btn ${on ? 'active' : ''}`}
              onClick={() => toggleDay(day)}
              aria-pressed={on}
            >
              {day}
            </button>
            {on && slot ? (
              <div className="schedule-day-body">
                <div className="schedule-presets" role="group" aria-label={`${day}, быстрое время`}>
                  {TIME_PRESETS.map((p) => {
                    const active = slot.from === p.from && slot.to === p.to
                    return (
                      <button
                        key={p.label}
                        type="button"
                        className={`chip ${active ? 'active' : ''}`}
                        onClick={() => setDay(day, { day, from: p.from, to: p.to })}
                      >
                        {p.label}
                      </button>
                    )
                  })}
                </div>
                <div className="schedule-day-times">
                  <label className="schedule-time-box" htmlFor={fromId}>
                    <input
                      id={fromId}
                      type="time"
                      value={slot.from}
                      aria-label={`${day}, с`}
                      onChange={(e) => setDay(day, { ...slot, from: e.target.value })}
                    />
                  </label>
                  <span className="schedule-day-sep" aria-hidden>
                    –
                  </span>
                  <label className="schedule-time-box" htmlFor={toId}>
                    <input
                      id={toId}
                      type="time"
                      value={slot.to}
                      aria-label={`${day}, до`}
                      onChange={(e) => setDay(day, { ...slot, to: e.target.value })}
                    />
                  </label>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="schedule-day-empty"
                onClick={() => toggleDay(day)}
              >
                не хожу
              </button>
            )}
          </div>
        )
      })}
      {!value.length ? (
        <p className="dim schedule-editor-hint">Нажми день — и выбери время</p>
      ) : null}
    </div>
  )
}
