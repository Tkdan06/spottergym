export type SearchEngine = '' | 'google' | 'yandex' | 'bing' | 'other'

export type SearchAttribution = {
  searchEngine: SearchEngine
  searchKeyword: string
  clickId: string
  paid: boolean
  referrerHost: string
}

const PAID_MEDIUM = /^(cpc|ppc|ppcsearch|paid|paidsearch|cpa|ads?|display|cpm)$/i

function clip(value: string, max: number) {
  return value.trim().slice(0, max)
}

function hostOf(referrer: string) {
  try {
    return new URL(referrer).hostname.toLowerCase()
  } catch {
    return ''
  }
}

function engineFromHost(host: string): SearchEngine {
  if (!host) return ''
  if (host === 'ya.ru' || host.endsWith('.ya.ru') || host.includes('yandex.')) return 'yandex'
  if (host.includes('google.')) return 'google'
  if (host.includes('bing.com') || host === 'www.bing.com') return 'bing'
  if (
    host.includes('duckduckgo.') ||
    host.includes('mail.ru') ||
    host.includes('rambler.') ||
    host.includes('yahoo.')
  ) {
    return 'other'
  }
  return ''
}

function engineFromUtm(source: string): SearchEngine {
  const s = source.trim().toLowerCase()
  if (!s) return ''
  if (s === 'google' || s === 'googleads' || s === 'adwords') return 'google'
  if (s === 'yandex' || s === 'yandex_direct' || s === 'ydirect' || s === 'ya') return 'yandex'
  if (s === 'bing') return 'bing'
  return ''
}

function keywordFromReferrer(referrer: string) {
  try {
    const url = new URL(referrer)
    const keys = ['q', 'text', 'query', 'wd']
    for (const key of keys) {
      const value = url.searchParams.get(key)?.trim()
      if (value) return clip(value, 120)
    }
  } catch {
    /* ignore */
  }
  return ''
}

function clickIdFromSearch(search: string) {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`)
  const id =
    params.get('gclid') ||
    params.get('gbraid') ||
    params.get('wbraid') ||
    params.get('yclid') ||
    params.get('ysclid') ||
    ''
  return clip(id, 80)
}

/** Classify Google / Yandex (and keyword when the referrer still has q= / text=). */
export function parseSearchAttribution(input: {
  referrer?: string
  landingSearch?: string
}): SearchAttribution {
  const referrer = (input.referrer || '').trim()
  const landingSearch = input.landingSearch || ''
  const params = new URLSearchParams(
    landingSearch.startsWith('?') ? landingSearch : landingSearch ? `?${landingSearch}` : '',
  )
  const utmSource = params.get('utm_source') || ''
  const utmMedium = params.get('utm_medium') || ''
  const utmTerm = clip(params.get('utm_term') || '', 120)
  const clickId = clickIdFromSearch(landingSearch)
  const referrerHost = hostOf(referrer)
  const fromHost = engineFromHost(referrerHost)
  const fromUtm = engineFromUtm(utmSource)
  let engine: SearchEngine = fromHost || fromUtm
  if (!engine && clickId) {
    if (params.has('gclid') || params.has('gbraid') || params.has('wbraid')) engine = 'google'
    else if (params.has('yclid') || params.has('ysclid')) engine = 'yandex'
  }
  const paid =
    Boolean(clickId) || (Boolean(engine) && PAID_MEDIUM.test(utmMedium.trim()))

  return {
    searchEngine: engine,
    searchKeyword: utmTerm || keywordFromReferrer(referrer),
    clickId,
    paid,
    referrerHost,
  }
}

export function searchEngineLabel(engine: string) {
  if (engine === 'google') return 'Google'
  if (engine === 'yandex') return 'Яндекс'
  if (engine === 'bing') return 'Bing'
  if (engine === 'other') return 'Другой поиск'
  return 'Не поиск'
}
