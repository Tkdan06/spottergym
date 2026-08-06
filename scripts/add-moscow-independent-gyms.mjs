/**
 * Add well-known independent (Независимый) Moscow gyms from directories / official sites.
 * Sources: aurelius.ru, selfclub.ru, mosgym.ru, phgsokol.ru, phg.fitness, 2GIS / Yandex Maps.
 * Run: node scripts/add-moscow-independent-gyms.mjs
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
  return city === 'Москва' ? 'moskva' : slug(city)
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
  // ——— Hardcore Gym ———
  {
    network: 'Независимый',
    name: 'Hardcore Gym Кастанаевская',
    city: 'Москва',
    district: 'Кунцево',
    address: 'улица Кастанаевская, 42, корп. 2',
    lat: 55.7275,
    lng: 37.4718,
  },
  {
    network: 'Независимый',
    name: 'Hardcore Gym Дежнева',
    city: 'Москва',
    district: 'Бибирево',
    address: 'проезд Дежнёва, 34, стр. 2',
    lat: 55.8855,
    lng: 37.6302,
  },

  // ——— Марк Аврелий (aurelius.ru / fitness.aurelius.ru) ———
  {
    network: 'Независимый',
    name: 'Марк Аврелий Измайлово',
    city: 'Москва',
    district: 'Измайлово',
    address: 'Измайловское шоссе, 71, корпус «Дельта», 2 этаж',
    lat: 55.7905,
    lng: 37.7485,
  },

  // ——— MosGym (mosgym.ru, ТОЦ Лето) ———
  {
    network: 'Независимый',
    name: 'MosGym Вернадского',
    city: 'Москва',
    district: 'Ломоносовский',
    address: 'проспект Вернадского, 29, ТОЦ «Лето», цокольный этаж',
    lat: 55.6797,
    lng: 37.5028,
  },

  // ——— Self Club (selfclub.ru) ———
  {
    network: 'Независимый',
    name: 'Self Club Верхоянская',
    city: 'Москва',
    district: 'Свиблово',
    address: 'улица Верхоянская, 9',
    lat: 55.8548,
    lng: 37.6525,
  },

  // ——— Powerhouse Gym (локальные клубы бренда, не федеральная сеть в каталоге) ———
  {
    network: 'Независимый',
    name: 'Powerhouse Gym Сокол',
    city: 'Москва',
    district: 'Сокол',
    address: 'Ленинградский проспект, 80, корп. 37',
    lat: 55.8055,
    lng: 37.5155,
  },
  {
    network: 'Независимый',
    name: 'Powerhouse Gym Селигерская',
    city: 'Москва',
    district: 'Западное Дегунино',
    address: 'улица Ивана Сусанина, 1/1',
    lat: 55.8665,
    lng: 37.5475,
  },
  {
    network: 'Независимый',
    name: 'Powerhouse Gym Дмитровское',
    city: 'Москва',
    district: 'Восточное Дегунино',
    address: 'Дмитровское шоссе, 98, ТРЦ РТС, этажи 5–7',
    lat: 55.88,
    lng: 37.545,
  },

  // ——— Number One Fit (numberonefit.ru) ———
  {
    network: 'Независимый',
    name: 'Number One Fit Кожухово',
    city: 'Москва',
    district: 'Косино-Ухтомский',
    address: 'улица Лухмановская, 6',
    lat: 55.7055,
    lng: 37.9085,
  },

  // ——— Манго Фитнес (mangofitness.ru) ———
  {
    network: 'Независимый',
    name: 'Манго Фитнес Кожухово',
    city: 'Москва',
    district: 'Косино-Ухтомский',
    address: 'улица Дмитриевского, 10, 3 этаж',
    lat: 55.7125,
    lng: 37.8955,
  },
  {
    network: 'Независимый',
    name: 'Манго Фитнес Ивановское',
    city: 'Москва',
    district: 'Ивановское',
    address: 'улица Саянская, 7, 3 этаж',
    lat: 55.75,
    lng: 37.8255,
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

const independentMsk = gyms.filter((g) => g.city === 'Москва' && g.network === 'Независимый')

console.log(
  JSON.stringify(
    {
      added,
      total: gyms.length,
      independentMoscow: independentMsk.length,
      addedNames,
    },
    null,
    2,
  ),
)
