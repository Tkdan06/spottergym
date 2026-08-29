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

/** Фирменные заглушки сетей; остальные — стоки gym-01…05 */
const NETWORK_COVERS: Record<string, string> = {
  'spirit fitness': '/images/gyms/spirit.jpg',
  'fitness house': '/images/gyms/fitness-house.jpg',
  urbanfit: '/images/gyms/urbanfit.jpg',
  'urban fit': '/images/gyms/urbanfit.jpg',
  'urban fitness': '/images/gyms/urbanfit.jpg',
  'ddx fitness': '/images/gyms/ddx.jpg',
  ddx: '/images/gyms/ddx.jpg',
  'crocus fitness': '/images/gyms/crocus.jpg',
  crocus: '/images/gyms/crocus.jpg',
  'world class': '/images/gyms/world-class.jpg',
  worldclass: '/images/gyms/world-class.jpg',
  'encore fitness': '/images/gyms/encore.jpg',
  encore: '/images/gyms/encore.jpg',
}

function networkKey(network: string) {
  return network.replace(/\./g, '').replace(/\s+/g, ' ').trim().toLowerCase()
}

/** Обложка клуба: известная сеть → локальное фото, иначе то, что в каталоге. */
export function gymCoverSrc(gym: { image: string; network?: string }): string {
  if (!gym.network) return gym.image
  return NETWORK_COVERS[networkKey(gym.network)] || gym.image
}

/** Старые Unsplash-баннеры залов → локальные копии в /public/images/gyms */
const LOCAL_GYM_BANNERS: Record<string, string> = {
  'photo-1517836357463-d25dfeac3438': '/images/gyms/gym-01.jpg',
  'photo-1540497077202-7c8a3999166f': '/images/gyms/gym-02.jpg',
  'photo-1534438327276-14e5300c3a48': '/images/gyms/gym-03.jpg',
  'photo-1571902943202-507ec2618e8f': '/images/gyms/gym-04.jpg',
  'photo-1558611848-73f7eb4001a1': '/images/gyms/gym-05.jpg',
}

function localGymBanner(src: string): string | null {
  for (const [photoId, local] of Object.entries(LOCAL_GYM_BANNERS)) {
    if (src.includes(photoId)) return local
  }
  return null
}

/**
 * Ужимает внешние CDN-URL под слот; баннеры залов с Unsplash → локальные JPG.
 * data:/blob:/локальные пути не трогаем (кроме remap старых Unsplash).
 */
export function optimizeImageUrl(src: string, size: ImageSize = 'card'): string {
  const raw = String(src || '').trim()
  if (!raw) return raw

  const gymLocal = localGymBanner(raw)
  if (gymLocal) return gymLocal

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
