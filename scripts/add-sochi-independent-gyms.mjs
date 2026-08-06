/**
 * Add independent (Независимый) Sochi / Adler / Lazarevskoye gyms.
 * Sources: sportstil-sochi.ru, fitsreda.ru, 2GIS, Yandex Maps.
 * Run: node scripts/add-sochi-independent-gyms.mjs
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
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=800&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1558611848-73f7eb4001a1?w=800&q=80&auto=format&fit=crop',
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
  const map = { Сочи: 'sochi', Москва: 'moskva' }
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
  // ——— F8 Fitness (2GIS / Yandex) ———
  {
    network: 'Независимый',
    name: 'F8 Fitness Club Войкова',
    city: 'Сочи',
    district: 'Центральный',
    address: 'улица Войкова, 16/23',
    lat: 43.5855,
    lng: 39.7195,
  },

  // ——— Olympus / Олимпус Адлер ———
  {
    network: 'Независимый',
    name: 'Olympus Gym Адлер',
    city: 'Сочи',
    district: 'Адлер',
    address: 'улица Ленина, 102А',
    lat: 43.4295,
    lng: 39.9235,
  },

  // ——— Фитнес СреДа (fitsreda.ru) ———
  {
    network: 'Независимый',
    name: 'Фитнес СреДа Адлер',
    city: 'Сочи',
    district: 'Адлер',
    address: 'улица Куйбышева, 21, 2 этаж',
    lat: 43.431,
    lng: 39.914,
  },

  // ——— Атлант Адлер ———
  {
    network: 'Независимый',
    name: 'Атлант Адлер',
    city: 'Сочи',
    district: 'Адлер',
    address: 'улица Ульянова, 14',
    lat: 43.434,
    lng: 39.918,
  },

  // ——— Спорт-Стиль (sportstil-sochi.ru) ———
  {
    network: 'Независимый',
    name: 'Спорт-Стиль Свердлова',
    city: 'Сочи',
    district: 'Адлер',
    address: 'улица Свердлова, 55, 5 этаж',
    lat: 43.4365,
    lng: 39.926,
  },
  {
    network: 'Независимый',
    name: 'Спорт-Стиль Кирпичная',
    city: 'Сочи',
    district: 'Адлер',
    address: 'улица Кирпичная, 24Б',
    lat: 43.428,
    lng: 39.935,
  },
  {
    network: 'Независимый',
    name: 'Спорт-Стиль Чебрикова',
    city: 'Сочи',
    district: 'Центральный',
    address: 'улица Чебрикова, 38',
    lat: 43.595,
    lng: 39.73,
  },

  // ——— Grand Fit Лазаревское ———
  {
    network: 'Независимый',
    name: 'Grand Fit Лазаревское',
    city: 'Сочи',
    district: 'Лазаревское',
    address: 'улица Победы, 153/а, цокольный этаж',
    lat: 43.9085,
    lng: 39.333,
  },

  // ——— World Class Сочи (есть в NETWORKS, в каталоге Сочи отсутствовал) ———
  {
    network: 'World Class',
    name: 'World Class Сочи',
    city: 'Сочи',
    district: 'Центральный',
    address: 'улица Несебрская, 1А, Grand Marina Gallery',
    lat: 43.5805,
    lng: 39.7185,
  },
]

const PRIORITY = new Set([
  'Москва',
  'Санкт-Петербург',
  'Краснодар',
  'Казань',
  'Екатеринбург',
  'Новосибирск',
  'Нижний Новгород',
  'Самара',
  'Ростов-на-Дону',
  'Уфа',
  'Красноярск',
  'Воронеж',
  'Пермь',
  'Волгоград',
  'Челябинск',
  'Тюмень',
  'Сочи',
  'Владивосток',
  'Калининград',
  'Кудрово',
  'Мурино',
  'Мытищи',
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
for (const [i, raw] of RAW.entries()) {
  const id = makeId(raw.network, raw.name, raw.city)
  if (byId.has(id)) continue
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
  addedNames.push(`${raw.name} (${raw.network})`)
}

const gyms = [...byId.values()].sort((a, b) => {
  if (a.network !== b.network) return a.network.localeCompare(b.network, 'en')
  if (a.city !== b.city) return a.city.localeCompare(b.city, 'ru')
  return a.name.localeCompare(b.name, 'ru')
})

writeFileSync(gymsPath, `${JSON.stringify(gyms, null, 2)}\n`)
writeFileSync(citiesPath, `${JSON.stringify(buildCities(gyms), null, 2)}\n`)
copyFileSync(gymsPath, apiGymsPath)

const sochi = gyms.filter((g) => g.city === 'Сочи')
const independent = sochi.filter((g) => g.network === 'Независимый')

console.log(
  JSON.stringify(
    {
      added,
      total: gyms.length,
      sochiTotal: sochi.length,
      independentSochi: independent.length,
      addedNames,
      sochiNetworks: [...new Set(sochi.map((g) => g.network))].sort(),
    },
    null,
    2,
  ),
)
