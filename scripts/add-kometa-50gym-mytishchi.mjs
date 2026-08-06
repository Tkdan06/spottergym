/**
 * Add Kometa.fit (Moscow), 50 GYM (Moscow), and Mytishchi gyms.
 * Sources: kometa.fit, 50gymmoscow.ru, 2GIS / official club pages.
 * Run: node scripts/add-kometa-50gym-mytishchi.mjs
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
    Мытищи: 'mytishchi',
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
  // ——— Kometa.fit (kometa.fit + 2GIS) ———
  {
    network: 'Kometa.fit',
    name: 'Kometa Black Неглинная',
    city: 'Москва',
    district: 'Трубная',
    address: 'Трубная площадь, 2, ТЦ «Неглинная Галерея», -1 этаж',
    lat: 55.7678,
    lng: 37.6259,
  },
  {
    network: 'Kometa.fit',
    name: 'Kometa.fit Марьино',
    city: 'Москва',
    district: 'Марьино',
    address: 'улица Поречная, 10, ТРК «MARi», 3 этаж',
    lat: 55.6502,
    lng: 37.7448,
  },
  {
    network: 'Kometa.fit',
    name: 'Kometa.fit Пражская',
    city: 'Москва',
    district: 'Пражская',
    address: 'улица Красного Маяка, 2Б, ТРЦ Columbus, 3 этаж',
    lat: 55.6126,
    lng: 37.6054,
  },

  // ——— 50 GYM (single club, Коммунарка) ———
  {
    network: 'Независимый',
    name: '50 GYM Коммунарка',
    city: 'Москва',
    district: 'Коммунарка',
    address: 'поселение Сосенское, улица Николо-Хованская, 28, стр. 5',
    lat: 55.5708,
    lng: 37.4662,
  },

  // ——— Мытищи: крупные сети, которых ещё не было ———
  {
    network: 'World Class',
    name: 'World Class Мытищи',
    city: 'Мытищи',
    district: 'Благовещенская',
    address: 'улица Благовещенская, стр. 13',
    lat: 55.9048,
    lng: 37.7585,
  },
  {
    network: 'XFIT',
    name: 'XFIT Point Мытищи Парк',
    city: 'Мытищи',
    district: 'Мытищи Парк',
    address: 'улица Стрельбище Динамо, 10, ЖК Мытищи Парк',
    lat: 55.9215,
    lng: 37.7618,
  },

  // ——— Мытищи: несетевые / локальные (фильтр «Независимый») ———
  {
    network: 'Независимый',
    name: 'YoBody Fitness Мытищи',
    city: 'Мытищи',
    district: '4Daily',
    address: 'улица Мира, 32/2, ТЦ 4Daily, 2 этаж',
    lat: 55.9106,
    lng: 37.7368,
  },
  {
    network: 'Независимый',
    name: 'Ohana Fitness Мытищи Олимп',
    city: 'Мытищи',
    district: 'Олимпийский',
    address: 'Олимпийский проспект, 29А, БЦ Волковский',
    lat: 55.9132,
    lng: 37.7389,
  },
  {
    network: 'Независимый',
    name: 'Жми Fitness Мытищи',
    city: 'Мытищи',
    district: 'ЖК 9-18',
    address: 'улица Лётная, стр. 19, ЖК 9-18',
    lat: 55.9056,
    lng: 37.7552,
  },
  {
    network: 'Независимый',
    name: 'С.С.С.Р. Мытищи',
    city: 'Мытищи',
    district: 'Волковское',
    address: 'Волковское шоссе, 23Г, ТЦ Март',
    lat: 55.9089,
    lng: 37.7286,
  },
  {
    network: 'Независимый',
    name: 'O.Fitness Мытищи',
    city: 'Мытищи',
    district: 'Семашко',
    address: 'улица Семашко, 6Б',
    lat: 55.8974,
    lng: 37.6688,
  },
  {
    network: 'Независимый',
    name: 'Атлант Gym Мытищи',
    city: 'Мытищи',
    district: 'Новомытищинский',
    address: 'Новомытищинский проспект, 31А',
    lat: 55.9158,
    lng: 37.7454,
  },
  {
    network: 'Независимый',
    name: 'Bodyes Мытищи',
    city: 'Мытищи',
    district: 'Рождественская',
    address: 'улица Рождественская, 11',
    lat: 55.9112,
    lng: 37.7415,
  },
  {
    network: 'Независимый',
    name: 'L.A.B Space Мытищи',
    city: 'Мытищи',
    district: 'КИТ',
    address: 'Новомытищинский проспект, 4А, ЖК КИТ',
    lat: 55.9124,
    lng: 37.7326,
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
  addedNames.push(`${raw.city}: ${raw.name} (${raw.network})`)
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
      total: gyms.length,
      addedNames,
      mytishchi: gyms.filter((g) => g.city === 'Мытищи').length,
      kometa: gyms.filter((g) => g.network === 'Kometa.fit').length,
      independentMytishchi: gyms.filter(
        (g) => g.city === 'Мытищи' && g.network === 'Независимый',
      ).length,
    },
    null,
    2,
  ),
)
