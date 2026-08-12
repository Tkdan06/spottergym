import { useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SlidersHorizontal, X } from 'lucide-react'
import { EXPERIENCE_LEVELS } from '../data/mock'
import { useSheetA11y } from '../lib/sheetA11y'
import type { ExperienceLevel, Gender } from '../types'
import './FloorFilters.css'

export type IntentFilter = 'all' | 'active' | 'dating' | 'buddy' | 'coach'
export type GenderFilter = 'all' | Gender
export type AgeFilter = 'all' | '18-24' | '25-34' | '35-44' | '45+'
export type LevelFilter = 'all' | ExperienceLevel

const QUICK_INTENTS: { value: IntentFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'active', label: 'В зале' },
  { value: 'coach', label: 'Тренеры' },
  { value: 'dating', label: 'Знакомства' },
  { value: 'buddy', label: 'Партнёры' },
]

const GENDERS: { value: GenderFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'male', label: 'Парни' },
  { value: 'female', label: 'Девушки' },
]

const AGES: { value: AgeFilter; label: string }[] = [
  { value: 'all', label: 'Любой' },
  { value: '18-24', label: '18–24' },
  { value: '25-34', label: '25–34' },
  { value: '35-44', label: '35–44' },
  { value: '45+', label: '45+' },
]

const LEVELS: { value: LevelFilter; label: string }[] = [
  { value: 'all', label: 'Любой' },
  ...EXPERIENCE_LEVELS.map((level) => ({ value: level.value, label: level.label })),
]

const GENDER_SHORT: Record<Exclude<GenderFilter, 'all'>, string> = {
  male: 'Парни',
  female: 'Девушки',
}

const LEVEL_SHORT: Record<Exclude<LevelFilter, 'all'>, string> = {
  newbie: 'Новичок',
  confident: 'Уверенный',
  experienced: 'Опытный',
  pro: 'Профи',
}

type Props = {
  intent: IntentFilter
  gender: GenderFilter
  age: AgeFilter
  level: LevelFilter
  onIntentChange: (value: IntentFilter) => void
  onGenderChange: (value: GenderFilter) => void
  onAgeChange: (value: AgeFilter) => void
  onLevelChange: (value: LevelFilter) => void
}

export function FloorFilters({
  intent,
  gender,
  age,
  level,
  onIntentChange,
  onGenderChange,
  onAgeChange,
  onLevelChange,
}: Props) {
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useSheetA11y(open, () => setOpen(false), panelRef)

  const extraCount =
    Number(gender !== 'all') + Number(age !== 'all') + Number(level !== 'all')

  const activeTags = useMemo(() => {
    const tags: { key: string; label: string; clear: () => void }[] = []
    if (gender !== 'all') {
      tags.push({
        key: 'gender',
        label: GENDER_SHORT[gender],
        clear: () => onGenderChange('all'),
      })
    }
    if (age !== 'all') {
      tags.push({
        key: 'age',
        label: age,
        clear: () => onAgeChange('all'),
      })
    }
    if (level !== 'all') {
      tags.push({
        key: 'level',
        label: LEVEL_SHORT[level],
        clear: () => onLevelChange('all'),
      })
    }
    return tags
  }, [gender, age, level, onGenderChange, onAgeChange, onLevelChange])

  const resetExtras = () => {
    onGenderChange('all')
    onAgeChange('all')
    onLevelChange('all')
  }

  return (
    <div className="floor-filters">
      <div className="floor-filters-bar">
        <button
          type="button"
          className={`floor-filter-trigger ${extraCount ? 'active' : ''}`}
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <SlidersHorizontal size={16} />
          <span>Ещё</span>
          {extraCount ? <i className="floor-filter-badge">{extraCount}</i> : null}
        </button>

        <div className="floor-filters-scroll" role="toolbar" aria-label="Быстрые фильтры">
          {QUICK_INTENTS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`chip ${intent === item.value ? 'active' : ''}`}
              onClick={() => onIntentChange(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {activeTags.length ? (
        <div className="floor-filter-tags">
          {activeTags.map((tag) => (
            <button
              key={tag.key}
              type="button"
              className="floor-filter-tag"
              onClick={tag.clear}
              aria-label={`Сбросить: ${tag.label}`}
            >
              {tag.label}
              <X size={12} />
            </button>
          ))}
          <button type="button" className="floor-filter-clear" onClick={resetExtras}>
            Сбросить
          </button>
        </div>
      ) : null}

      {open
        ? createPortal(
            <div className="floor-sheet" role="presentation">
              <button
                type="button"
                className="floor-sheet-backdrop"
                aria-label="Закрыть"
                onClick={() => setOpen(false)}
              />
              <div
                ref={panelRef}
                className="floor-sheet-panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
              >
                <header className="floor-sheet-top">
                  <div>
                    <p className="floor-sheet-kicker">Зал</p>
                    <h3 id={titleId}>Фильтры</h3>
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setOpen(false)}
                    aria-label="Закрыть"
                  >
                    <X size={18} />
                  </button>
                </header>

                <div className="floor-sheet-body">
                  <section className="floor-sheet-section">
                    <h4>Пол</h4>
                    <div className="chip-grid">
                      {GENDERS.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          className={`chip ${gender === item.value ? 'active' : ''}`}
                          onClick={() => onGenderChange(item.value)}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="floor-sheet-section">
                    <h4>Возраст</h4>
                    <div className="chip-grid">
                      {AGES.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          className={`chip ${age === item.value ? 'active' : ''}`}
                          onClick={() => onAgeChange(item.value)}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="floor-sheet-section">
                    <h4>Уровень</h4>
                    <p className="muted">Подготовка в зале — удобно искать партнёра «своего» уровня</p>
                    <div className="chip-grid">
                      {LEVELS.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          className={`chip ${level === item.value ? 'active' : ''}`}
                          onClick={() => onLevelChange(item.value)}
                          title={
                            EXPERIENCE_LEVELS.find((l) => l.value === item.value)?.hint
                          }
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </section>
                </div>

                <footer className="floor-sheet-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={resetExtras}
                    disabled={!extraCount}
                  >
                    Сбросить
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setOpen(false)}
                  >
                    Готово
                  </button>
                </footer>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

export function matchesAge(age: number, filter: AgeFilter) {
  if (filter === 'all') return true
  if (filter === '18-24') return age >= 18 && age <= 24
  if (filter === '25-34') return age >= 25 && age <= 34
  if (filter === '35-44') return age >= 35 && age <= 44
  return age >= 45
}
