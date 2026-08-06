import { buildAvatarUrl } from '../lib/avatar'
import { isPresentInGym } from '../lib/presence'
import type {
  Conversation,
  ExperienceLevel,
  Gender,
  Gym,
  Message,
  UserProfile,
} from '../types'
import citiesData from './cities.json'
import gymsData from './gyms.json'

const avatar = (seed: string, gender: Gender = 'male') => buildAvatarUrl(seed, gender)

export interface CityMeta {
  name: string
  gymCount: number
  networks: string[]
  priority: boolean
}

export const CITIES_META = citiesData as CityMeta[]
export const CITIES = CITIES_META.map((c) => c.name)

export const NETWORKS = [
  'Все сети',
  'DDX Fitness',
  'Spirit. Fitness',
  'World Class',
  'Encore Fitness',
  'Crocus Fitness',
  'XFIT',
  'Alex Fitness',
  'URBANFIT',
  'Fitness House',
  'BrightFit',
  'A-Fitness',
  'Orange Fitness',
  'Balance',
  'Физкульт',
  'Zebra Fitness',
  'Планета Фитнес',
  'Nebo',
  'Kometa.fit',
  'Независимый',
] as const

/** Убрать мусор из парсинга адресов: литералы "\n", лишние пробелы */
export function cleanGymText(value: string) {
  return value
    .replace(/\\n/g, ', ')
    .replace(/\\r/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/[\r\n\t]+/g, ', ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*/g, ', ')
    .replace(/,\s*,+/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,]+|[\s,]+$/g, '')
    .trim()
}

function normalizeGym(gym: Gym): Gym {
  return {
    ...gym,
    name: cleanGymText(gym.name),
    network: cleanGymText(gym.network),
    city: cleanGymText(gym.city),
    district: cleanGymText(gym.district),
    address: cleanGymText(gym.address),
  }
}

export const GYMS: Gym[] = (gymsData as Gym[]).map(normalizeGym)

export const DEMO_GYM_ID = 'gym-world-class-world-class-tverskaya-moskva'

export const INTERESTS = [
  'Знакомства',
  'Тренировочный партнёр',
  'Совместные забеги',
  'Питание',
  'Йога',
  'CrossFit',
  'Силовые',
  'Кардио',
  'Растяжка',
  'Вечерние тренировки',
  'Утренние тренировки',
  'Соревнования',
]

export const SPORTS = [
  'Тренажёрный зал',
  'Силовые',
  'Функционал',
  'Кроссфит',
  'Hyrox',
  'Бег',
  'Йога',
  'Пилатес',
  'Плавание',
  'Бокс / единоборства',
  'Вело',
  'Групповые тренировки',
  'Растяжка',
]

/** Направления тренера — шире, чем личные активности */
export const COACH_DIRECTIONS = [
  'Персональные тренировки',
  'Групповые тренировки',
  'Тренажёрный зал',
  'Силовые',
  'Функционал',
  'Кроссфит',
  'Йога',
  'Пилатес',
  'Стретчинг / мобилити',
  'Бокс / единоборства',
  'Кардио',
  'Плавание',
  'Бег',
  'Реабилитация',
  'Детские / подростковые',
  'Онлайн-тренировки',
]

/** Уровень в зале — по ощущению, без лет стажа */
export const EXPERIENCE_LEVELS: {
  value: ExperienceLevel
  label: string
  hint: string
}[] = [
  { value: 'newbie', label: 'Новичок', hint: 'Только вхожу в ритм' },
  { value: 'confident', label: 'Уверенный', hint: 'Есть база, занимаюсь регулярно' },
  { value: 'experienced', label: 'Опытный', hint: 'Давно в зале, чувствую себя свободно' },
  { value: 'pro', label: 'Профи', hint: 'Соревнуюсь или близко к этому' },
]

export const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export const USERS: UserProfile[] = [
  {
    id: 'u-test',
    username: 'test',
    name: 'Тест',
    age: 25,
    gender: 'male',
    bio: 'Тестовый аккаунт для проверки поиска по @нику, лайков и чата.',
    photos: [
      'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&q=80&auto=format&fit=crop',
    ],
    avatar: avatar('Test', 'male'),
    gymIds: [DEMO_GYM_ID],
    homeGymId: DEMO_GYM_ID,
    city: 'Москва',
    intent: 'both',
    experienceLevel: 'confident',
    interests: ['Знакомства', 'Тренировочный партнёр'],
    sports: ['Силовые'],
    isCoach: false,
    coachSports: [],
    visitSlots: [
      { day: 'Пн', from: '18:00', to: '20:00' },
      { day: 'Ср', from: '18:00', to: '20:00' },
    ],
    privacy: 'open',
    lookingToMeet: true,
    isActive: true,
    checkedInGymId: DEMO_GYM_ID,
    lastSeenAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    verified: true,
  },
  {
    id: 'u-masha',
    username: 'masha_ddx',
    name: 'Маша',
    age: 26,
    gender: 'female',
    bio: 'Люблю вечерние силовые и честный PR. Ищу человека, с которым не стыдно молчать между подходами.',
    photos: [
      'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&q=80&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&q=80&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1548690312-e3b507d8c110?w=800&q=80&auto=format&fit=crop',
    ],
    avatar: avatar('Masha', 'female'),
    gymIds: [DEMO_GYM_ID],
    homeGymId: DEMO_GYM_ID,
    city: 'Москва',
    intent: 'both',
    experienceLevel: 'confident',
    interests: ['Знакомства', 'Силовые', 'Вечерние тренировки'],
    sports: ['Силовые', 'Йога'],
    isCoach: false,
    coachSports: [],
    visitSlots: [
      { day: 'Пн', from: '19:00', to: '21:00' },
      { day: 'Ср', from: '19:00', to: '21:00' },
      { day: 'Пт', from: '18:30', to: '20:30' },
    ],
    privacy: 'open',
    lookingToMeet: true,
    isActive: true,
    checkedInGymId: DEMO_GYM_ID,
    lastSeenAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    verified: true,
  },
  {
    id: 'u-ivan',
    username: 'ivan_coach',
    name: 'Иван',
    age: 29,
    gender: 'male',
    bio: 'Тренер по силовым и функционалу. Могу собрать программу и подстраховать на жиме.',
    photos: [
      'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=800&q=80&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&q=80&auto=format&fit=crop',
    ],
    avatar: avatar('Ivan', 'male'),
    gymIds: [DEMO_GYM_ID],
    homeGymId: DEMO_GYM_ID,
    city: 'Москва',
    intent: 'buddy',
    experienceLevel: 'experienced',
    interests: ['Тренировочный партнёр', 'Силовые'],
    sports: ['Силовые', 'Функционал'],
    isCoach: true,
    coachSports: ['Силовые', 'Функционал'],
    visitSlots: [
      { day: 'Вт', from: '07:00', to: '08:30' },
      { day: 'Чт', from: '07:00', to: '08:30' },
      { day: 'Сб', from: '11:00', to: '13:00' },
    ],
    privacy: 'open',
    lookingToMeet: true,
    isActive: true,
    checkedInGymId: DEMO_GYM_ID,
    lastSeenAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
  },
  {
    id: 'u-lera',
    username: 'lera_run',
    name: 'Лера',
    age: 24,
    gender: 'female',
    bio: 'Бег + зал. Открыта к знакомствам, но сначала — нормальный разговор без «привет, красотка».',
    photos: [
      'https://images.unsplash.com/photo-1594381898411-846e7d193883?w=800&q=80&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=800&q=80&auto=format&fit=crop',
    ],
    avatar: avatar('Lera', 'female'),
    gymIds: [DEMO_GYM_ID],
    homeGymId: DEMO_GYM_ID,
    city: 'Москва',
    intent: 'dating',
    experienceLevel: 'confident',
    interests: ['Знакомства', 'Бег', 'Утренние тренировки'],
    sports: ['Бег', 'Тренажёрный зал'],
    isCoach: false,
    coachSports: [],
    visitSlots: [
      { day: 'Вт', from: '08:00', to: '09:30' },
      { day: 'Чт', from: '08:00', to: '09:30' },
    ],
    privacy: 'open',
    lookingToMeet: true,
    isActive: false,
    checkedInGymId: '',
    lastSeenAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    verified: true,
  },
  {
    id: 'u-anon',
    username: 'anon_spot',
    name: 'Аноним',
    age: 27,
    gender: 'male',
    bio: 'Профиль скрыт. Можно написать — открою себя, если откликнется.',
    photos: [],
    avatar: avatar('Anon', 'male'),
    gymIds: [DEMO_GYM_ID],
    homeGymId: DEMO_GYM_ID,
    city: 'Москва',
    intent: 'dating',
    experienceLevel: 'newbie',
    interests: ['Знакомства'],
    sports: ['Кроссфит'],
    isCoach: false,
    coachSports: [],
    visitSlots: [{ day: 'Пн', from: '20:00', to: '22:00' }],
    privacy: 'anonymous',
    lookingToMeet: true,
    isActive: true,
    checkedInGymId: DEMO_GYM_ID,
    lastSeenAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
  },
  {
    id: 'u-katya',
    username: 'katya_yoga',
    name: 'Катя',
    age: 31,
    gender: 'female',
    bio: 'Тренер по йоге и пилатесу. Ищу учеников и иногда — кофе после практики.',
    photos: [
      'https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=800&q=80&auto=format&fit=crop',
    ],
    avatar: avatar('Katya', 'female'),
    gymIds: ['gym-spirit-fitness-spirit-fitness-belyaevo-moskva'],
    homeGymId: 'gym-spirit-fitness-spirit-fitness-belyaevo-moskva',
    city: 'Москва',
    intent: 'both',
    experienceLevel: 'pro',
    interests: ['Йога', 'Тренировочный партнёр', 'Знакомства'],
    sports: ['Йога', 'Пилатес'],
    isCoach: true,
    coachSports: ['Йога', 'Пилатес'],
    visitSlots: [
      { day: 'Пн', from: '18:00', to: '19:30' },
      { day: 'Ср', from: '18:00', to: '19:30' },
    ],
    privacy: 'open',
    lookingToMeet: false,
    isActive: false,
    checkedInGymId: '',
    lastSeenAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    id: 'u-danya',
    username: 'danya_box',
    name: 'Даня',
    age: 28,
    gender: 'male',
    bio: 'Тренер по боксу. В зале часто — можно пересечься на мешках.',
    photos: [
      'https://images.unsplash.com/photo-1605296867304-46d5465a13f1?w=800&q=80&auto=format&fit=crop',
    ],
    avatar: avatar('Danya', 'male'),
    gymIds: ['gym-ddx-fitness-ddx-aviapark-moskva', DEMO_GYM_ID],
    homeGymId: 'gym-ddx-fitness-ddx-aviapark-moskva',
    city: 'Москва',
    intent: 'buddy',
    experienceLevel: 'experienced',
    interests: ['Тренировочный партнёр', 'Бокс'],
    sports: ['Бокс / единоборства', 'Функционал'],
    isCoach: true,
    coachSports: ['Бокс'],
    visitSlots: [
      { day: 'Пн', from: '12:00', to: '13:30' },
      { day: 'Пт', from: '12:00', to: '13:30' },
    ],
    privacy: 'open',
    lookingToMeet: true,
    isActive: true,
    checkedInGymId: 'gym-ddx-fitness-ddx-aviapark-moskva',
    lastSeenAt: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
  },
]

export const SEED_CONVERSATIONS: Conversation[] = [
  {
    id: 'c-1',
    participantIds: ['me', 'u-masha'],
    lastMessage: 'Завтра буду около 19:30, пересечёмся у свободных весов?',
    updatedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    unreadCount: 1,
    requestStatus: 'accepted',
  },
  {
    id: 'c-2',
    participantIds: ['me', 'u-ivan'],
    lastMessage: 'Ок, могу подстраховать на жиме',
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    unreadCount: 0,
    requestStatus: 'accepted',
  },
  {
    id: 'c-3',
    participantIds: ['me', 'u-lera'],
    lastMessage: 'Привет! Тоже бегаешь по утрам?',
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    unreadCount: 0,
    requestStatus: 'pending',
  },
]

export const SEED_MESSAGES: Message[] = [
  {
    id: 'm-1',
    conversationId: 'c-1',
    senderId: 'me',
    text: 'Привет! Видел, что тоже вечером на силовых',
    createdAt: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
    status: 'read',
  },
  {
    id: 'm-2',
    conversationId: 'c-1',
    senderId: 'u-masha',
    text: 'Да! Обычно Пн/Ср/Пт. Ты тоже World Class?',
    createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    status: 'read',
  },
  {
    id: 'm-3',
    conversationId: 'c-1',
    senderId: 'me',
    text: 'Ага. Может, пересечёмся завтра?',
    createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    status: 'read',
  },
  {
    id: 'm-4',
    conversationId: 'c-1',
    senderId: 'u-masha',
    text: 'Завтра буду около 19:30, пересечёмся у свободных весов?',
    createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    status: 'delivered',
  },
  {
    id: 'm-5',
    conversationId: 'c-2',
    senderId: 'u-ivan',
    text: 'Брат, нужна страховка на жиме?',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    status: 'read',
  },
  {
    id: 'm-6',
    conversationId: 'c-2',
    senderId: 'me',
    text: 'Ок, могу подстраховать на жиме',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    status: 'read',
  },
  {
    id: 'm-7',
    conversationId: 'c-3',
    senderId: 'me',
    text: 'Привет! Тоже бегаешь по утрам?',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    status: 'read',
  },
]

export function getGym(id: string) {
  return GYMS.find((g) => g.id === id)
}

export function getUser(id: string) {
  return USERS.find((u) => u.id === id)
}

export function usersInGym(gymId: string) {
  return USERS.filter((u) => u.gymIds.includes(gymId))
}

/** Участники зала + текущий пользователь; «в зале» только для этого клуба */
export function peopleInGym(
  gymId: string,
  currentUser?: UserProfile | null,
  options?: { includeSeedPeople?: boolean },
) {
  const withPresence = (person: UserProfile): UserProfile => ({
    ...person,
    isActive: isPresentInGym(person, gymId),
  })
  // По умолчанию без сидов — только демо-аккаунт явно включает людей из mock
  const includeSeed = options?.includeSeedPeople === true
  const list = includeSeed ? usersInGym(gymId).map(withPresence) : []
  if (!currentUser?.gymIds?.includes(gymId)) return list
  const asProfile = withPresence({ ...currentUser, id: currentUser.id })
  return [asProfile, ...list.filter((u) => u.id !== currentUser.id)]
}

/**
 * Люди на странице клуба.
 * Сиды только при includeSeedPeople (аккаунт demo@demo.ru).
 * Без сидов — только текущий пользователь, если он в этом клубе.
 */
export function peopleForGymPage(
  gymId: string,
  currentUser?: UserProfile | null,
  options?: { includeSeedPeople?: boolean },
): UserProfile[] {
  const includeSeed = options?.includeSeedPeople === true

  if (!includeSeed) {
    return peopleInGym(gymId, currentUser, { includeSeedPeople: false })
  }

  const fixed = usersInGym(gymId)
  const browseFallback = fixed.length === 0
  const source = browseFallback ? USERS : fixed

  const asMember = (person: UserProfile): UserProfile => {
    const gymIds = person.gymIds.includes(gymId) ? person.gymIds : [gymId, ...person.gymIds]
    const checkedInGymId =
      browseFallback && person.isActive ? gymId : person.checkedInGymId
    const next = { ...person, gymIds, checkedInGymId }
    return {
      ...next,
      homeGymId: person.gymIds.includes(gymId) ? person.homeGymId || gymId : gymId,
      isActive: isPresentInGym(next, gymId),
    }
  }

  let list = source.map(asMember)
  if (currentUser?.gymIds?.includes(gymId)) {
    const me = asMember({ ...currentUser, id: currentUser.id })
    list = [me, ...list.filter((u) => u.id !== currentUser.id && u.id !== 'me')]
  }
  return list
}

export function getUserGyms(user: Pick<UserProfile, 'gymIds'>) {
  return user.gymIds.map((id) => getGym(id)).filter(Boolean) as Gym[]
}

/** Зал контакта для чата: общий с тобой, иначе home, иначе первый */
export function getContactGym(
  contact: Pick<UserProfile, 'gymIds' | 'homeGymId'>,
  myGymIds: string[] = [],
) {
  const shared = contact.gymIds.find((id) => myGymIds.includes(id))
  const preferred = shared || contact.homeGymId || contact.gymIds[0]
  return preferred ? getGym(preferred) : undefined
}

/** Короткое имя клуба без сети (сеть показываем отдельно) */
export function shortGymName(name: string, network?: string) {
  let next = name.trim()
  const prefixes = [
    network,
    'Spirit. Fitness',
    'Spirit Fitness',
    'World Class',
    'Crocus Fitness',
    'Alex Fitness',
    'DDX Fitness',
    'DDX',
    'Encore',
    'XFIT',
  ].filter(Boolean) as string[]

  for (const prefix of prefixes) {
    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    next = next.replace(new RegExp(`^${escaped}\\s+`, 'i'), '')
  }
  return next.trim() || name.trim()
}

/**
 * Красивый перенос названия: если длинное / много слов —
 * последняя часть уходит на вторую строку (Matveevskiy, «Красная Площадь»).
 */
export function gymTitleLines(name: string, network?: string): string[] {
  const title = shortGymName(name, network)
  const words = title.split(/\s+/).filter(Boolean)
  if (words.length <= 1) return [title]
  if (title.length <= 16 && words.length === 2) return [title]
  if (words.length === 2) return [words[0], words[1]]
  return [words.slice(0, -1).join(' '), words[words.length - 1]]
}

export function formatGymLabel(gym: Gym | undefined) {
  if (!gym) return ''
  const shortName = shortGymName(gym.name, gym.network)
  return `${gym.network} · ${shortName || gym.name}`
}

function addressKey(value: string) {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/**
 * Строка адреса без дубля названия клуба/района.
 * «Матвеевский» уже в заголовке → в адресе только метро/улица.
 */
/** После «м. Станция» — запятая, если её не было */
function polishMetroAddress(address: string) {
  if (!/^м\./i.test(address)) return address
  if (/^м\.\s*[^,]+,/i.test(address)) return address
  // м. Автозаводская ТРЦ… → м. Автозаводская, ТРЦ…
  // м. Крылатское Осенний б-р… → м. Крылатское, Осенний б-р…
  return address.replace(
    /^(м\.\s*\S+)\s+(?=(?:ТЦ|ТРЦ|ТОЦ|МФК|ул\.|улица|пр\.|просп\.|шоссе|б-р|наб\.|д\.|\S))/i,
    '$1, ',
  )
}

export function formatGymAddress(gym: Pick<Gym, 'name' | 'network' | 'district' | 'address'>) {
  const titleKey = addressKey(shortGymName(gym.name, gym.network))
  const district = (gym.district || '').trim()
  const address = polishMetroAddress((gym.address || '').trim())
  const districtKey = addressKey(district)
  const addressKeyValue = addressKey(address)

  const districtDuplicatesTitle =
    Boolean(districtKey) &&
    Boolean(titleKey) &&
    (districtKey === titleKey ||
      titleKey.includes(districtKey) ||
      districtKey.includes(titleKey))

  const addressAlreadyHasDistrict =
    Boolean(districtKey) && addressKeyValue.includes(districtKey)

  const parts: string[] = []
  if (district && !districtDuplicatesTitle && !addressAlreadyHasDistrict) {
    parts.push(district)
  }
  if (address) parts.push(address)
  return parts.join(' · ')
}

/**
 * Адрес для баннера: метро на первой строке, остальное — на второй.
 * Без метро оставляем одной строкой.
 */
export function formatGymAddressLines(
  gym: Pick<Gym, 'name' | 'network' | 'district' | 'address'>,
): string[] {
  const full = formatGymAddress(gym)
  if (!full) return []

  const metroSplit = full.match(/^(м\.\s*[^,]+),\s*(.+)$/i)
  if (metroSplit) {
    return [metroSplit[1].trim(), metroSplit[2].trim()]
  }

  return [full]
}

export function displayName(user: UserProfile) {
  return user.privacy === 'anonymous' ? 'Аноним' : user.name
}

export function intentLabel(intent: UserProfile['intent']) {
  if (intent === 'dating') return 'Знакомства'
  if (intent === 'buddy') return 'Партнёр по залу'
  return 'Знакомства и тренировки'
}

export function experienceLabel(level?: ExperienceLevel | null) {
  return EXPERIENCE_LEVELS.find((item) => item.value === level)?.label ?? ''
}

export function normalizeExperienceLevel(value: unknown): ExperienceLevel {
  if (
    value === 'newbie' ||
    value === 'confident' ||
    value === 'experienced' ||
    value === 'pro'
  ) {
    return value
  }
  return 'confident'
}
