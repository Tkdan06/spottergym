import { getApiBase } from './apiClient'
import { loadMarketingParams } from './utm'

const VISITOR_KEY = 'spotter_lp_vid'
const SESSION_KEY = 'spotter_lp_sid'
const FIRED_KEY = 'spotter_lp_fired'

export type LandingTrackName =
  | 'view'
  | 'scroll_50'
  | 'scroll_90'
  | 'cta_register'
  | 'cta_login'
  | 'register_view'
  | 'register_success'

function randomId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function getLandingVisitorId() {
  if (typeof window === 'undefined') return ''
  try {
    let id = localStorage.getItem(VISITOR_KEY)
    if (!id) {
      id = randomId()
      localStorage.setItem(VISITOR_KEY, id)
    }
    return id
  } catch {
    return randomId()
  }
}

export function getLandingSessionId() {
  if (typeof window === 'undefined') return ''
  try {
    let id = sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id = randomId()
      sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return randomId()
  }
}

function alreadyFired(key: string) {
  try {
    const raw = sessionStorage.getItem(FIRED_KEY)
    const set = raw ? (JSON.parse(raw) as string[]) : []
    return Array.isArray(set) && set.includes(key)
  } catch {
    return false
  }
}

function markFired(key: string) {
  try {
    const raw = sessionStorage.getItem(FIRED_KEY)
    const set = raw ? (JSON.parse(raw) as string[]) : []
    const next = Array.isArray(set) ? set : []
    if (!next.includes(key)) next.push(key)
    sessionStorage.setItem(FIRED_KEY, JSON.stringify(next.slice(-40)))
  } catch {
    /* ignore */
  }
}

/** Fire-and-forget landing funnel event (no throw). */
export function trackLanding(
  name: LandingTrackName,
  opts: { placement?: string; path?: string; onceKey?: string } = {},
) {
  if (typeof window === 'undefined') return
  const onceKey = opts.onceKey || name
  if (
    name === 'view' ||
    name === 'scroll_50' ||
    name === 'scroll_90' ||
    name === 'register_view'
  ) {
    if (alreadyFired(onceKey)) return
    markFired(onceKey)
  }

  const utm = loadMarketingParams()
  const body = {
    name,
    visitorId: getLandingVisitorId(),
    sessionId: getLandingSessionId(),
    placement: opts.placement || '',
    path: opts.path || window.location.pathname || '/lp',
    utmSource: utm.utm_source || '',
    utmMedium: utm.utm_medium || '',
    utmCampaign: utm.utm_campaign || '',
    utmContent: utm.utm_content || '',
    utmTerm: utm.utm_term || '',
    fromParam: utm.from || '',
  }

  void fetch(`${getApiBase()}/analytics/lp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {
    /* offline / adblock — ignore */
  })
}

/** Scroll depth watcher for /lp (50% and 90% of document). */
export function attachLandingScrollTracking() {
  if (typeof window === 'undefined') return () => {}

  let maxPct = 0
  const onScroll = () => {
    const doc = document.documentElement
    const scrollable = Math.max(doc.scrollHeight - window.innerHeight, 1)
    const pct = (window.scrollY / scrollable) * 100
    if (pct > maxPct) maxPct = pct
    if (maxPct >= 50) trackLanding('scroll_50')
    if (maxPct >= 90) trackLanding('scroll_90')
  }

  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
  return () => window.removeEventListener('scroll', onScroll)
}
