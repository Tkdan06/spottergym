const STORAGE_KEY = 'spotter_utm_v1'

const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'from',
] as const

export type SpotterUtm = Partial<Record<(typeof UTM_KEYS)[number], string>>

function readParams(search: string): SpotterUtm {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`)
  const out: SpotterUtm = {}
  for (const key of UTM_KEYS) {
    const value = params.get(key)?.trim()
    if (value) out[key] = value.slice(0, 120)
  }
  return out
}

/** Capture UTM / from= on landing entry and keep for the session (register funnel). */
export function captureMarketingParams(search: string) {
  if (typeof window === 'undefined') return
  const next = readParams(search)
  if (!Object.keys(next).length) return
  try {
    const prev = loadMarketingParams()
    const merged = { ...prev, ...next }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  } catch {
    /* private mode / quota */
  }
}

export function loadMarketingParams(): SpotterUtm {
  if (typeof window === 'undefined') return {}
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const out: SpotterUtm = {}
    for (const key of UTM_KEYS) {
      const value = (parsed as Record<string, unknown>)[key]
      if (typeof value === 'string' && value.trim()) out[key] = value.trim().slice(0, 120)
    }
    return out
  } catch {
    return {}
  }
}

/** Build register/login query preserving landing attribution. */
export function marketingRegisterSearch(extra: SpotterUtm = {}) {
  const merged = { ...loadMarketingParams(), ...extra }
  if (!merged.from) merged.from = 'lp'
  const params = new URLSearchParams()
  for (const key of UTM_KEYS) {
    const value = merged[key]
    if (value) params.set(key, value)
  }
  const q = params.toString()
  return q ? `?${q}` : '?from=lp'
}
