import type { Gender, UserProfile } from '../types'

/** Тёмный фон Spotter — чёрно-белая графика Notionists читается поверх */
const BG = '1a1f1c'

/**
 * Парни: короткие стрижки + более «плотные» силуэты тела
 * (в Notionists нет отдельного «качка», но крупные body-варианты дают атлетичный вид)
 */
const MALE_HAIR = [
  'variant01',
  'variant02',
  'variant03',
  'variant04',
  'variant05',
  'variant06',
  'variant07',
  'variant08',
  'variant09',
  'variant10',
  'variant11',
  'variant12',
].join(',')

const MALE_BODY = [
  'variant18',
  'variant19',
  'variant20',
  'variant21',
  'variant22',
  'variant23',
  'variant24',
  'variant25',
].join(',')

const MALE_LIPS = ['variant01', 'variant02', 'variant03', 'variant05', 'variant08'].join(',')

/** Девушки: объёмные укладки, улыбка, более лёгкий силуэт */
const FEMALE_HAIR = [
  'variant40',
  'variant41',
  'variant42',
  'variant43',
  'variant44',
  'variant45',
  'variant46',
  'variant48',
  'variant50',
  'variant52',
  'variant54',
].join(',')

const FEMALE_BODY = [
  'variant01',
  'variant02',
  'variant03',
  'variant04',
  'variant05',
  'variant06',
  'variant07',
  'variant08',
].join(',')

/** Улыбчивые губы — без «языка» и странных гримас */
const FEMALE_LIPS = [
  'variant04',
  'variant06',
  'variant07',
  'variant09',
  'variant10',
  'variant11',
  'variant14',
  'variant15',
].join(',')

/** Активные жесты — спорт / приветствие, без телефона */
const SPORT_GESTURES = ['ok', 'point', 'waveLongArm', 'waveOkLongArms', 'hand'].join(',')

/**
 * Чёрно-белые графические плейсхолдеры Notionists.
 * Спортивный уклон: без очков и космических иконок на теле (они давали «весы»),
 * атлетичные силуэты у парней, улыбка у девушек.
 */
export function buildAvatarUrl(seed: string, gender: Gender = 'male') {
  const params = new URLSearchParams({
    seed: `notion-sport-${gender}-${seed || 'spotter'}`,
    backgroundColor: BG,
    glassesProbability: '0',
    bodyIconProbability: '0',
    gesture: SPORT_GESTURES,
    gestureProbability: '35',
  })

  if (gender === 'female') {
    params.set('hair', FEMALE_HAIR)
    params.set('body', FEMALE_BODY)
    params.set('lips', FEMALE_LIPS)
    params.set('beardProbability', '0')
  } else {
    params.set('hair', MALE_HAIR)
    params.set('body', MALE_BODY)
    params.set('lips', MALE_LIPS)
    params.set('beardProbability', '40')
  }

  return `https://api.dicebear.com/9.x/notionists/svg?${params.toString()}`
}

/** Фото профиля или гендерный плейсхолдер */
export function profileImage(user: Pick<UserProfile, 'photos' | 'avatar' | 'privacy' | 'name' | 'gender'>) {
  if (user.privacy === 'anonymous') {
    return user.avatar || buildAvatarUrl(user.name || 'user', user.gender)
  }
  const photo = Array.isArray(user.photos) ? user.photos[0] : undefined
  return photo || user.avatar || buildAvatarUrl(user.name || 'user', user.gender)
}

export function withSyncedAvatar<T extends UserProfile>(user: T): T {
  const photos = Array.isArray(user.photos) ? user.photos : []
  const base = photos === user.photos ? user : { ...user, photos }
  if (photos.length > 0) return base
  const avatar = buildAvatarUrl(base.name || 'user', base.gender)
  if (base.avatar === avatar) return base
  return { ...base, avatar }
}
