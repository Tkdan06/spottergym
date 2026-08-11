/** Copy for /lp ad landing + matching Telegram creatives */

export type LandingDemoProfile = {
  id: string
  name: string
  age: number
  photo: string
  gym: string
  line: string
  inGym: boolean
  open: boolean
  isCoach?: boolean
  /** Fake like count for demo cards */
  likeCount: number
  /** Small avatars of “likers” (other demo faces) */
  likerPhotos: string[]
}

export const LANDING = {
  metaTitle: 'SPOTTER — знакомства и партнёры в зале',
  metaDescription:
    'Spotter — сервис для тех, кто ходит в зал: знакомства и партнёры в твоём клубе. Увидел в зале — написал. Чат после принятия запроса.',

  hero: {
    kicker: 'Знакомства · партнёры',
    headline: 'Увидел в зале — написал в Spotter',
    lead: 'Люди твоего клуба. Видно, кто в зале и кто открыт к общению.',
    ctaPrimary: 'Найти людей в своём клубе',
    ctaSecondary: 'Войти',
    demoCaption: 'Люди в клубе',
  },

  demoProfiles: [
    {
      id: 'demo-masha',
      name: 'Маша',
      age: 26,
      photo: '/images/lp/demo/masha.png',
      gym: 'DDX · Ленинградский',
      line: 'Знакомства · силовые',
      inGym: true,
      open: true,
      likeCount: 12,
      likerPhotos: ['/images/lp/demo/liker-1.png', '/images/lp/demo/liker-2.png'],
    },
    {
      id: 'demo-ivan',
      name: 'Иван',
      age: 29,
      photo: '/images/lp/demo/ivan.png',
      gym: 'DDX · Ленинградский',
      line: 'Партнёр по залу · жим',
      inGym: true,
      open: true,
      likeCount: 8,
      likerPhotos: ['/images/lp/demo/liker-3.png', '/images/lp/demo/liker-4.png'],
    },
    {
      id: 'demo-katya',
      name: 'Катя',
      age: 31,
      photo: '/images/lp/demo/katya.png',
      gym: 'Spirit Fitness · Крылатское',
      line: 'Знакомства · функционалка',
      inGym: false,
      open: true,
      likeCount: 24,
      likerPhotos: ['/images/lp/demo/liker-2.png', '/images/lp/demo/liker-3.png'],
    },
  ] satisfies LandingDemoProfile[],

  /** Pain → how Spotter helps (one screen) */
  painOffer: {
    title: 'Знакомо?',
    lead: 'Сервис для тех, кто ходит в зал: партнёр, друг и новые знакомства в твоём клубе.',
    items: [
      {
        pain: 'Нравится человек в зале — хочется подойти, но не получается: неловко.',
        fix: 'Смотришь статус и отправляешь запрос — без подхода у зеркала.',
      },
      {
        pain: 'Нужен партнёр или компания, а все в наушниках и в своём мире.',
        fix: 'Видишь людей своего клуба и пишешь тем, кто открыт к общению.',
      },
      {
        pain: 'Новый клуб — снова с нуля: не с кем потренироваться и нет знакомых.',
        fix: 'Сразу видишь, кто ходит в этот зал, и можешь написать первым.',
      },
    ],
  },

  steps: {
    title: 'Как начать',
    items: [
      {
        step: '1',
        title: 'Выбери свой клуб',
        body: 'Привязываешь зал — и видишь людей именно оттуда.',
      },
      {
        step: '2',
        title: 'Смотри профили',
        body: 'Понятно, кому уместно написать — без догадок.',
      },
      {
        step: '3',
        title: 'Отправь запрос',
        body: 'Чат откроется, только если человек принял.',
      },
    ],
  },

  scenarios: {
    title: 'Для кого Spotter',
    items: [
      {
        id: 'dating',
        title: 'Знакомства',
        body: 'Нравится человек в зале — открываешь профиль и пишешь, если он открыт к общению.',
        image: '/images/lp/people-dating.jpg',
      },
      {
        id: 'partner',
        title: 'Партнёр по залу',
        body: 'Нужен напарник на жим и присед в том же клубе. Договорились в чате — встретились на сеты.',
        image: '/images/lp/people-partner.jpg',
      },
      {
        id: 'company',
        title: 'Компания на тренировку',
        body: 'Не весь вечер один в наушниках: находишь, с кем перекинуться словом между подходами.',
        image: '/images/lp/people-company.jpg',
      },
    ],
  },

  finalCta: {
    title: 'Увидел в зале — напиши в Spotter',
    lead: 'Сервис для тех, кто ходит в зал. Выбери клуб, смотри профили и пиши людям из своего клуба — находи единомышленников и новые знакомства.',
    ctaPrimary: 'Создать аккаунт',
    ctaSecondary: 'Войти',
  },
} as const

/** Telegram ads — same promise as hero (keep creatives in sync) */
export const LANDING_TELEGRAM_ADS = [
  {
    id: 'tg-a',
    name: 'Hero mirror',
    text: [
      'Увидел в зале — написал в Spotter.',
      'Соцсеть для тех, кто ходит в зал: знакомства, партнёры и тренеры в твоём клубе.',
      '',
      '👉 spottergym.ru/lp?utm_source=telegram&utm_medium=ad&utm_campaign=tg-a',
    ].join('\n'),
  },
  {
    id: 'tg-b',
    name: 'Pain → status',
    text: [
      'Стесняется подойти в зале?',
      'В Spotter видно статус: в зале / открыт к общению.',
      '',
      'Знакомства и партнёры — в твоём клубе.',
      '👉 spottergym.ru/lp?utm_source=telegram&utm_medium=ad&utm_campaign=tg-b',
    ].join('\n'),
  },
  {
    id: 'tg-c',
    name: 'Buddy angle',
    text: [
      'Ищешь партнёра по залу в своём клубе?',
      'Spotter: кто рядом, кто на тренировке, кто готов договориться.',
      '',
      '👉 spottergym.ru/lp?utm_source=telegram&utm_medium=ad&utm_campaign=tg-c',
    ].join('\n'),
  },
  {
    id: 'tg-d',
    name: 'New gym',
    text: [
      'Перешёл в другой зал?',
      'В Spotter находишь, с кем потренироваться и познакомиться — не с нуля.',
      '',
      '👉 spottergym.ru/lp?utm_source=telegram&utm_medium=ad&utm_campaign=tg-d',
    ].join('\n'),
  },
  {
    id: 'tg-e',
    name: 'Coaches',
    text: [
      'Тренер в зале? Клиенты из твоего клуба сами смотрят профиль и пишут запрос.',
      'Spotter — аудитория в своём клубе, без холодных подходов у стойки.',
      '',
      '👉 spottergym.ru/lp-coaches?utm_source=telegram&utm_medium=ad&utm_campaign=tg-e',
    ].join('\n'),
  },
] as const

/** Dedicated landing for coach acquisition campaigns — /lp-coaches */
export const LANDING_COACHES = {
  metaTitle: 'SPOTTER для тренеров — клиенты из твоего клуба',
  metaDescription:
    'Spotter для тренеров: отметь направления в профиле — люди из твоего клуба сами пишут запрос. Аудитория рядом, без холодных подходов.',

  hero: {
    kicker: 'Для тренеров',
    headline: 'Клиенты из твоего клуба пишут сами',
    lead: 'Отметь, что ты тренер, укажи направления — люди из зала видят профиль и отправляют запрос.',
    ctaPrimary: 'Создать профиль тренера',
    ctaSecondary: 'Войти',
  },

  demoProfiles: [
    {
      id: 'demo-coach-katya',
      name: 'Катя',
      age: 31,
      photo: '/images/lp/demo/katya.png',
      gym: 'Spirit Fitness · Крылатское',
      line: 'Тренер · силовой · стретчинг',
      inGym: true,
      open: true,
      isCoach: true,
      likeCount: 24,
      likerPhotos: ['/images/lp/demo/liker-1.png', '/images/lp/demo/liker-3.png'],
    },
    {
      id: 'demo-coach-client',
      name: 'Иван',
      age: 29,
      photo: '/images/lp/demo/ivan.png',
      gym: 'Spirit Fitness · Крылатское',
      line: 'Ищет тренера · силовые',
      inGym: true,
      open: true,
      likeCount: 6,
      likerPhotos: ['/images/lp/demo/liker-2.png', '/images/lp/demo/liker-4.png'],
    },
  ] satisfies LandingDemoProfile[],

  image: '/images/lp/people-coach-client.jpg',

  value: {
    title: 'Зачем Spotter тренеру',
    lead: 'Аудитория уже в твоём клубе. Ты не ищешь клиентов по городу — они находят тебя по профилю.',
    items: [
      {
        title: 'Свой клуб',
        body: 'Тебя видят люди, которые реально ходят в тот же зал.',
      },
      {
        title: 'Профиль вместо холодного подхода',
        body: 'Направления и «о себе» — клиент сам решает написать.',
      },
      {
        title: 'Запрос, потом чат',
        body: 'Переписка только если ты принял. Без спама в личку.',
      },
    ],
  },

  forCoaches: {
    title: 'Если ты тренер',
    items: [
      'Отметь в профиле, что ты тренер',
      'Укажи направления: сила, функционалка, стретчинг…',
      'Получай запросы от людей своего клуба',
    ],
  },

  steps: {
    title: 'Как начать',
    items: [
      {
        step: '1',
        title: 'Зарегистрируйся и выбери клуб',
        body: 'Тот зал, где ты работаешь или тренируешь.',
      },
      {
        step: '2',
        title: 'Отметь, что ты тренер',
        body: 'Добавь направления и коротко «о себе».',
      },
      {
        step: '3',
        title: 'Принимай запросы',
        body: 'Клиенты из клуба пишут сами — чат открывается, когда ты принял.',
      },
    ],
  },

  finalCta: {
    title: 'Найди аудиторию в своём клубе',
    lead: 'Создай профиль тренера в Spotter — и получай запросы от людей, которые уже рядом.',
    ctaPrimary: 'Создать профиль тренера',
    ctaSecondary: 'Войти',
  },
} as const
