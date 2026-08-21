import { Navigate } from 'react-router-dom'

/** Old entry — recap lives under the chart on Progress. */
export function WorkoutsCoachPage() {
  return <Navigate to="/app/workouts/progress#week-recap" replace />
}
