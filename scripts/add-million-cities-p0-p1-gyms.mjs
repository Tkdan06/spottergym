/**
 * Add P0–P1 millionaire-city gyms from coverage research (2GIS / network sites / city guides).
 * Run: node scripts/add-million-cities-p0-p1-gyms.mjs
 */
import { createHash } from 'node:crypto'
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const gymsPath = join(root, 'src/data/gyms.json')
const citiesPath = join(root, 'src/data/cities.json')
const apiGymsPath = join(root, 'api/prisma/data/gyms.json')

const IMAGES = [
  '/images/gyms/gym-01.jpg',
  '/images/gyms/gym-02.jpg',
  '/images/gyms/gym-03.jpg',
  '/images/gyms/gym-04.jpg',
  '/images/gyms/gym-05.jpg',
]

const TR = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
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
    'Ростов-на-Дону': 'rostov-na-donu',
    'Нижний Новгород': 'nizhniy-novgorod',
    Пермь: 'perm',
    Омск: 'omsk',
    Уфа: 'ufa',
    Самара: 'samara',
    Челябинск: 'chelyabinsk',
    Красноярск: 'krasnoyarsk',
    Воронеж: 'voronezh',
    Волгоград: 'volgograd',
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

/** @type {Array<{network:string,name:string,city:string,district:string,address:string,lat:number,lng:number}>} */
const RAW = [
  // ——— P0 Пермь ———
  {
    network: 'World Class',
    name: 'World Class Пермь',
    city: 'Пермь',
    district: 'Центр',
    address: 'улица Пермская, 33, МФК «Москва»',
    lat: 58.0105,
    lng: 56.2502,
  },
  {
    network: 'Alex Fitness',
    name: 'Alex Fitness Гагарина',
    city: 'Пермь',
    district: 'Свердловский',
    address: 'бульвар Гагарина, 32',
    lat: 58.0045,
    lng: 56.2685,
  },
  {
    network: 'Независимый',
    name: 'Легенда',
    city: 'Пермь',
    district: 'Центр',
    address: 'улица Николая Островского',
    lat: 58.0085,
    lng: 56.2415,
  },
  {
    network: 'Независимый',
    name: 'Спортхолл',
    city: 'Пермь',
    district: 'Индустриальный',
    address: 'Парковый проспект, 58А',
    lat: 58.0025,
    lng: 56.2885,
  },
  {
    network: 'Независимый',
    name: 'Arena',
    city: 'Пермь',
    district: 'Центр',
    address: 'улица Пермская, 7',
    lat: 58.0145,
    lng: 56.2395,
  },
  {
    network: 'Независимый',
    name: 'Skala',
    city: 'Пермь',
    district: 'Мотовилихинский',
    address: 'улица Мира, 5А',
    lat: 58.0185,
    lng: 56.2785,
  },

  // ——— P0 Ростов-на-Дону ———
  {
    network: 'World Class',
    name: 'World Class Премиум',
    city: 'Ростов-на-Дону',
    district: 'Кировский',
    address: 'улица Герасименко, 5',
    lat: 47.2315,
    lng: 39.7285,
  },
  {
    network: 'World Class',
    name: 'World Class Эксклюзив',
    city: 'Ростов-на-Дону',
    district: 'Ленинский',
    address: 'улица Красноармейская, 133',
    lat: 47.2225,
    lng: 39.7155,
  },
  {
    network: 'XFIT',
    name: 'XFIT Ростов',
    city: 'Ростов-на-Дону',
    district: 'Западный',
    address: 'Коммунистический проспект, 36',
    lat: 47.2385,
    lng: 39.6785,
  },
  {
    network: 'Alex Fitness',
    name: 'Alex Fitness Доватора',
    city: 'Ростов-на-Дону',
    district: 'Советский',
    address: 'улица Доватора, 269',
    lat: 47.2455,
    lng: 39.6585,
  },
  {
    network: 'Alex Fitness',
    name: 'Alex Fitness РИО',
    city: 'Ростов-на-Дону',
    district: 'Октябрьский',
    address: 'проспект Михаила Нагибина, 17, ТЦ «РИО»',
    lat: 47.2585,
    lng: 39.7185,
  },
  {
    network: 'Независимый',
    name: 'Prime Sport & Spa',
    city: 'Ростов-на-Дону',
    district: 'Центр',
    address: 'улица Суворова, 91, «Лига Наций»',
    lat: 47.2215,
    lng: 39.7055,
  },
  {
    network: 'Независимый',
    name: 'Sport House',
    city: 'Ростов-на-Дону',
    district: 'Ростов-на-Дону',
    address: 'улица Тружеников, 33Б',
    lat: 47.2685,
    lng: 39.6925,
  },

  // ——— P0 Омск ———
  {
    network: 'Energy Zone',
    name: 'Energy Zone Магистраль',
    city: 'Омск',
    district: 'Левобережье',
    address: 'улица Лукашевича, 10В, ТК «Магистраль», 4 этаж',
    lat: 54.9785,
    lng: 73.3085,
  },
  {
    network: 'Независимый',
    name: 'Fit Curves',
    city: 'Омск',
    district: 'Омск',
    address: 'Омск (женский фитнес)',
    lat: 54.9885,
    lng: 73.3685,
  },
  {
    network: 'Независимый',
    name: 'Старая школа',
    city: 'Омск',
    district: 'Омск',
    address: 'тренажёрный зал «Старая школа»',
    lat: 54.9925,
    lng: 73.3525,
  },

  // ——— P0 Уфа ———
  {
    network: 'World Class',
    name: 'World Class Уфа',
    city: 'Уфа',
    district: 'Центр',
    address: 'улица Революционная, 39/2',
    lat: 54.7355,
    lng: 55.9585,
  },
  {
    network: 'Независимый',
    name: 'Pushkin',
    city: 'Уфа',
    district: 'Центр',
    address: 'улица Пушкина, 45/2',
    lat: 54.7325,
    lng: 55.9485,
  },
  {
    network: 'Независимый',
    name: 'LeoFit',
    city: 'Уфа',
    district: 'Уфа',
    address: 'улица Зенцова, 73',
    lat: 54.7485,
    lng: 55.9685,
  },

  // ——— P0 Самара ———
  {
    network: 'XFIT',
    name: 'XFIT Самара',
    city: 'Самара',
    district: 'Октябрьский',
    address: 'Московское шоссе, 4Б',
    lat: 53.2125,
    lng: 50.1455,
  },
  {
    network: 'World Class',
    name: 'World Class Самара',
    city: 'Самара',
    district: 'Самара',
    address: 'улица Солнечная, 30',
    lat: 53.2285,
    lng: 50.1985,
  },
  {
    network: 'Независимый',
    name: 'Рекорд Fitness',
    city: 'Самара',
    district: 'Самара',
    address: 'улица Спортивная, 20, ТЦ «Триумф», 3 этаж',
    lat: 53.2035,
    lng: 50.1525,
  },
  {
    network: 'Независимый',
    name: 'FiZКУЛЬТУРА Врубеля',
    city: 'Самара',
    district: 'Самара',
    address: 'улица Врубеля, 11',
    lat: 53.1985,
    lng: 50.1185,
  },
  {
    network: 'Независимый',
    name: 'FiZКУЛЬТУРА МегаСити',
    city: 'Самара',
    district: 'Самара',
    address: 'улица Ново-Садовая, 160М, ТРЦ «МегаСити»',
    lat: 53.2185,
    lng: 50.1785,
  },
  {
    network: 'Независимый',
    name: 'FiZКУЛЬТУРА Самара-М',
    city: 'Самара',
    district: 'Самара',
    address: 'улица Гагарина, 99, ТЦ «Самара-М»',
    lat: 53.1885,
    lng: 50.1285,
  },
  {
    network: 'Независимый',
    name: 'Imperial Fitness',
    city: 'Самара',
    district: 'Самара',
    address: 'Московское шоссе, 163А, ТЦ «Империя», корпус 1',
    lat: 53.2355,
    lng: 50.2185,
  },

  // ——— P1 Челябинск ———
  {
    network: 'Alex Fitness',
    name: 'Alex Fitness Гагарин Парк',
    city: 'Челябинск',
    district: 'Центр',
    address: 'улица Труда, 183, ТРК «Гагарин Парк»',
    lat: 55.1625,
    lng: 61.3785,
  },
  {
    network: 'Alex Fitness',
    name: 'Alex Fitness Калибр',
    city: 'Челябинск',
    district: 'Челябинск',
    address: 'улица Худякова, 12, ТК «Калибр»',
    lat: 55.1485,
    lng: 61.4025,
  },

  // ——— P1 Красноярск ———
  {
    network: 'World Class',
    name: 'World Class Красноярск',
    city: 'Красноярск',
    district: 'Советский',
    address: 'улица Молокова, 37',
    lat: 56.0485,
    lng: 92.9085,
  },
  {
    network: 'Независимый',
    name: 'Impulse',
    city: 'Красноярск',
    district: 'Центр',
    address: 'улица Ленина, 92',
    lat: 56.0125,
    lng: 92.8685,
  },

  // ——— P1 Воронеж ———
  {
    network: 'World Class',
    name: 'World Class Воронеж',
    city: 'Воронеж',
    district: 'Центр',
    address: 'улица Кольцовская, 35А',
    lat: 51.6685,
    lng: 39.1985,
  },
  {
    network: 'XFIT',
    name: 'XFIT Платинум',
    city: 'Воронеж',
    district: 'Коминтерновский',
    address: 'улица Генерала Лизюкова, 35б',
    lat: 51.7085,
    lng: 39.1685,
  },
  {
    network: 'XFIT',
    name: 'XFIT Чернавский',
    city: 'Воронеж',
    district: 'Центральный',
    address: 'улица Короленко, 5',
    lat: 51.6585,
    lng: 39.2085,
  },

  // ——— P1 Волгоград ———
  {
    network: 'Независимый',
    name: 'ВолгаФит',
    city: 'Волгоград',
    district: 'Центр',
    address: 'набережная 62-й Армии, 6',
    lat: 48.7085,
    lng: 44.5185,
  },
]

const PRIORITY = new Set([
  'Москва',
  'Санкт-Петербург',
  'Новосибирск',
  'Екатеринбург',
  'Казань',
  'Красноярск',
  'Нижний Новгород',
  'Челябинск',
  'Уфа',
  'Краснодар',
  'Самара',
  'Ростов-на-Дону',
  'Омск',
  'Воронеж',
  'Пермь',
  'Волгоград',
  'Сочи',
  'Тюмень',
  'Иркутск',
  'Владивосток',
  'Калининград',
])

const NETWORK_ORDER = [
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
  'Energy Zone',
  'Физкульт',
  'Zebra Fitness',
  'Планета Фитнес',
  'Nebo',
  'Kometa.fit',
  'Независимый',
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

let added = 0
const addedNames = []
const skipped = []
for (const [i, raw] of RAW.entries()) {
  const id = makeId(raw.network, raw.name, raw.city)
  if (byId.has(id)) {
    skipped.push(raw.name)
    continue
  }
  const stats = stableStats(id)
  byId.set(id, {
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
  })
  added += 1
  addedNames.push(`${raw.city}: ${raw.name}`)
}

const gyms = [...byId.values()].sort((a, b) => {
  if (a.network !== b.network) return a.network.localeCompare(b.network, 'en')
  if (a.city !== b.city) return a.city.localeCompare(b.city, 'ru')
  return a.name.localeCompare(b.name, 'ru')
})

writeFileSync(gymsPath, `${JSON.stringify(gyms, null, 2)}\n`)
writeFileSync(citiesPath, `${JSON.stringify(buildCities(gyms), null, 2)}\n`)
copyFileSync(gymsPath, apiGymsPath)

const million = [
  'Пермь',
  'Ростов-на-Дону',
  'Омск',
  'Уфа',
  'Самара',
  'Челябинск',
  'Красноярск',
  'Воронеж',
  'Волгоград',
]

console.log(
  JSON.stringify(
    {
      added,
      skipped: skipped.length,
      total: gyms.length,
      byCity: Object.fromEntries(
        million.map((c) => [c, gyms.filter((g) => g.city === c).length]),
      ),
      addedNames,
    },
    null,
    2,
  ),
)
