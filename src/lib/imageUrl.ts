/** Размер отображения → ширина запроса (2x retina для мелких слотов) */
export type ImageSize = 'avatar' | 'thumb' | 'card' | 'hero' | 'full'

const WIDTH: Record<ImageSize, number> = {
  avatar: 96,
  thumb: 160,
  card: 360,
  hero: 960,
  full: 1200,
}

const QUALITY: Record<ImageSize, number> = {
  avatar: 62,
  thumb: 65,
  card: 72,
  hero: 74,
  full: 78,
}

/**
 * Ужимает внешние CDN-URL (Unsplash, DiceBear и т.п.) под слот.
 * data:/blob:/локальные пути не трогаем.
 */
export function optimizeImageUrl(src: string, size: ImageSize = 'card'): string {
  const raw = String(src || '').trim()
  if (!raw) return raw
  if (
    raw.startsWith('data:') ||
    raw.startsWith('blob:') ||
    raw.startsWith('/') ||
    raw.startsWith('./')
  ) {
    return raw
  }

  try {
    const u = new URL(raw)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'images.unsplash.com' || host === 'unsplash.com') {
      u.searchParams.set('w', String(WIDTH[size]))
      u.searchParams.set('q', String(QUALITY[size]))
      u.searchParams.set('auto', 'format')
      u.searchParams.set('fit', 'crop')
      return u.toString()
    }
    if (host === 'api.dicebear.com') {
      u.searchParams.set('size', String(WIDTH[size]))
      return u.toString()
    }
  } catch {
    /* keep original */
  }
  return raw
}
