import type { ElsewhereSuggestion } from '../lib/elsewhereGyms'
import './ElsewhereGymBanner.css'

type Props = {
  suggestions: ElsewhereSuggestion[]
  onSwitchCity: (city: string) => void
}

export function ElsewhereGymBanner({ suggestions, onSwitchCity }: Props) {
  if (!suggestions.length) return null

  return (
    <div className="elsewhere-banner" role="status">
      <p className="elsewhere-banner-title">Нашли клуб в другом городе</p>
      <ul className="elsewhere-banner-list">
        {suggestions.map(({ city, gym, moreInCity }) => (
          <li key={city} className="elsewhere-banner-row">
            <div className="elsewhere-banner-copy">
              <p className="elsewhere-banner-gym">
                <strong>{gym.name}</strong>
                {moreInCity > 0 ? (
                  <span className="dim"> и ещё {moreInCity}</span>
                ) : null}
              </p>
              <p className="elsewhere-banner-city muted">в городе {city}</p>
            </div>
            <button
              type="button"
              className="btn btn-soft elsewhere-banner-cta"
              onClick={() => onSwitchCity(city)}
            >
              Сменить на {city}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
