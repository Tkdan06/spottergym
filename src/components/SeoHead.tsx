import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { seoCanonical, seoOgImage, seoOgType, seoPageForPath, seoRobots } from '../seo/pages'

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

function removeMeta(attr: 'name' | 'property', key: string) {
  const selector = attr === 'name' ? `meta[name="${key}"]` : `meta[property="${key}"]`
  document.head.querySelector(selector)?.remove()
}

/** Unique title/description/canonical for crawlers that run JS, and for share sheets. */
export function SeoHead() {
  const { pathname } = useLocation()

  useEffect(() => {
    const page = seoPageForPath(pathname)
    const robots = seoRobots(pathname, page)
    setMeta('name', 'robots', robots.robots)
    setMeta('name', 'googlebot', robots.googlebot)
    setMeta('name', 'yandex', robots.yandex)

    if (!page) return undefined

    const title = page.title
    const description = page.description
    const canonical = seoCanonical(page.path, page)
    const image = seoOgImage(page)
    const prevTitle = document.title
    document.title = title
    setMeta('name', 'description', description)
    setMeta('property', 'og:type', seoOgType(page))
    setMeta('property', 'og:description', description)
    setMeta('name', 'twitter:description', description)
    setMeta('property', 'og:title', title)
    setMeta('name', 'twitter:title', title)
    setMeta('property', 'og:url', canonical)
    setMeta('property', 'og:image', image)
    setMeta('property', 'og:image:secure_url', image)
    setMeta('name', 'twitter:image', image)
    setMeta('property', 'og:image:alt', title)
    setMeta('name', 'twitter:image:alt', title)
    setCanonical(canonical)
    if (page.path !== '/') removeMeta('name', 'keywords')

    return () => {
      document.title = prevTitle
    }
  }, [pathname])

  return null
}
