/**
 * Curated clubs from official network pages (Encore, Crocus Fitness, XFIT, Alex Fitness).
 * Hours: from club contact pages where known; otherwise network defaults in gymHours.ts.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const gymsPath = join(root, 'src/data/gyms.json')
const citiesPath = join(root, 'src/data/cities.json')

const IMAGES = [
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=800&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1558611848-73f7eb4001a1?w=800&q=80&auto=format&fit=crop',
]

const TR = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
}

function slug(text) {
  return String(text)
    .toLowerCase()
    .split('')
    .map((ch) => TR[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function citySlug(city) {
  const map = {
    Москва: 'moskva',
    'Санкт-Петербург': 'sankt-peterburg',
    Екатеринбург: 'ekaterinburg',
    Сочи: 'sochi',
    Химки: 'himki',
    Новосибирск: 'novosibirsk',
    Воронеж: 'voronezh',
    Пермь: 'perm',
    Волгоград: 'volgograd',
    Краснодар: 'krasnodar',
  }
  return map[city] || slug(city)
}

function makeId(network, name, city) {
  return `gym-${slug(network)}-${slug(name)}-${citySlug(city)}`
}

function stableStats(id) {
  const h = createHash('sha1').update(id).digest()
  return {
    membersCount: 55 + (h[0] % 120),
    activeNow: h[1] % 14,
  }
}

/** @type {Array<{network:string,name:string,city:string,district:string,address:string,lat:number,lng:number,hours?:{weekdays:string,weekend:string,label:string}}>} */
const RAW = [
  // ——— Encore Fitness (encorefitness.ru/contacts) ———
  {
    network: 'Encore Fitness',
    name: 'Encore Сити',
    city: 'Москва',
    district: 'Москва-Сити',
    address: '1-й Красногвардейский проезд, 21, стр. 2, небоскрёб «ОКО», 3 этаж',
    lat: 55.7495,
    lng: 37.5345,
  },
  {
    network: 'Encore Fitness',
    name: 'Encore Ясенево',
    city: 'Москва',
    district: 'Ясенево',
    address: 'Новоясеневский проспект, 9',
    lat: 55.6018,
    lng: 37.5336,
  },
  {
    network: 'Encore Fitness',
    name: 'Encore Ходынка',
    city: 'Москва',
    district: 'Ходынка',
    address: 'ул. Авиаконструктора Сухого, 2, к. 1, ЖК «Лица»',
    lat: 55.7869,
    lng: 37.5348,
  },
  {
    network: 'Encore Fitness',
    name: 'Encore Васильевский',
    city: 'Санкт-Петербург',
    district: 'Васильевский остров',
    address: 'Средний проспект В.О., 83, стр. 2',
    lat: 59.9348,
    lng: 30.2415,
  },
  {
    network: 'Encore Fitness',
    name: 'Encore Крестовский',
    city: 'Санкт-Петербург',
    district: 'Крестовский',
    address: 'ул. Вязовая, 8',
    lat: 59.9712,
    lng: 30.2538,
  },
  {
    network: 'Encore Fitness',
    name: 'Encore Исеть',
    city: 'Екатеринбург',
    district: 'Исеть',
    address: 'ул. Бориса Ельцина, 6, башня «Исеть»',
    lat: 56.8435,
    lng: 60.5948,
  },
  {
    network: 'Encore Fitness',
    name: 'Encore Сан-Сити',
    city: 'Сочи',
    district: 'Сан-Сити',
    address: 'Курортный проспект, 108, ЖК «Сан-Сити»',
    lat: 43.5855,
    lng: 39.7231,
  },

  // ——— Crocus Fitness (crocusfitness.com/kontakty, /clubs) ———
  {
    network: 'Crocus Fitness',
    name: 'Crocus Fitness Искра Парк',
    city: 'Москва',
    district: 'Искра Парк',
    address: 'Ленинградский проспект, 35, стр. 1, подъезд 1, этаж 3',
    lat: 55.7892,
    lng: 37.5598,
    hours: {
      weekdays: '07:00–00:00',
      weekend: '08:00–22:00',
      label: 'Будни 07:00–00:00 · Сб–Вс 08:00–22:00',
    },
  },
  {
    network: 'Crocus Fitness',
    name: 'Crocus Fitness Первый',
    city: 'Москва',
    district: 'Крокус Сити',
    address: '66-й км МКАД, ТРК «Вегас Крокус Сити», 2 этаж',
    lat: 55.8235,
    lng: 37.3902,
    hours: {
      weekdays: '06:00–00:00',
      weekend: '08:00–00:00',
      label: 'Будни 06:00–00:00 · Сб–Вс 08:00–00:00',
    },
  },
  {
    network: 'Crocus Fitness',
    name: 'Crocus Fitness Кунцево',
    city: 'Москва',
    district: 'Кунцево',
    address: '55-й км МКАД, ТРК «VEGAS Кунцево»',
    lat: 55.7248,
    lng: 37.3905,
    hours: {
      weekdays: '06:00–01:00',
      weekend: '08:00–01:00',
      label: 'Будни 06:00–01:00 · Сб–Вс 08:00–01:00',
    },
  },
  {
    network: 'Crocus Fitness',
    name: 'Crocus Fitness Курская',
    city: 'Москва',
    district: 'Курская',
    address: 'ул. Земляной Вал, 41, стр. 1',
    lat: 55.7576,
    lng: 37.6608,
    hours: {
      weekdays: '06:00–00:00',
      weekend: '08:00–00:00',
      label: 'Будни 06:00–00:00 · Сб–Вс 08:00–00:00',
    },
  },
  {
    network: 'Crocus Fitness',
    name: 'Crocus Fitness Лужники',
    city: 'Москва',
    district: 'Лужники',
    address: 'ул. Лужники, 24, стр. 4',
    lat: 55.7158,
    lng: 37.5536,
    hours: {
      weekdays: '06:00–00:00',
      weekend: '08:00–00:00',
      label: 'Будни 06:00–00:00 · Сб–Вс 08:00–00:00',
    },
  },
  {
    network: 'Crocus Fitness',
    name: 'Crocus Fitness Neva Towers',
    city: 'Москва',
    district: 'Москва-Сити',
    address: '1-й Красногвардейский проезд, 22, стр. 2, башня «NEVA»',
    lat: 55.7508,
    lng: 37.5362,
    hours: {
      weekdays: '06:00–01:00',
      weekend: '06:00–01:00',
      label: 'Ежедневно 06:00–01:00',
    },
  },
  {
    network: 'Crocus Fitness',
    name: 'Crocus Fitness Ленинградский',
    city: 'Москва',
    district: 'Аэропорт',
    address: 'ул. Черняховского, 19',
    lat: 55.8042,
    lng: 37.5375,
    hours: {
      weekdays: '06:00–00:00',
      weekend: '08:00–00:00',
      label: 'Будни 06:00–00:00 · Сб–Вс 08:00–00:00',
    },
  },
  {
    network: 'Crocus Fitness',
    name: 'Crocus Fitness Кутузовский',
    city: 'Москва',
    district: 'Поклонная',
    address: 'ул. Поклонная, 9',
    lat: 55.7338,
    lng: 37.5195,
  },
  {
    network: 'Crocus Fitness',
    name: 'Crocus Fitness Навка Арена',
    city: 'Москва',
    district: 'Мнёвники',
    address: 'ул. Нижние Мнёвники, 10А',
    lat: 55.7612,
    lng: 37.4588,
  },
  {
    network: 'Crocus Fitness',
    name: 'Crocus Fitness Eleven',
    city: 'Москва',
    district: 'Пресня',
    address: 'Звенигородское шоссе, 11',
    lat: 55.7618,
    lng: 37.5472,
  },
  {
    network: 'Crocus Fitness',
    name: 'Crocus Fitness Петровский парк',
    city: 'Москва',
    district: 'Петровский парк',
    address: 'Ленинградский проспект, 36, стр. 33',
    lat: 55.7925,
    lng: 37.5582,
  },
  {
    network: 'Crocus Fitness',
    name: 'Crocus Fitness Чкалов Арена',
    city: 'Москва',
    district: 'Ходынское поле',
    address: 'ул. Спортивной Авиации, 3',
    lat: 55.7885,
    lng: 37.5288,
  },
  {
    network: 'Crocus Fitness',
    name: 'Crocus Fitness Studio',
    city: 'Москва',
    district: 'Крокус Сити',
    address: '66-й км МКАД, Крокус Сити, ст. м. Мякинино',
    lat: 55.8252,
    lng: 37.3885,
    hours: {
      weekdays: '10:00–22:00',
      weekend: '10:00–22:00',
      label: 'Ежедневно 10:00–22:00',
    },
  },

  // ——— XFIT (address-clubs.xfit.ru) ———
  {
    network: 'XFIT',
    name: 'XFIT Чистые пруды',
    city: 'Москва',
    district: 'Чистые пруды',
    address: 'ул. Жуковского, 14, стр. 1',
    lat: 55.7658,
    lng: 37.6385,
  },
  {
    network: 'XFIT',
    name: 'XFIT Алтуфьево',
    city: 'Москва',
    district: 'Алтуфьево',
    address: 'ул. Угличская, 13, к. 1, Лианозовский парк',
    lat: 55.8992,
    lng: 37.5855,
  },
  {
    network: 'XFIT',
    name: 'XFIT Сердце Столицы',
    city: 'Москва',
    district: 'Шелепиха',
    address: 'Шелепихинская наб., 34, к. 2',
    lat: 55.7572,
    lng: 37.5128,
  },
  {
    network: 'XFIT',
    name: 'XFIT Мосфильмовский',
    city: 'Москва',
    district: 'Мосфильмовский',
    address: 'ул. Мосфильмовская, 88, к. 2',
    lat: 55.7125,
    lng: 37.5058,
  },
  {
    network: 'XFIT',
    name: 'XFIT Парк Победы',
    city: 'Москва',
    district: 'Парк Победы',
    address: 'ул. Василисы Кожиной, 1',
    lat: 55.7362,
    lng: 37.5125,
  },
  {
    network: 'XFIT',
    name: 'XFIT Фьюжн',
    city: 'Москва',
    district: 'Фрунзенская',
    address: 'ул. Усачёва, 2, стр. 3',
    lat: 55.7278,
    lng: 37.5725,
  },
  {
    network: 'XFIT',
    name: 'XFIT Монарх',
    city: 'Москва',
    district: 'Динамо',
    address: 'Ленинградский проспект, 31А, стр. 1',
    lat: 55.7815,
    lng: 37.5602,
  },
  {
    network: 'XFIT',
    name: 'XFIT Нагатинская',
    city: 'Москва',
    district: 'Нагатинская',
    address: '1-й Нагатинский проезд, 10',
    lat: 55.6825,
    lng: 37.6288,
  },
  {
    network: 'XFIT',
    name: 'XFIT Бутово',
    city: 'Москва',
    district: 'Бутово',
    address: 'ул. Южнобутовская, 44',
    lat: 55.5458,
    lng: 37.5255,
  },
  {
    network: 'XFIT',
    name: 'XFIT Зиларт',
    city: 'Москва',
    district: 'Зиларт',
    address: 'б-р Братьев Весниных, 1',
    lat: 55.6985,
    lng: 37.6452,
  },
  {
    network: 'XFIT',
    name: 'XFIT Федосьино',
    city: 'Москва',
    district: 'Федосьино',
    address: 'ул. Федосьино, 12',
    lat: 55.6348,
    lng: 37.3355,
  },
  {
    network: 'XFIT',
    name: 'XFIT Планета',
    city: 'Москва',
    district: 'Бибирево',
    address: 'Алтуфьевское шоссе, 70',
    lat: 55.8795,
    lng: 37.5862,
  },
  {
    network: 'XFIT',
    name: 'XFIT Авиамоторная',
    city: 'Москва',
    district: 'Авиамоторная',
    address: 'ул. Авиамоторная, 10',
    lat: 55.7518,
    lng: 37.7175,
  },
  {
    network: 'XFIT',
    name: 'XFIT Отрадное',
    city: 'Москва',
    district: 'Отрадное',
    address: 'ул. Отрадная, 8',
    lat: 55.8612,
    lng: 37.6048,
  },
  {
    network: 'XFIT',
    name: 'XFIT Правда',
    city: 'Москва',
    district: 'Белорусская',
    address: 'ул. Правды, 21, стр. 2',
    lat: 55.7825,
    lng: 37.5818,
  },
  {
    network: 'XFIT',
    name: 'XFIT Флотская',
    city: 'Москва',
    district: 'Речной вокзал',
    address: 'ул. Флотская, 5В',
    lat: 55.8518,
    lng: 37.4765,
  },
  {
    network: 'XFIT',
    name: 'XFIT Химки',
    city: 'Химки',
    district: 'Химки',
    address: 'Юбилейный проспект, 1А',
    lat: 55.8895,
    lng: 37.4298,
  },
  {
    network: 'XFIT',
    name: 'XFIT Гагаринский',
    city: 'Санкт-Петербург',
    district: 'Гагаринский',
    address: 'проспект Юрия Гагарина, 71',
    lat: 59.8425,
    lng: 30.3485,
  },
  {
    network: 'XFIT',
    name: 'XFIT Морской фасад',
    city: 'Санкт-Петербург',
    district: 'Морской фасад',
    address: 'ул. Кораблестроителей, 32/2',
    lat: 59.9385,
    lng: 30.2185,
  },
  {
    network: 'XFIT',
    name: 'XFIT Клевер',
    city: 'Екатеринбург',
    district: 'Клевер',
    address: 'ул. Ткачей, 17',
    lat: 56.8385,
    lng: 60.6255,
  },
  {
    network: 'XFIT',
    name: 'XFIT Плаза',
    city: 'Новосибирск',
    district: 'Плаза',
    address: 'ул. Кирова, 23',
    lat: 55.0285,
    lng: 82.9235,
  },
  {
    network: 'XFIT',
    name: 'XFIT Сан-Сити',
    city: 'Новосибирск',
    district: 'Сан-Сити',
    address: 'пл. Карла Маркса, ТЦ «Сан Сити»',
    lat: 54.9825,
    lng: 82.8925,
  },
  {
    network: 'XFIT',
    name: 'XFIT Олимп',
    city: 'Воронеж',
    district: 'Олимп',
    address: 'ул. Карла Маркса, 67',
    lat: 51.6685,
    lng: 39.2085,
  },
  {
    network: 'XFIT',
    name: 'XFIT Жемчужина',
    city: 'Пермь',
    district: 'Жемчужина',
    address: 'ул. Газеты «Звезда», 46А',
    lat: 58.0105,
    lng: 56.2502,
  },
  {
    network: 'XFIT',
    name: 'XFIT Волгоград',
    city: 'Волгоград',
    district: 'Волгоград',
    address: 'ул. Маршала Рокоссовского, 62',
    lat: 48.7155,
    lng: 44.5015,
  },
  {
    network: 'XFIT',
    name: 'XFIT Меридиан',
    city: 'Краснодар',
    district: 'Меридиан',
    address: 'ул. Стасова, 182/1',
    lat: 45.0445,
    lng: 38.9765,
  },

  // ——— Alex Fitness (msk.alexfitness.ru) ———
  {
    network: 'Alex Fitness',
    name: 'Alex Fitness Коломенское',
    city: 'Москва',
    district: 'Коломенское',
    address: 'проспект Андропова, 22, БЦ «Нагатинский»',
    lat: 55.6775,
    lng: 37.6638,
  },
  {
    network: 'Alex Fitness',
    name: 'Alex Fitness Филион',
    city: 'Москва',
    district: 'Фили',
    address: 'Багратионовский проезд, 5, ТРЦ «Филион»',
    lat: 55.7435,
    lng: 37.5035,
  },
]

const PRIORITY = new Set([
  'Москва',
  'Санкт-Петербург',
  'Казань',
  'Екатеринбург',
  'Новосибирск',
  'Краснодар',
  'Самара',
  'Ростов-на-Дону',
  'Уфа',
  'Челябинск',
  'Воронеж',
  'Пермь',
  'Волгоград',
  'Красноярск',
  'Сочи',
  'Тюмень',
  'Иркутск',
  'Владивосток',
])

const NETWORK_ORDER = [
  'DDX Fitness',
  'Spirit. Fitness',
  'World Class',
  'Encore Fitness',
  'Crocus Fitness',
  'XFIT',
  'Alex Fitness',
]

function buildCities(gyms) {
  /** @type {Map<string, {name:string,gymCount:number,networks:Set<string>}>} */
  const byCity = new Map()
  for (const g of gyms) {
    let row = byCity.get(g.city)
    if (!row) {
      row = { name: g.city, gymCount: 0, networks: new Set() }
      byCity.set(g.city, row)
    }
    row.gymCount += 1
    row.networks.add(g.network)
  }

  const list = [...byCity.values()].map((row) => ({
    name: row.name,
    gymCount: row.gymCount,
    networks: NETWORK_ORDER.filter((n) => row.networks.has(n)).concat(
      [...row.networks].filter((n) => !NETWORK_ORDER.includes(n)).sort(),
    ),
    priority: PRIORITY.has(row.name),
  }))

  list.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority ? -1 : 1
    if (a.priority && b.priority) {
      return [...PRIORITY].indexOf(a.name) - [...PRIORITY].indexOf(b.name)
    }
    return b.gymCount - a.gymCount || a.name.localeCompare(b.name, 'ru')
  })

  return list
}

const existing = JSON.parse(readFileSync(gymsPath, 'utf8'))
const byId = new Map(existing.map((g) => [g.id, g]))

/** club hours for gymHours.ts dump */
const clubHours = {}

let added = 0
for (const [i, raw] of RAW.entries()) {
  const id = makeId(raw.network, raw.name, raw.city)
  if (byId.has(id)) continue
  const stats = stableStats(id)
  const gym = {
    id,
    name: raw.name,
    network: raw.network,
    city: raw.city,
    district: raw.district,
    address: raw.address,
    membersCount: stats.membersCount,
    activeNow: stats.activeNow,
    image: IMAGES[i % IMAGES.length],
    lat: raw.lat,
    lng: raw.lng,
  }
  byId.set(id, gym)
  added += 1
  if (raw.hours) clubHours[id] = raw.hours
}

const gyms = [...byId.values()].sort((a, b) => {
  if (a.network !== b.network) return a.network.localeCompare(b.network, 'en')
  if (a.city !== b.city) return a.city.localeCompare(b.city, 'ru')
  return a.name.localeCompare(b.name, 'ru')
})

writeFileSync(gymsPath, `${JSON.stringify(gyms, null, 2)}\n`)
writeFileSync(citiesPath, `${JSON.stringify(buildCities(gyms), null, 2)}\n`)

console.log(
  JSON.stringify(
    {
      added,
      totalGyms: gyms.length,
      moscow: gyms.filter((g) => g.city === 'Москва').length,
      byNetwork: Object.fromEntries(
        NETWORK_ORDER.map((n) => [n, gyms.filter((g) => g.network === n).length]),
      ),
      clubHoursKeys: Object.keys(clubHours),
      clubHours,
    },
    null,
    2,
  ),
)
