import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { CITIES_META, type CityMeta } from '../data/mock'
import { searchFieldProps } from '../lib/inputAttrs'
import { useSheetA11y } from '../lib/sheetA11y'
import './CityCarousel.css'

const PREVIEW_LIMIT = 12

function byGymCountDesc(a: CityMeta, b: CityMeta) {
  if (b.gymCount !== a.gymCount) return b.gymCount - a.gymCount
  return a.name.localeCompare(b.name, 'ru')
}

interface Props {
  value: string
  onChange: (city: string) => void
  label?: string
  hint?: string
  /**
   * full — карточка-селектор («Все») + быстрая лента чипов
   * compact — только лента + «Ещё» (каталог залов)
   */
  variant?: 'full' | 'compact'
  /** Контент сразу под лентой городов */
  afterStrip?: ReactNode
}

export function CityCarousel({
  value,
  onChange,
  label = 'Город',
  hint,
  variant = 'full',
  afterStrip,
}: Props) {
  const [query, setQuery] = useState('')
  const [allOpen, setAllOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  const closeAll = useCallback(() => setAllOpen(false), [])
  useSheetA11y(allOpen, closeAll, panelRef, undefined, { autoFocus: false })

  useEffect(() => {
    if (!allOpen) setQuery('')
  }, [allOpen])

  const selected = CITIES_META.find((c) => c.name === value)

  const citiesByGymCount = useMemo(
    () => [...CITIES_META].sort(byGymCountDesc),
    [],
  )

  const previewCities = useMemo(() => {
    const base = citiesByGymCount.slice(0, PREVIEW_LIMIT)
    if (value && !base.some((c) => c.name === value)) {
      const current = CITIES_META.find((c) => c.name === value)
      if (current) return [current, ...base.filter((c) => c.name !== value).slice(0, PREVIEW_LIMIT - 1)]
    }
    return base
  }, [citiesByGymCount, value])

  const allCities = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return citiesByGymCount
    return citiesByGymCount.filter((c) => c.name.toLowerCase().includes(q))
  }, [citiesByGymCount, query])

  /**
   * Lock sheet size once on open. Do NOT follow visualViewport — resizing/transforming
   * the sheet while the search input is focused dismisses the iOS PWA keyboard and
   * makes the curtain jump with the keyboard.
   */
  useEffect(() => {
    const root = document.documentElement
    const sheet = sheetRef.current
    if (!allOpen || !sheet) {
      root.removeAttribute('data-city-sheet')
      return
    }
    root.setAttribute('data-city-sheet', 'open')
    const h = window.innerHeight
    sheet.style.height = `${h}px`
    sheet.style.maxHeight = `${h}px`
    sheet.style.transform = ''
    return () => {
      sheet.style.height = ''
      sheet.style.maxHeight = ''
      sheet.style.transform = ''
      root.removeAttribute('data-city-sheet')
    }
  }, [allOpen])

  const pick = (city: string) => {
    onChange(city)
    setAllOpen(false)
    setQuery('')
  }

  const openAll = () => setAllOpen(true)

  return (
    <section
      className={`city-picker ${variant === 'compact' ? 'city-picker--compact' : 'city-picker--full'}`}
      aria-label={label}
    >
      {variant === 'full' ? (
        <button type="button" className="city-picker-current" onClick={openAll}>
          <span className="city-picker-current-text">
            <span className="city-picker-label">{label}</span>
            <span className="city-picker-title">{value || 'Выбери город'}</span>
            <span className="muted city-picker-hint">
              {selected
                ? `${selected.gymCount} клубов · нажми, чтобы сменить`
                : hint || 'Выбери город из списка'}
            </span>
          </span>
          <span className="city-picker-more">
            Все
            <ChevronDown size={16} />
          </span>
        </button>
      ) : null}

      <div className="city-strip" role="listbox" aria-label="Города по числу клубов">
        {previewCities.map((city) => (
          <button
            key={city.name}
            type="button"
            role="option"
            aria-selected={city.name === value}
            className={`city-chip ${city.name === value ? 'active' : ''}`}
            onClick={() => pick(city.name)}
          >
            <span className="city-chip-name">{city.name}</span>
          </button>
        ))}
        {variant === 'compact' ? (
          <button type="button" className="city-chip city-chip-more" onClick={openAll}>
            <span className="city-chip-name">Ещё</span>
            <ChevronDown size={14} aria-hidden />
          </button>
        ) : null}
      </div>

      {afterStrip}

      {allOpen ? (
        <div
          ref={sheetRef}
          className="city-sheet"
          role="dialog"
          aria-modal="true"
          aria-label="Все города"
        >
          <button
            type="button"
            className="city-sheet-backdrop"
            aria-label="Закрыть"
            onClick={closeAll}
          />
          <div className="city-sheet-panel" ref={panelRef}>
            <div className="city-sheet-chrome">
              <div className="city-sheet-top">
                <div>
                  <p className="city-picker-label">Все города</p>
                  <h3>Выбери город</h3>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Закрыть список"
                  onClick={closeAll}
                >
                  <X size={18} />
                </button>
              </div>

              <label className="city-search">
                <Search size={16} aria-hidden />
                <input
                  {...searchFieldProps}
                  type="text"
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Найти город"
                  aria-label="Поиск города"
                />
              </label>
            </div>

            <div className="city-sheet-list">
              {allCities.map((city) => (
                <CityRow
                  key={city.name}
                  city={city}
                  active={city.name === value}
                  onSelect={() => pick(city.name)}
                />
              ))}
              {!allCities.length ? (
                <div className="city-empty">Город не найден. Попробуй другое написание.</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function CityRow({
  city,
  active,
  onSelect,
}: {
  city: CityMeta
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      className={`city-row ${active ? 'active' : ''}`}
      onClick={onSelect}
    >
      <span>
        <strong>{city.name}</strong>
        <span className="dim city-row-nets">
          {city.networks.map((n) => n.replace(' Fitness', '').replace('. Fitness', '')).join(' · ')}
        </span>
      </span>
      <span className="city-row-count">{city.gymCount}</span>
    </button>
  )
}
