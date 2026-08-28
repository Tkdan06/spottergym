import catalog from './pages.json'

export const SITE_ORIGIN = catalog.origin.replace(/\/$/, '')

export type SeoPage = {
  path: string
  title: string
  description: string
  index: boolean
  h1?: string
  crumb?: string
  schemaType?: 'Article' | 'CollectionPage'
  ogImage?: string
  canonicalPath?: string
}

export const SEO_PAGES: SeoPage[] = catalog.pages as SeoPage[]

export function normalizeSeoPath(pathname: string) {
  if (!pathname || pathname === '/') return '/'
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed || '/'
}

export function seoPageForPath(pathname: string): SeoPage | null {
  const path = normalizeSeoPath(pathname)
  return SEO_PAGES.find((page) => page.path === path) ?? null
}

export function seoCanonical(pathname: string, page?: SeoPage | null) {
  const target = page?.canonicalPath || normalizeSeoPath(pathname)
  const path = normalizeSeoPath(target)
  return path === '/' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${path}`
}

export function seoOgImage(page?: SeoPage | null) {
  if (!page?.ogImage) return `${SITE_ORIGIN}/og-share.png`
  return `${SITE_ORIGIN}${page.ogImage}`
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

/** Indexable pages: index,follow. Aliases with canonicalPath: noindex,follow so the crawler can reach the canonical. */
export function seoRobots(pathname: string, page?: SeoPage | null) {
  if (!shouldNoIndex(pathname)) {
    return {
      robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
      googlebot: 'index, follow, max-image-preview:large, max-snippet:-1',
      yandex: 'index, follow',
    }
  }
  const follow = Boolean(page?.canonicalPath)
  const value = follow ? 'noindex, follow' : 'noindex, nofollow'
  return { robots: value, googlebot: value, yandex: value }
}

export function seoOgType(page?: SeoPage | null) {
  return page?.schemaType === 'Article' ? 'article' : 'website'
}
