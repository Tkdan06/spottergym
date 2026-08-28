import { Navigate, useLocation } from 'react-router-dom'
import { normalizePathname } from '../lib/normalizePathname'

/** Directory indexes and nginx trailing-slash redirects otherwise miss `/guide/:slug`. */
export function NormalizePathname() {
  const location = useLocation()
  const pathname = normalizePathname(location.pathname)
  if (pathname === location.pathname) return null
  return <Navigate to={{ pathname, search: location.search, hash: location.hash }} replace />
}
