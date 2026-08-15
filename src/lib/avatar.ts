import type { Gender, UserProfile } from '../types'

/** Локальные ч/б Notionists (скачаны с DiceBear) — без сети */
export function localGenderAvatar(gender?: Gender) {
  return gender === 'female' ? '/images/avatar-female.svg' : '/images/avatar-male.svg'
}

/**
 * Плейсхолдер аватара. Раньше ходили в api.dicebear.com — теперь только локальные SVG.
 * Параметр seed оставлен для совместимости вызовов.
 */
export function buildAvatarUrl(_seed: string, gender: Gender = 'male') {
  return localGenderAvatar(gender)
}

/** Фото профиля или гендерный плейсхолдер */
export function profileImage(
  user: Pick<UserProfile, 'photos' | 'avatar' | 'privacy' | 'name' | 'gender' | 'isDeleted'>,
) {
  if (user.isDeleted) return '/images/deleted-user.svg'
  // Prefer real photos when present (incl. admin reveal of anonymous profiles)
  const photo = Array.isArray(user.photos) ? user.photos.find(Boolean) : undefined
  if (photo) return photo
  if (user.privacy === 'anonymous') {
    // Redacted payload has no photos — gender silhouette only
    const av = user.avatar || ''
    if (!av || av.includes('dicebear.com') || av.includes('api.dicebear')) {
      return localGenderAvatar(user.gender)
    }
    return av
  }
  const av = user.avatar || ''
  if (!av || av.includes('dicebear.com') || av.includes('api.dicebear')) {
    return localGenderAvatar(user.gender)
  }
  return av
}

/** Что показать, если основной src упал (CDN / сеть) */
export function profileImageFallback(
  user: Pick<UserProfile, 'gender' | 'isDeleted'>,
) {
  if (user.isDeleted) return '/images/deleted-user.svg'
  return localGenderAvatar(user.gender)
}

export function withSyncedAvatar<T extends UserProfile>(user: T): T {
  const photos = Array.isArray(user.photos) ? user.photos : []
  const base = photos === user.photos ? user : { ...user, photos }
  if (photos.length > 0) return base
  const avatar = localGenderAvatar(base.gender)
  if (base.avatar === avatar) return base
  return { ...base, avatar }
}
