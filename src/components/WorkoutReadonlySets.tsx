import { formatDeltaParts, formatSetPair } from '../lib/workouts'

type SetLine = {
  weightKg: number | string
  reps: number | string
  weightDelta?: number | null
  repsDelta?: number | null
}

type ExerciseLine = {
  name?: string
  trackKey?: string
  sets: SetLine[]
}

export function WorkoutReadonlySets({ exercises }: { exercises: ExerciseLine[] }) {
  return (
    <ul className="workout-readonly-list">
      {exercises.map((ex, i) => (
        <li key={ex.trackKey || `${ex.name || 'ex'}-${i}`} className="workout-readonly-ex">
          <strong>{ex.name || 'Упражнение'}</strong>
          <ul className="workout-readonly-sets">
            {ex.sets.map((s, si) => {
              const parts = formatDeltaParts(s.weightDelta, s.repsDelta, { hideFlat: true })
              return (
                <li key={si}>
                  <span className="workout-readonly-set-main">
                    <span className="dim">{si + 1}.</span>{' '}
                    {formatSetPair(
                      Number(String(s.weightKg).replace(',', '.')) || 0,
                      Math.max(0, Math.floor(Number(s.reps) || 0)),
                    )}
                  </span>
                  {parts?.length ? (
                    <span className="workout-delta-group">
                      {parts.map((part, pi) => (
                        <span key={`${part.text}-${pi}`}>
                          {pi > 0 ? <span className="dim"> · </span> : null}
                          <span className={`workout-delta is-${part.tone}`}>{part.text}</span>
                        </span>
                      ))}
                    </span>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </li>
      ))}
    </ul>
  )
}
