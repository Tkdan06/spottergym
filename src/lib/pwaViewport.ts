/**
 * iOS/Android home-screen PWA: on the first paint the layout viewport often
 * excludes the home indicator while env(safe-area-inset-bottom) is already set
 * (or visualViewport is shorter than innerHeight). Fixed bottom chrome then
 * sits too high until the first tap forces a relayout.
 */

const HOME_INDICATOR_MAX = 64

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

let probe: HTMLDivElement | null = null

function safeAreaBottomPx() {
  if (!probe) {
    probe = document.createElement('div')
    probe.setAttribute('aria-hidden', 'true')
    probe.style.cssText =
      'position:fixed;left:0;bottom:0;width:0;height:0;padding-bottom:env(safe-area-inset-bottom,0px);pointer-events:none;visibility:hidden'
    document.documentElement.appendChild(probe)
  }
  return probe.offsetHeight
}

export function syncPwaViewport() {
  const root = document.documentElement
  const vv = window.visualViewport
  const inner = window.innerHeight
  const visualH = vv?.height ?? inner
  const offsetTop = vv?.offsetTop ?? 0
  const vvBottom = Math.max(0, Math.round(inner - visualH - offsetTop))

  root.style.setProperty('--vv-bottom', `${vvBottom}px`)

  const standalone = isStandalonePwa()
  const ios = isIosDevice()
  const safeBottom = safeAreaBottomPx()
  const keyboardLike = vvBottom > HOME_INDICATOR_MAX
  const viewportAlreadyExcludesHomeIndicator =
    ios &&
    standalone &&
    !keyboardLike &&
    safeBottom > 0 &&
    inner <= screenHeightCss() - safeBottom + 2 &&
    inner >= screenHeightCss() - safeBottom - 80

  const homeIndicatorGlitch =
    ios &&
    standalone &&
    ((vvBottom > 0 && vvBottom <= HOME_INDICATOR_MAX) || viewportAlreadyExcludesHomeIndicator)

  if (homeIndicatorGlitch) {
    root.style.setProperty('--safe-bottom', '0px')
    root.dataset.pwaSafeFix = '1'
  } else if (root.dataset.pwaSafeFix) {
    root.style.removeProperty('--safe-bottom')
    delete root.dataset.pwaSafeFix
  }

  if (window.scrollY !== 0) window.scrollTo(0, 0)
}

export function startPwaViewportSync() {
  const sync = () => syncPwaViewport()
  sync()
  requestAnimationFrame(() => {
    sync()
    requestAnimationFrame(sync)
  })

  const vv = window.visualViewport
  vv?.addEventListener('resize', sync)
  vv?.addEventListener('scroll', sync)
  window.addEventListener('resize', sync)
  window.addEventListener('orientationchange', sync)
  window.addEventListener('pageshow', sync)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') sync()
  })
}
