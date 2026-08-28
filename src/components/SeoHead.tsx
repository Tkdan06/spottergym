import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { seoCanonical, seoPageForPath, shouldNoIndex } from '../seo/pages'

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  const selector = attr === 'name' ? `meta[name="${key}"]` : `meta[property="${key}"]`
  let el = document.head.querySelector(selector)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setCanonical(href: string) {
  let link = document.head.querySelector('link[rel="canonical"]')
  if (!link) {
    link = document.createElement('link')
    link.setAttribute('rel', 'canonical')
    document.head.appendChild(link)
  }
  link.setAttribute('href', href)
}

/** Unique title/description/canonical for crawlers that run JS, and for share sheets. */
export function SeoHead() {
  const { pathname } = useLocation()

  useEffect(() => {
    const page = seoPageForPath(pathname)
    const noIndex = shouldNoIndex(pathname)
    setMeta(
      'name',
      'robots',
      noIndex
        ? 'noindex, nofollow'
        : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    )

    if (!page) return undefined

    const title = page.title
    const description = page.description
    const canonical = seoCanonical(page.path)
    const prevTitle = document.title
    document.title = title
    setMeta('name', 'description', description)
    setMeta('property', 'og:description', description)
    setMeta('name', 'twitter:description', description)
    setMeta('property', 'og:title', title)
    setMeta('name', 'twitter:title', title)
    setMeta('property', 'og:url', canonical)
    setCanonical(canonical)

    return () => {
      document.title = prevTitle
    }
  }, [pathname])

  return null
}
