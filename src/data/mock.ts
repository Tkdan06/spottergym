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
] as const

export const GYMS: Gym[] = gymsData as Gym[]

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
  'Бег',
  'Йога',
  'Пилатес',
  'Плавание',
  'Бокс',
  'Вело',
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
    id: 'u-masha',
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
    sports: ['Бокс', 'Функционал'],
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
export function peopleInGym(gymId: string, currentUser?: UserProfile | null) {
  const withPresence = (person: UserProfile): UserProfile => ({
    ...person,
    isActive: isPresentInGym(person, gymId),
  })
  const list = usersInGym(gymId).map(withPresence)
  if (!currentUser?.gymIds?.includes(gymId)) return list
  const asProfile = withPresence({ ...currentUser, id: currentUser.id })
  return [asProfile, ...list.filter((u) => u.id !== currentUser.id)]
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

export function formatGymLabel(gym: Gym | undefined) {
  if (!gym) return ''
  const shortName = gym.name
    .replace(/^DDX\s+/i, '')
    .replace(/^Spirit\.?\s*Fitness\s+/i, '')
    .replace(/^World Class\s+/i, '')
    .trim()
  return `${gym.network} · ${shortName || gym.name}`
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
