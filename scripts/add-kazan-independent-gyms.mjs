/**
 * Add independent (Независимый) Kazan gyms + fill Planeta Fitness / XFIT gaps.
 * Sources: akimbofit.ru, planeta.fitness, arena1.xfit.ru, onfit.club,
 * atlantkazan.ru, tasmagym.ru, fcmaximusprogressive.ru, 2GIS / Yandex Maps.
 * Run: node scripts/add-kazan-independent-gyms.mjs
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
  // ——— Powerhouse Gym ———
  {
    network: 'Независимый',
    name: 'Powerhouse Gym Краснококшайская',
    city: 'Казань',
    district: 'Московский',
    address: 'улица Краснококшайская, 119',
    lat: 55.83,
    lng: 49.08,
  },

  // ——— ONFiT (onfit.club) ———
  {
    network: 'Независимый',
    name: 'ONFiT Салават Купере',
    city: 'Казань',
    district: 'Авиастроительный',
    address: 'улица Мастеров, 35Б, спортивный манеж «Физра», 2 этаж',
    lat: 55.86,
    lng: 49.02,
  },

  // ——— Akimbo (akimbofit.ru) ———
  {
    network: 'Независимый',
    name: 'Akimbo Фучика',
    city: 'Казань',
    district: 'Советский',
    address: 'улица Юлиуса Фучика, 90, ТРЦ «Франт», 3 этаж',
    lat: 55.755,
    lng: 49.23,
  },
  {
    network: 'Независимый',
    name: 'Akimbo Амирхана',
    city: 'Казань',
    district: 'Ново-Савиновский',
    address: 'улица Фатыха Амирхана, 101В',
    lat: 55.82,
    lng: 49.15,
  },
  {
    network: 'Независимый',
    name: 'Akimbo Глушко',
    city: 'Казань',
    district: 'Приволжский',
    address: 'улица Академика Глушко, 16Г',
    lat: 55.75,
    lng: 49.19,
  },

  // ——— Maximus ———
  {
    network: 'Независимый',
    name: 'Maximus Progressive',
    city: 'Казань',
    district: 'Советский',
    address: 'улица Минская, 9, ТК «Азино», 5 этаж',
    lat: 55.77,
    lng: 49.22,
  },
  {
    network: 'Независимый',
    name: 'Maximus Global',
    city: 'Казань',
    district: 'Московский',
    address: 'улица Галимджана Баруди, 8, ТЦ «Московский»',
    lat: 55.83,
    lng: 49.09,
  },

  // ——— Атлант (atlantkazan.ru) ———
  {
    network: 'Независимый',
    name: 'Атлант Зорге',
    city: 'Казань',
    district: 'Приволжский',
    address: 'улица Рихарда Зорге, 68',
    lat: 55.75,
    lng: 49.2,
  },

  // ——— Tasma Gym (tasmagym.ru) ———
  {
    network: 'Независимый',
    name: 'Tasma Gym Восстания',
    city: 'Казань',
    district: 'Авиастроительный',
    address: 'улица Восстания, 100, корп. 203А',
    lat: 55.85,
    lng: 49.07,
  },

  // ——— Планета Фитнес Казань (planeta.fitness) ———
  {
    network: 'Планета Фитнес',
    name: 'Планета Фитнес Парина',
    city: 'Казань',
    district: 'Приволжский',
    address: 'улица Академика Парина, 1',
    lat: 55.74,
    lng: 49.18,
  },
  {
    network: 'Планета Фитнес',
    name: 'Планета Фитнес Амирхана',
    city: 'Казань',
    district: 'Ново-Савиновский',
    address: 'улица Фатыха Амирхана, 1а',
    lat: 55.815,
    lng: 49.135,
  },
  {
    network: 'Планета Фитнес',
    name: 'Планета Фитнес Мусина',
    city: 'Казань',
    district: 'Ново-Савиновский',
    address: 'улица Мусина, 39',
    lat: 55.82,
    lng: 49.1,
  },
  {
    network: 'Планета Фитнес',
    name: 'Планета Фитнес Чистопольская',
    city: 'Казань',
    district: 'Советский',
    address: 'улица Чистопольская, 69',
    lat: 55.81,
    lng: 49.14,
  },

  // ——— XFIT Казань ———
  {
    network: 'XFIT',
    name: 'XFIT Арена',
    city: 'Казань',
    district: 'Ново-Савиновский',
    address: 'проспект Ямашева, 115а, Ак Барс Арена',
    lat: 55.825,
    lng: 49.16,
  },
  {
    network: 'XFIT',
    name: 'XFIT Ак Барс',
    city: 'Казань',
    district: 'Ново-Савиновский',
    address: 'улица Фатыха Амирхана, 1г, дворец единоборств «Ак Барс»',
    lat: 55.815,
    lng: 49.135,
  },
  {
    network: 'XFIT',
    name: 'XFIT Терра',
    city: 'Казань',
    district: 'Вахитовский',
    address: 'улица Сары Садыковой, 30, БЦ «Бахадир», 3 этаж',
    lat: 55.785,
    lng: 49.12,
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

const kazan = gyms.filter((g) => g.city === 'Казань')
const independent = kazan.filter((g) => g.network === 'Независимый')

console.log(
  JSON.stringify(
    {
      added,
      total: gyms.length,
      kazanTotal: kazan.length,
      independentKazan: independent.length,
      addedNames,
      kazanNetworks: [...new Set(kazan.map((g) => g.network))].sort(),
    },
    null,
    2,
  ),
)
