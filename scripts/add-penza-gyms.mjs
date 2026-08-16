/**
 * Add Penza gyms from 2GIS / Yandex / network sites (Alex Fitness, XFIT, UNI-GYM, etc.).
 * Run: node scripts/add-penza-gyms.mjs
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

function makeId(network, name, city) {
  return `gym-${slug(network)}-${slug(name)}-${slug(city)}`
}

function stableStats(id) {
  const h = createHash('sha1').update(id).digest()
  return {
    membersCount: 55 + (h[0] % 120),
    activeNow: h[1] % 14,
  }
}

/** Verified via 2GIS, Yandex Maps, alexfitness.ru, uni-gym.ru, xfit.ru, club sites */
/** @type {Array<{network:string,name:string,city:string,district:string,address:string,lat:number,lng:number}>} */
const RAW = [
  {
    network: 'Alex Fitness',
    name: 'Alex Fitness Пассаж',
    city: 'Пенза',
    district: 'Центр',
    address: 'улица Московская, 83, ТЦ «Пассаж»',
    lat: 53.1954,
    lng: 45.0182,
  },
  {
    network: 'Alex Fitness',
    name: 'Alex Fitness Онежский',
    city: 'Пенза',
    district: 'Октябрьский',
    address: '1-й Онежский проезд, 4',
    lat: 53.2278,
    lng: 44.9995,
  },
  {
    network: 'XFIT',
    name: 'XFIT Studio Квартал 55',
    city: 'Пенза',
    district: 'Центр',
    address: 'улица Урицкого, 48',
    lat: 53.1968,
    lng: 45.0145,
  },
  {
    network: 'XFIT',
    name: 'XFIT ЖК Семейный',
    city: 'Пенза',
    district: 'Засечное',
    address: 'улица Натальи Лавровой, 20/2, с. Засечное',
    lat: 53.1485,
    lng: 45.0525,
  },
  {
    network: 'UNI-GYM',
    name: 'UNI-GYM Квадрат',
    city: 'Пенза',
    district: 'Арбеково',
    address: 'проспект Победы, 124б, РЦ «Квадрат»',
    lat: 53.2275,
    lng: 44.9785,
  },
  {
    network: 'UNI-GYM',
    name: 'UNI-GYM Высшая Лига',
    city: 'Пенза',
    district: 'Центр',
    address: 'улица Московская, 37, ТРЦ «Высшая Лига»',
    lat: 53.1925,
    lng: 45.0125,
  },
  {
    network: 'UNI-GYM',
    name: 'UNI-GYM Окружной',
    city: 'Пенза',
    district: 'Окружная',
    address: 'улица Окружная, 27в, ТЦ «Окружной»',
    lat: 53.2145,
    lng: 44.9685,
  },
  {
    network: 'Квартал FIT',
    name: 'Квартал FIT Терновского',
    city: 'Пенза',
    district: 'Терновка',
    address: 'улица Терновского, 154В',
    lat: 53.2015,
    lng: 45.0655,
  },
  {
    network: 'Независимый',
    name: 'Энигма Сура',
    city: 'Пенза',
    district: 'Южная поляна',
    address: 'улица Калинина, 115',
    lat: 53.1785,
    lng: 45.0015,
  },
  {
    network: 'Dozafit',
    name: 'Dozafit Антонова',
    city: 'Пенза',
    district: 'ГПЗ-24',
    address: 'улица Антонова, 47',
    lat: 53.2185,
    lng: 45.0455,
  },
  {
    network: 'Dozafit',
    name: 'Dozafit Чкалова',
    city: 'Пенза',
    district: 'Центр',
    address: 'улица Чкалова, 32',
    lat: 53.1885,
    lng: 45.0085,
  },
  {
    network: 'Независимый',
    name: 'СтаNция',
    city: 'Пенза',
    district: 'Арбеково',
    address: 'проспект Строителей, 21в',
    lat: 53.2325,
    lng: 44.9855,
  },
  {
    network: 'Независимый',
    name: 'ZAVOD',
    city: 'Пенза',
    district: 'Центр',
    address: 'улица Захарова, 19',
    lat: 53.1945,
    lng: 45.0055,
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
  'Пенза',
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
  'UNI-GYM',
  'Dozafit',
  'Квартал FIT',
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
  addedNames.push(raw.name)
}

const gyms = [...byId.values()].sort((a, b) => {
  if (a.network !== b.network) return a.network.localeCompare(b.network, 'en')
  if (a.city !== b.city) return a.city.localeCompare(b.city, 'ru')
  return a.name.localeCompare(b.name, 'ru')
})

writeFileSync(gymsPath, `${JSON.stringify(gyms, null, 2)}\n`)
writeFileSync(citiesPath, `${JSON.stringify(buildCities(gyms), null, 2)}\n`)
copyFileSync(gymsPath, apiGymsPath)

console.log(
  JSON.stringify(
    {
      added,
      skipped: skipped.length,
      total: gyms.length,
      penza: gyms.filter((g) => g.city === 'Пенза').length,
      addedNames,
    },
    null,
    2,
  ),
)
