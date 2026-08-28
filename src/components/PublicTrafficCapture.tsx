import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { trackLanding } from '../lib/landingTrack'
import { captureMarketingParams, captureSearchTouch } from '../lib/utm'
import { isSeoTrackedPath } from '../seo/pages'

/** First-touch UTM + search referrer; one `view` per session on public pages. */
export function PublicTrafficCapture() {
  const { pathname, search } = useLocation()

  useEffect(() => {
    captureMarketingParams(search)
    captureSearchTouch()
    if (!isSeoTrackedPath(pathname)) return
    trackLanding('view', { path: pathname, onceKey: 'view' })
  }, [pathname, search])

  return null
}
