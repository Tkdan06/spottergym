import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { CITIES_META, type CityMeta } from '../data/mock'
import { searchFieldProps } from '../lib/inputAttrs'
import './CityCarousel.css'

/** Горизонтальная лента (каталог) — чуть больше, скролл ок */
const STRIP_PREVIEW_LIMIT = 12
/**
 * Сетка быстрых городов: 6 + «Ещё».
 * Hick’s law / Material chips: 5–7 ярлыков комфортны, 2 ряда × 3 не перегружают.
 */
const GRID_PREVIEW_LIMIT = 6

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
   * full — карточка-селектор + быстрые города (онбординг / настройки)
   * compact — только быстрые города (каталог залов)
   */
  variant?: 'full' | 'compact'
  /**
   * strip — горизонтальный скролл
   * grid — 2–3 ряда кнопок (для онбординга)
   */
  quickLayout?: 'strip' | 'grid'
  /** Контент сразу под блоком быстрых городов */
  afterStrip?: ReactNode
}

export function CityCarousel({
  value,
  onChange,
  label = 'Город',
  hint,
  variant = 'full',
  quickLayout = 'strip',
  afterStrip,
}: Props) {
  const [query, setQuery] = useState('')
  const [allOpen, setAllOpen] = useState(false)

  const selected = CITIES_META.find((c) => c.name === value)
  const layout = quickLayout
  const previewLimit = layout === 'grid' ? GRID_PREVIEW_LIMIT : STRIP_PREVIEW_LIMIT

  const citiesByGymCount = useMemo(
    () => [...CITIES_META].sort(byGymCountDesc),
    [],
  )

  const previewCities = useMemo(() => {
    const base = citiesByGymCount.slice(0, previewLimit)
    if (value && !base.some((c) => c.name === value)) {
      const current = CITIES_META.find((c) => c.name === value)
      if (current) return [current, ...base.filter((c) => c.name !== value).slice(0, previewLimit - 1)]
    }
    return base
  }, [citiesByGymCount, previewLimit, value])

  const allCities = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return citiesByGymCount
    return citiesByGymCount.filter((c) => c.name.toLowerCase().includes(q))
  }, [citiesByGymCount, query])

  useEffect(() => {
    if (!allOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAllOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [allOpen])

  const pick = (city: string) => {
    onChange(city)
    setAllOpen(false)
    setQuery('')
  }

  const openAll = () => setAllOpen(true)

  const showMeta = variant === 'full' || layout === 'grid'

  return (
    <section
      className={`city-picker ${variant === 'compact' ? 'city-picker--compact' : ''} ${
        layout === 'grid' ? 'city-picker--grid' : ''
      }`}
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

      <div
        className={layout === 'grid' ? 'city-quick-grid' : 'city-strip'}
        role="listbox"
        aria-label="Города по числу клубов"
      >
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
            {showMeta ? <span className="city-chip-meta">{city.gymCount}</span> : null}
          </button>
        ))}
        <button
          type="button"
          className={`city-chip city-chip-more${layout === 'grid' ? ' city-chip-more--grid' : ''}`}
          onClick={openAll}
        >
          <span className="city-chip-name">Ещё города</span>
          <ChevronDown size={14} aria-hidden />
        </button>
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
          <div className="city-sheet-panel">
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

            <label className="city-search">
              <Search size={16} />
              <input
                {...searchFieldProps}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Найти город"
                aria-label="Поиск города"
              />
            </label>

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
