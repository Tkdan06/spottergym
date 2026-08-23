import type { Gym } from '../types'

export type GymHours = {
  weekdays: string
  weekend: string
  /** Короткая строка для UI */
  label: string
  /** Откуда взяли: сеть / уточнение по клубу */
  source: 'network' | 'club'
}

/** Типичные часы сетей (публичные расписания клубов; точные часы лучше уточнять на сайте сети) */
const NETWORK_HOURS: Record<string, Omit<GymHours, 'source'>> = {
  'World Class': {
    weekdays: '07:00–00:00',
    weekend: '09:00–00:00',
    label: 'Будни 07:00–00:00 · Сб–Вс 09:00–00:00',
  },
  'DDX Fitness': {
    weekdays: '06:00–00:00',
    weekend: '08:00–00:00',
    label: 'Будни 06:00–00:00 · Сб–Вс 08:00–00:00',
  },
  'Spirit. Fitness': {
    weekdays: '07:00–23:00',
    weekend: '09:00–22:00',
    label: 'Будни 07:00–23:00 · Сб–Вс 09:00–22:00',
  },
  'Encore Fitness': {
    weekdays: '07:00–23:00',
    weekend: '09:00–22:00',
    label: 'Будни 07:00–23:00 · Сб–Вс 09:00–22:00',
  },
  'Crocus Fitness': {
    weekdays: '06:00–00:00',
    weekend: '08:00–00:00',
    label: 'Будни 06:00–00:00 · Сб–Вс 08:00–00:00',
  },
  XFIT: {
    weekdays: '07:00–00:00',
    weekend: '08:00–00:00',
    label: 'Будни 07:00–00:00 · Сб–Вс 08:00–00:00',
  },
  'Alex Fitness': {
    weekdays: '07:00–00:00',
    weekend: '08:00–23:00',
    label: 'Будни 07:00–00:00 · Сб–Вс 08:00–23:00',
  },
  'Fitness 24': {
    weekdays: 'Круглосуточно',
    weekend: 'Круглосуточно',
    label: 'Круглосуточно',
  },
}

/** Уточнения по отдельным клубам (из карточек сетей / контактов) */
const CLUB_HOURS: Record<string, Omit<GymHours, 'source'>> = {
  'gym-spirit-fitness-spirit-fitness-matveevskiy-moskva': {
    weekdays: 'Круглосуточно',
    weekend: 'Круглосуточно',
    label: 'Круглосуточно',
  },
  'gym-world-class-world-class-tverskaya-moskva': {
    weekdays: '07:00–00:00',
    weekend: '09:00–00:00',
    label: 'Будни 07:00–00:00 · Сб, Вс и праздники 09:00–00:00',
  },
  'gym-crocus-fitness-crocus-fitness-iskra-park-moskva': {
    weekdays: '07:00–00:00',
    weekend: '08:00–22:00',
    label: 'Будни 07:00–00:00 · Сб–Вс 08:00–22:00',
  },
  'gym-crocus-fitness-crocus-fitness-pervyy-moskva': {
    weekdays: '06:00–00:00',
    weekend: '08:00–00:00',
    label: 'Будни 06:00–00:00 · Сб–Вс 08:00–00:00',
  },
  'gym-crocus-fitness-crocus-fitness-kuntsevo-moskva': {
    weekdays: '06:00–01:00',
    weekend: '08:00–01:00',
    label: 'Будни 06:00–01:00 · Сб–Вс 08:00–01:00',
  },
  'gym-crocus-fitness-crocus-fitness-kurskaya-moskva': {
    weekdays: '06:00–00:00',
    weekend: '08:00–00:00',
    label: 'Будни 06:00–00:00 · Сб–Вс 08:00–00:00',
  },
  'gym-crocus-fitness-crocus-fitness-luzhniki-moskva': {
    weekdays: '06:00–00:00',
    weekend: '08:00–00:00',
    label: 'Будни 06:00–00:00 · Сб–Вс 08:00–00:00',
  },
  'gym-crocus-fitness-crocus-fitness-neva-towers-moskva': {
    weekdays: '06:00–01:00',
    weekend: '06:00–01:00',
    label: 'Ежедневно 06:00–01:00',
  },
  'gym-crocus-fitness-crocus-fitness-leningradskiy-moskva': {
    weekdays: '06:00–00:00',
    weekend: '08:00–00:00',
    label: 'Будни 06:00–00:00 · Сб–Вс 08:00–00:00',
  },
  'gym-crocus-fitness-crocus-fitness-studio-moskva': {
    weekdays: '10:00–22:00',
    weekend: '10:00–22:00',
    label: 'Ежедневно 10:00–22:00',
  },
}

const FALLBACK: Omit<GymHours, 'source'> = {
  weekdays: '07:00–23:00',
  weekend: '09:00–22:00',
  label: 'Будни 07:00–23:00 · Сб–Вс 09:00–22:00',
}

export function getGymHours(gym: Pick<Gym, 'id' | 'network'>): GymHours {
  const club = CLUB_HOURS[gym.id]
  if (club) return { ...club, source: 'club' }
  const network = NETWORK_HOURS[gym.network]
  if (network) return { ...network, source: 'network' }
  return { ...FALLBACK, source: 'network' }
}
