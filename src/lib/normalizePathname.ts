/** Canonical SPA path: no trailing slash, no leftover directory index. */
export function normalizePathname(pathname: string) {
  if (!pathname || pathname === '/') return '/'
  let next = pathname.replace(/\/index\.html$/i, '')
  if (next.length > 1) next = next.replace(/\/+$/, '')
  return next || '/'
}

export function currentUrlAfterNormalize() {
  const { pathname, search, hash } = window.location
  const next = normalizePathname(pathname)
  if (next === pathname) return null
  return `${next}${search}${hash}`
}
