import { Navigate, Outlet } from 'react-router-dom'
import { useApp } from '../context/useApp'

export function ProtectedRoute() {
  const { user } = useApp()
  if (!user) return <Navigate to="/login" replace />
  if (!user.onboardingDone) return <Navigate to="/onboarding" replace />
  return <Outlet />
}

export function GuestOnly() {
  const { user } = useApp()
  if (user?.onboardingDone) return <Navigate to="/app" replace />
  if (user && !user.onboardingDone) return <Navigate to="/onboarding" replace />
  return <Outlet />
}
