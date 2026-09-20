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
  metaTitle: 'SPOTTER — социальная сеть твоего зала',
  metaDescription:
    'Spotter — социальная сеть для тех, кто ходит в зал: люди в клубе, дневник тренировок, активность и личный прогресс в одном месте.',

  hero: {
    kicker: 'Социальная сеть твоего зала',
    headline: 'Люди рядом. Тренировки под контролем.',
    lead: 'Отмечайся в зале, записывай тренировки, замечай прогресс и находи людей из своего клуба.',
    ctaPrimary: 'Начать в своём зале',
    ctaSecondary: 'Войти',
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
      likeCount: 3,
      likerPhotos: ['/images/lp/demo/liker-1.png'],
    },
    {
      id: 'demo-ivan',
      name: 'Иван',
      age: 29,
      photo: '/images/lp/demo/ivan.png',
      gym: 'DDX · Ленинградский',
      line: 'Партнёр по залу · жим',
      inGym: false,
      open: true,
      likeCount: 2,
      likerPhotos: ['/images/lp/demo/liker-3.png'],
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
      likeCount: 4,
      likerPhotos: ['/images/lp/demo/liker-2.png'],
    },
  ] satisfies LandingDemoProfile[],

  pillars: {
    title: 'Всё важное — в твоём зале',
    lead: 'Spotter помогает быть в ритме тренировок и чувствовать себя своим среди людей, которые ходят туда же.',
    items: [
      {
        id: 'people',
        title: 'Люди рядом',
        body: 'Смотри, кто сейчас в зале, находи партнёра, тренера или человека, с которым хочется познакомиться.',
      },
      {
        id: 'workout',
        title: 'Дневник без лишнего',
        body: 'Записывай упражнения, подходы, вес и личные заметки прямо во время тренировки.',
      },
      {
        id: 'progress',
        title: 'Прогресс, который видно',
        body: 'Возвращайся к истории, отслеживай нагрузку и замечай свои рекорды без ручных таблиц.',
      },
    ],
  },

  visitFlow: {
    title: 'Один визит в зал — одна понятная картина',
    items: [
      {
        step: '1',
        title: 'Пришёл',
        body: 'Отметь «Я в зале», если хочешь показать присутствие и увидеть, кто рядом.',
      },
      {
        step: '2',
        title: 'Потренировался',
        body: 'Запиши подходы и упражнения — тренировка сохранится в твоей истории.',
      },
      {
        step: '3',
        title: 'Вернулся',
        body: 'Смотри прогресс, планируй следующую тренировку или напиши человеку из клуба.',
      },
    ],
  },

  scenarios: {
    title: 'Люди в зале — без неловкости',
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
    title: 'Твой зал — люди, тренировки и прогресс в одном месте',
    lead: 'Начни с того, что нужно тебе сегодня: тренировки, активность или общение с людьми своего клуба.',
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
      'Spotter — социальная сеть твоего зала.',
      'Люди в клубе, дневник тренировок и прогресс — в одном месте.',
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
      likeCount: 4,
      likerPhotos: ['/images/lp/demo/liker-1.png'],
    },
    {
      id: 'demo-coach-client',
      name: 'Иван',
      age: 29,
      photo: '/images/lp/demo/ivan.png',
      gym: 'Spirit Fitness · Крылатское',
      line: 'Ищет тренера · силовые',
      inGym: false,
      open: true,
      likeCount: 2,
      likerPhotos: ['/images/lp/demo/liker-2.png'],
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
