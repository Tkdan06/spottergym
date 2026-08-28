import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Reset window scroll on route change (SPA keeps previous scroll position by default). */
export function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [pathname])

  return null
}
