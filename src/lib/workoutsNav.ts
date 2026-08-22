import type { NavigateFunction } from 'react-router-dom'

/** List is the section hub. Home (Мой зал) is the only exit. */
export const WORKOUTS_HUB = '/app/workouts'
export const WORKOUTS_EXIT = '/app'

/** Leave the workouts section for the gym home — replace so history cannot loop. */
export function exitWorkoutsSection(navigate: NavigateFunction) {
  navigate(WORKOUTS_EXIT, { replace: true })
}

/** Return to the workouts list without stacking another hub entry. */
export function goWorkoutsHub(navigate: NavigateFunction) {
  navigate(WORKOUTS_HUB, { replace: true })
}
