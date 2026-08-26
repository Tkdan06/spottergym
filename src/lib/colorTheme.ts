/** Admin-only palette preview. Default for everyone is the current :root tokens. */

export const COLOR_THEME_KEY = 'spotter.color-theme'
export type SpotterColorTheme = 'current' | 'v2'

const THEME_COLOR: Record<SpotterColorTheme, string> = {
  current: '#0B0F0E',
  v2: '#0A0D0C',
}

export function readStoredColorTheme(): SpotterColorTheme {
  try {
    return localStorage.getItem(COLOR_THEME_KEY) === 'v2' ? 'v2' : 'current'
  } catch {
    return 'current'
  }
}

export function writeStoredColorTheme(theme: SpotterColorTheme) {
  try {
    if (theme === 'v2') localStorage.setItem(COLOR_THEME_KEY, 'v2')
    else localStorage.removeItem(COLOR_THEME_KEY)
  } catch {
    /* private mode */
  }
}

export function applySpotterColorTheme(isAdmin: boolean) {
  const theme: SpotterColorTheme = isAdmin ? readStoredColorTheme() : 'current'
  const html = document.documentElement
  if (theme === 'v2') html.dataset.spotterTheme = 'v2'
  else delete html.dataset.spotterTheme

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', THEME_COLOR[theme])
}

export function setAdminColorTheme(theme: SpotterColorTheme, isAdmin: boolean) {
  if (!isAdmin) return
  writeStoredColorTheme(theme)
  applySpotterColorTheme(true)
}
