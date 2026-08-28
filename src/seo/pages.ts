import catalog from './pages.json'

export const SITE_ORIGIN = catalog.origin.replace(/\/$/, '')

export type SeoPage = {
  path: string
  title: string
  description: string
  index: boolean
}

export const SEO_PAGES: SeoPage[] = catalog.pages

export function normalizeSeoPath(pathname: string) {
  if (!pathname || pathname === '/') return '/'
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed || '/'
}

export function seoPageForPath(pathname: string): SeoPage | null {
  const path = normalizeSeoPath(pathname)
  return SEO_PAGES.find((page) => page.path === path) ?? null
}

export function seoCanonical(pathname: string) {
  const path = normalizeSeoPath(pathname)
  return path === '/' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${path}`
}

export function isSeoTrackedPath(pathname: string) {
  const path = normalizeSeoPath(pathname)
  if (path === '/' || path === '/lp' || path === '/lp-coaches') return true
  if (path === '/login' || path === '/register') return true
  if (path === '/guide' || path.startsWith('/guide/')) return true
  return false
}

export function shouldNoIndex(pathname: string) {
  const path = normalizeSeoPath(pathname)
  if (path.startsWith('/app')) return true
  if (path === '/onboarding' || path.startsWith('/onboarding')) return true
  if (path === '/forgot-password' || path === '/reset-password') return true
  const page = seoPageForPath(path)
  if (page) return !page.index
  return true
}
