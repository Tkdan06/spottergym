/**
 * Add independent (Независимый) Kaliningrad gyms + World Class / XFIT gaps.
 * Sources: albagym.ru, statefitness.ru, newfitness.pro, profitness39.ru,
 * vivafitness.ru, morionspa.ru, adrenalin-fit.ru, worldclass-kgd.ru, xfitkgd.ru,
 * 2GIS / Yandex Maps.
 * Run: node scripts/add-kaliningrad-independent-gyms.mjs
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
  // ——— Альбатрос (albagym.ru) ———
  {
    network: 'Независимый',
    name: 'Альбатрос Север',
    city: 'Калининград',
    district: 'Ленинградский',
    address: 'улица Гайдара, 136',
    lat: 54.745,
    lng: 20.52,
  },
  {
    network: 'Независимый',
    name: 'Альбатрос Юг',
    city: 'Калининград',
    district: 'Московский',
    address: 'переулок Товарный, 5',
    lat: 54.69,
    lng: 20.5,
  },
  {
    network: 'Независимый',
    name: 'Альбатрос Запад',
    city: 'Калининград',
    district: 'Центральный',
    address: 'улица Чекистов, 81а',
    lat: 54.71,
    lng: 20.47,
  },
  {
    network: 'Независимый',
    name: 'Альбатрос Восток',
    city: 'Калининград',
    district: 'Московский',
    address: 'Московский проспект, 273',
    lat: 54.7,
    lng: 20.55,
  },

  // ——— State of Fitness (statefitness.ru) ———
  {
    network: 'Независимый',
    name: 'State of Fitness',
    city: 'Калининград',
    district: 'Ленинградский',
    address: 'улица Артиллерийская, 34',
    lat: 54.7306,
    lng: 20.5427,
  },

  // ——— Viva ———
  {
    network: 'Независимый',
    name: 'Viva Кошевого',
    city: 'Калининград',
    district: 'Центральный',
    address: 'улица Олега Кошевого, 33',
    lat: 54.72,
    lng: 20.5,
  },

  // ——— NEWFitness (newfitness.pro) ———
  {
    network: 'Независимый',
    name: 'NEWFitness Челнокова',
    city: 'Калининград',
    district: 'Ленинградский',
    address: 'улица Генерала Челнокова, 25, 3-4 этаж',
    lat: 54.75,
    lng: 20.51,
  },

  // ——— Morion (morionspa.ru) ———
  {
    network: 'Независимый',
    name: 'Morion Сергеева',
    city: 'Калининград',
    district: 'Центральный',
    address: 'улица Сергеева, 4',
    lat: 54.715,
    lng: 20.505,
  },

  // ——— ProFitness (profitness39.ru) ———
  {
    network: 'Независимый',
    name: 'ProFitness Артиллерийская',
    city: 'Калининград',
    district: 'Ленинградский',
    address: 'улица Артиллерийская, 22',
    lat: 54.729,
    lng: 20.54,
  },
  {
    network: 'Независимый',
    name: 'ProFitness Менделеева',
    city: 'Калининград',
    district: 'Московский',
    address: 'улица Менделеева, 61А',
    lat: 54.7,
    lng: 20.52,
  },
  {
    network: 'Независимый',
    name: 'ProFitness Согласия',
    city: 'Калининград',
    district: 'Ленинградский',
    address: 'улица Согласия, 44А',
    lat: 54.72,
    lng: 20.53,
  },
  {
    network: 'Независимый',
    name: 'ProFitness Баранова',
    city: 'Калининград',
    district: 'Центральный',
    address: 'улица Баранова, 36',
    lat: 54.71,
    lng: 20.49,
  },

  // ——— Адреналин (adrenalin-fit.ru) ———
  {
    network: 'Независимый',
    name: 'Адреналин Гагарина',
    city: 'Калининград',
    district: 'Московский',
    address: 'улица Юрия Гагарина, 55А',
    lat: 54.695,
    lng: 20.52,
  },

  // ——— World Class (special.worldclass-kgd.ru) ———
  {
    network: 'World Class',
    name: 'World Class Калининград',
    city: 'Калининград',
    district: 'Центральный',
    address: 'улица Дмитрия Донского, 19',
    lat: 54.72,
    lng: 20.5,
  },

  // ——— XFIT (xfitkgd.ru) ———
  {
    network: 'XFIT',
    name: 'XFIT Бассейная',
    city: 'Калининград',
    district: 'Центральный',
    address: 'улица Бассейная, 46',
    lat: 54.715,
    lng: 20.51,
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

const city = gyms.filter((g) => g.city === 'Калининград')
const independent = city.filter((g) => g.network === 'Независимый')

console.log(
  JSON.stringify(
    {
      added,
      total: gyms.length,
      kaliningradTotal: city.length,
      independentKaliningrad: independent.length,
      addedNames,
      networks: [...new Set(city.map((g) => g.network))].sort(),
    },
    null,
    2,
  ),
)
