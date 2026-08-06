/**
 * Add Nizhny Novgorod gyms: independents + Физкульт / World Class / XFIT.
 * Sources: fizkult-nn.ru, golds-fitness.com, worldclass-nn.ru, xfitnn.ru,
 * fitgrad.ru, effect-fitness, 2GIS / Yandex Maps.
 * Run: node scripts/add-nn-independent-gyms.mjs
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
  const map = {
    Москва: 'moskva',
    Сочи: 'sochi',
    'Санкт-Петербург': 'sankt-peterburg',
    Екатеринбург: 'ekaterinburg',
    Казань: 'kazan',
    Калининград: 'kaliningrad',
    Новосибирск: 'novosibirsk',
    'Нижний Новгород': 'nizhniy-novgorod',
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
  // ——— Gold's Fitness (golds-fitness.com) ———
  {
    network: 'Независимый',
    name: 'Gold\'s Fitness Горького',
    city: 'Нижний Новгород',
    district: 'Нижегородский',
    address: 'улица Максима Горького, 252, Hampton by Hilton',
    lat: 56.319,
    lng: 44.025,
  },
  {
    network: 'Независимый',
    name: 'Gold\'s Fitness Индиго',
    city: 'Нижний Новгород',
    district: 'Нижегородский',
    address: 'Казанское шоссе, 11, ТРК «Индиго Life»',
    lat: 56.295,
    lng: 44.05,
  },
  {
    network: 'Независимый',
    name: 'Gold\'s Fitness Золотая Миля',
    city: 'Нижний Новгород',
    district: 'Сормовский',
    address: 'улица Коминтерна, 105А, ТРК «Золотая Миля»',
    lat: 56.345,
    lng: 43.87,
  },

  // ——— Фитнес Град (fitgrad.ru) ———
  {
    network: 'Независимый',
    name: 'Фитнес Град Ленина',
    city: 'Нижний Новгород',
    district: 'Автозаводский',
    address: 'проспект Ленина, 109, БЦ «Чайка», 2 этаж',
    lat: 56.255,
    lng: 43.905,
  },
  {
    network: 'Независимый',
    name: 'Фитнес Град Дьяконова',
    city: 'Нижний Новгород',
    district: 'Автозаводский',
    address: 'улица Дьяконова, 11А, 2 этаж',
    lat: 56.25,
    lng: 43.89,
  },

  // ——— Effect Fitness ———
  {
    network: 'Независимый',
    name: 'Effect Fitness Лесной Городок',
    city: 'Нижний Новгород',
    district: 'Советский',
    address: 'улица Лесной Городок, 4В',
    lat: 56.3,
    lng: 44.02,
  },

  // ——— Физкульт NN (fizkult-nn.ru) ———
  {
    network: 'Физкульт',
    name: 'Физкульт Автозаводский',
    city: 'Нижний Новгород',
    district: 'Автозаводский',
    address: 'проспект Ленина, 108, ТЦ «Автозаводец», 4 этаж',
    lat: 56.256,
    lng: 43.904,
  },
  {
    network: 'Физкульт',
    name: 'Физкульт Бурнаковский',
    city: 'Нижний Новгород',
    district: 'Московский',
    address: 'улица Бурнаковская, 103а',
    lat: 56.335,
    lng: 43.9,
  },
  {
    network: 'Физкульт',
    name: 'Физкульт Деловая',
    city: 'Нижний Новгород',
    district: 'Нижегородский',
    address: 'улица Родионова, 201, корп. 1',
    lat: 56.315,
    lng: 44.045,
  },
  {
    network: 'Физкульт',
    name: 'Физкульт Корабли',
    city: 'Нижний Новгород',
    district: 'Сормовский',
    address: 'проспект Кораблестроителей, 76',
    lat: 56.355,
    lng: 43.85,
  },
  {
    network: 'Физкульт',
    name: 'Физкульт Мещера',
    city: 'Нижний Новгород',
    district: 'Канавино',
    address: 'улица Бетанкура, 1, ТРЦ «Седьмое Небо»',
    lat: 56.33,
    lng: 43.95,
  },
  {
    network: 'Физкульт',
    name: 'Физкульт Родионова',
    city: 'Нижний Новгород',
    district: 'Нижегородский',
    address: 'улица Родионова, 187, ТРЦ «Фантастика», 3 этаж',
    lat: 56.312,
    lng: 44.04,
  },
  {
    network: 'Физкульт',
    name: 'Физкульт Советская',
    city: 'Нижний Новгород',
    district: 'Советский',
    address: 'площадь Советская, 5, ТРЦ «Жар-птица», 2 этаж',
    lat: 56.3,
    lng: 44.01,
  },
  {
    network: 'Физкульт',
    name: 'Физкульт Спорт',
    city: 'Нижний Новгород',
    district: 'Нижегородский',
    address: 'улица Белинского, 124, ТЦ «Счастье», 6 этаж',
    lat: 56.31,
    lng: 44.02,
  },
  {
    network: 'Физкульт',
    name: 'Физкульт Старт',
    city: 'Нижний Новгород',
    district: 'Нижегородский',
    address: 'улица Белинского, 61',
    lat: 56.318,
    lng: 44.015,
  },
  {
    network: 'Физкульт',
    name: 'Физкульт Южное',
    city: 'Нижний Новгород',
    district: 'Автозаводский',
    address: 'Южное шоссе, 2Г, ТЦ «Крымъ»',
    lat: 56.24,
    lng: 43.88,
  },

  // ——— World Class (worldclass-nn.ru) ———
  {
    network: 'World Class',
    name: 'World Class Пушкинский',
    city: 'Нижний Новгород',
    district: 'Советский',
    address: 'улица Тимирязева, 31А',
    lat: 56.305,
    lng: 44.0,
  },

  // ——— XFIT (xfitnn.ru) ———
  {
    network: 'XFIT',
    name: 'XFIT Сормово',
    city: 'Нижний Новгород',
    district: 'Сормовский',
    address: 'улица Дмитрия Павлова, 13а',
    lat: 56.34,
    lng: 43.875,
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

const nn = gyms.filter((g) => g.city === 'Нижний Новгород')
const independent = nn.filter((g) => g.network === 'Независимый')

console.log(
  JSON.stringify(
    {
      added,
      total: gyms.length,
      nnTotal: nn.length,
      independentNn: independent.length,
      addedNames,
      networks: [...new Set(nn.map((g) => g.network))].sort(),
    },
    null,
    2,
  ),
)
