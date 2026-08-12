import { Navigate } from 'react-router-dom'
import { useApp } from '../context/useApp'

/** Broken deep links: send authed users into the app, guests to welcome. */
export function SmartCatchAll() {
  const { user } = useApp()
  if (user?.onboardingDone) return <Navigate to="/app" replace />
  if (user) return <Navigate to="/onboarding" replace />
  return <Navigate to="/" replace />
}
