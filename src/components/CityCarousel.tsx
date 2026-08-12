import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
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
  /** Search stays inert until the user taps it — avoids iOS autofocus + keyboard */
  const [searchActive, setSearchActive] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useSheetA11y(allOpen, () => setAllOpen(false), panelRef, undefined, { autoFocus: false })

  useEffect(() => {
    if (!allOpen) {
      setSearchActive(false)
      setQuery('')
    }
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

  /** Viewport height for the sheet only — ignore keyboard inset until search is active */
  useEffect(() => {
    const root = document.documentElement
    if (!allOpen) {
      root.removeAttribute('data-city-sheet')
      root.style.removeProperty('--city-sheet-kb')
      root.style.removeProperty('--city-sheet-vh')
      return
    }
    root.setAttribute('data-city-sheet', 'open')
    const sync = () => {
      const vv = window.visualViewport
      if (!vv) {
        root.style.setProperty('--city-sheet-vh', `${window.innerHeight}px`)
        root.style.setProperty('--city-sheet-kb', '0px')
        return
      }
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      root.style.setProperty('--city-sheet-vh', `${vv.height}px`)
      // Only shrink for keyboard when the user opened search
      root.style.setProperty('--city-sheet-kb', `${searchActive && kb > 40 ? kb : 0}px`)
    }
    sync()
    const vv = window.visualViewport
    vv?.addEventListener('resize', sync)
    vv?.addEventListener('scroll', sync)
    window.addEventListener('resize', sync)
    return () => {
      vv?.removeEventListener('resize', sync)
      vv?.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
      root.removeAttribute('data-city-sheet')
      root.style.removeProperty('--city-sheet-kb')
      root.style.removeProperty('--city-sheet-vh')
    }
  }, [allOpen, searchActive])

  const pick = (city: string) => {
    onChange(city)
    setAllOpen(false)
    setQuery('')
    setSearchActive(false)
  }

  const openAll = () => setAllOpen(true)

  const activateSearch = () => {
    if (searchActive) return
    setSearchActive(true)
    window.setTimeout(() => searchRef.current?.focus({ preventScroll: true }), 0)
  }

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
        <div className="city-sheet" role="dialog" aria-modal="true" aria-label="Все города">
          <button
            type="button"
            className="city-sheet-backdrop"
            aria-label="Закрыть"
            onClick={() => setAllOpen(false)}
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
                  onClick={() => setAllOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <label className="city-search" onPointerDown={activateSearch}>
                <Search size={16} />
                <input
                  {...searchFieldProps}
                  ref={searchRef}
                  value={query}
                  readOnly={!searchActive}
                  inputMode={searchActive ? 'search' : 'none'}
                  tabIndex={searchActive ? 0 : -1}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => {
                    if (!searchActive) {
                      searchRef.current?.blur()
                    }
                  }}
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
