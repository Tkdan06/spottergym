/**
 * iOS installed PWA + viewport-fit=cover: WebKit reports 100dvh / svh / often
 * innerHeight as “screen minus home indicator”. The bottom nav then sits above
 * a black gap until the first tap. 100vh is the unit that includes the inset.
 *
 * --pwa-bottom-shift pulls the bar down when the layout viewport is still short.
 * Never touch window.scrollTo or visualViewport "scroll" — that yanks the page up.
 */

function isStandalonePwa() {
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return (
    Boolean(nav.standalone) ||
    window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches
  )
}

function isIosDevice() {
  const ua = navigator.userAgent
  if (/iP(hone|ad|od)/.test(ua)) return true
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

function screenHeightCss() {
  const { width, height } = window.screen
  const portrait = window.innerHeight >= window.innerWidth
  return portrait ? Math.max(width, height) : Math.min(width, height)
}

export function syncPwaViewport() {
  const root = document.documentElement
  if (!isIosDevice() || !isStandalonePwa()) {
    root.style.setProperty('--pwa-bottom-shift', '0px')
    return
  }

  const delta = Math.round(screenHeightCss() - window.innerHeight)
  // Home-indicator-sized hole only. Keyboard / URL-bar deltas are much larger.
  const shift = delta >= 12 && delta <= 64 ? delta : 0
  root.style.setProperty('--pwa-bottom-shift', `${shift}px`)
}

export function startPwaViewportSync() {
  const sync = () => syncPwaViewport()
  sync()
  ;[50, 250, 800].forEach((ms) => window.setTimeout(sync, ms))
  window.addEventListener('resize', sync)
  window.addEventListener('orientationchange', sync)
  window.addEventListener('pageshow', sync)
}
