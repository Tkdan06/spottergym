/**
 * Add independent (Независимый) Yekaterinburg gyms + fill World Class gap.
 * Sources: powerhousegym.ru, aversfit.ru, extreme-club.ru, ultra-ff.com,
 * irongym24.ru, worldclass-ekb.com / worldclass-ekb.ru, 2GIS / Yandex Maps.
 * Run: node scripts/add-ekb-independent-gyms.mjs
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
  // ——— Powerhouse Gym (powerhousegym.ru) ———
  {
    network: 'Независимый',
    name: 'Powerhouse Gym Родонитовая',
    city: 'Екатеринбург',
    district: 'Чкаловский',
    address: 'улица Родонитовая, 29',
    lat: 56.7975,
    lng: 60.631,
  },
  {
    network: 'Независимый',
    name: 'Powerhouse Gym Хохрякова',
    city: 'Екатеринбург',
    district: 'Ленинский',
    address: 'улица Хохрякова, 10',
    lat: 56.8375,
    lng: 60.597,
  },
  {
    network: 'Независимый',
    name: 'Powerhouse Gym Дерябиной',
    city: 'Екатеринбург',
    district: 'Верх-Исетский',
    address: 'улица Серафимы Дерябиной, 24',
    lat: 56.808,
    lng: 60.56,
  },
  {
    network: 'Независимый',
    name: 'Powerhouse Gym Сибирский тракт',
    city: 'Екатеринбург',
    district: 'Кировский',
    address: 'улица Дублёр Сибирского тракта, 2',
    lat: 56.858,
    lng: 60.67,
  },
  {
    network: 'Независимый',
    name: 'Powerhouse Gym Титова',
    city: 'Екатеринбург',
    district: 'Чкаловский',
    address: 'улица Титова, 35а',
    lat: 56.78,
    lng: 60.63,
  },
  {
    network: 'Независимый',
    name: 'Powerhouse Gym Викулова',
    city: 'Екатеринбург',
    district: 'Верх-Исетский',
    address: 'улица Викулова, 24',
    lat: 56.845,
    lng: 60.56,
  },

  // ——— AversFit (бывш. Orange Fitness, aversfit.ru) ———
  {
    network: 'Независимый',
    name: 'AversFit Шейнкмана',
    city: 'Екатеринбург',
    district: 'Ленинский',
    address: 'улица Шейнкмана, 21',
    lat: 56.838,
    lng: 60.5965,
  },

  // ——— Экстрим (extreme-club.ru) ———
  {
    network: 'Независимый',
    name: 'Экстрим Алатырь',
    city: 'Екатеринбург',
    district: 'Ленинский',
    address: 'улица Малышева, 5, ТРЦ «Алатырь», 6 этаж',
    lat: 56.8385,
    lng: 60.61,
  },

  // ——— Port Fitness ———
  {
    network: 'Независимый',
    name: 'Port Fitness Волгоградская',
    city: 'Екатеринбург',
    district: 'Верх-Исетский',
    address: 'улица Волгоградская, 20',
    lat: 56.82,
    lng: 60.575,
  },

  // ——— Ultra Family Fitness (ultra-ff.com) ———
  {
    network: 'Независимый',
    name: 'Ultra Family Fitness',
    city: 'Екатеринбург',
    district: 'Орджоникидзевский',
    address: 'проспект Космонавтов, 29г',
    lat: 56.888,
    lng: 60.613,
  },

  // ——— Iron Gym (irongym24.ru) ———
  {
    network: 'Независимый',
    name: 'Iron Gym Высоцкого',
    city: 'Екатеринбург',
    district: 'Кировский',
    address: 'улица Высоцкого, 6Б',
    lat: 56.862,
    lng: 60.665,
  },

  // ——— Gold Fit ———
  {
    network: 'Независимый',
    name: 'Gold Fit Героев России',
    city: 'Екатеринбург',
    district: 'Железнодорожный',
    address: 'улица Героев России, 2, 7 этаж',
    lat: 56.843,
    lng: 60.605,
  },
  {
    network: 'Независимый',
    name: 'Gold Fit Соликамская',
    city: 'Екатеринбург',
    district: 'Октябрьский',
    address: 'улица Соликамская, 16',
    lat: 56.82,
    lng: 60.645,
  },

  // ——— World Class (worldclass-ekb.com / worldclass-ekb.ru) ———
  {
    network: 'World Class',
    name: 'World Class Макаровский',
    city: 'Екатеринбург',
    district: 'Верх-Исетский',
    address: 'Олимпийская набережная, 9, ЖК «Макаровский»',
    lat: 56.848,
    lng: 60.599,
  },
  {
    network: 'World Class',
    name: 'World Class Нагорный',
    city: 'Екатеринбург',
    district: 'Верх-Исетский',
    address: 'улица Татищева, 18/2, ЖК «Нагорный»',
    lat: 56.822,
    lng: 60.556,
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

const ekb = gyms.filter((g) => g.city === 'Екатеринбург')
const independent = ekb.filter((g) => g.network === 'Независимый')

console.log(
  JSON.stringify(
    {
      added,
      total: gyms.length,
      ekbTotal: ekb.length,
      independentEkb: independent.length,
      addedNames,
      ekbNetworks: [...new Set(ekb.map((g) => g.network))].sort(),
    },
    null,
    2,
  ),
)
