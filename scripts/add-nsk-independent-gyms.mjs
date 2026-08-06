/**
 * Add independent (Независимый) Novosibirsk gyms + World Class / Alex Fitness gaps.
 * Sources: hammer-fit.ru, worldclassnsk.ru, nsk.alexfitness.ru, hvoya-park.ru,
 * 2GIS / Yandex Maps.
 * Run: node scripts/add-nsk-independent-gyms.mjs
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
  // ——— Hammer Fit (hammer-fit.ru) ———
  {
    network: 'Независимый',
    name: 'Hammer Fit Сибирский молл',
    city: 'Новосибирск',
    district: 'Дзержинский',
    address: 'улица Фрунзе, 238, ТРЦ «Сибирский молл», 2 этаж',
    lat: 55.045,
    lng: 82.955,
  },
  {
    network: 'Независимый',
    name: 'Hammer Fit Калина',
    city: 'Новосибирск',
    district: 'Заельцовский',
    address: 'улица Дуси Ковальчук, 179/4, ТЦ «Калина Центр», 4 этаж',
    lat: 55.06,
    lng: 82.915,
  },
  {
    network: 'Независимый',
    name: 'Hammer Fit Маркса',
    city: 'Новосибирск',
    district: 'Ленинский',
    address: 'площадь Карла Маркса, 6/1, ТРЦ «KLP», 4 этаж',
    lat: 54.982,
    lng: 82.892,
  },
  {
    network: 'Независимый',
    name: 'Hammer Fit Кирова',
    city: 'Новосибирск',
    district: 'Октябрьский',
    address: 'улица Кирова, 44/1, 4 этаж',
    lat: 55.025,
    lng: 82.935,
  },
  {
    network: 'Независимый',
    name: 'Hammer Fit Юпитер',
    city: 'Новосибирск',
    district: 'Центральный',
    address: 'улица Гоголя, 15, ТЦ «Юпитер»',
    lat: 55.04,
    lng: 82.92,
  },
  {
    network: 'Независимый',
    name: 'Hammer Fit Гоголя',
    city: 'Новосибирск',
    district: 'Центральный',
    address: 'улица Гоголя, 44',
    lat: 55.042,
    lng: 82.925,
  },
  {
    network: 'Независимый',
    name: 'Hammer Fit Ясный Берег',
    city: 'Новосибирск',
    district: 'Ленинский',
    address: 'улица Ясный берег, 14Б, 2 этаж',
    lat: 54.97,
    lng: 82.85,
  },
  {
    network: 'Независимый',
    name: 'Hammer Fit Выборная',
    city: 'Новосибирск',
    district: 'Октябрьский',
    address: 'улица Вилюйская, 24, корп. 1, ТЦ «Ласточка», 2 этаж',
    lat: 55.0,
    lng: 82.98,
  },
  {
    network: 'Независимый',
    name: 'Hammer Fit Первомайский',
    city: 'Новосибирск',
    district: 'Первомайский',
    address: 'улица Героев Революции, 57',
    lat: 54.96,
    lng: 83.05,
  },

  // ——— Terraclub ———
  {
    network: 'Независимый',
    name: 'Terraclub Челюскинцев',
    city: 'Новосибирск',
    district: 'Железнодорожный',
    address: 'улица Челюскинцев, 21',
    lat: 55.035,
    lng: 82.91,
  },

  // ——— Фитнес Термы Хвоя (hvoya-park.ru) ———
  {
    network: 'Независимый',
    name: 'Фитнес Термы Хвоя',
    city: 'Новосибирск',
    district: 'Кировский',
    address: 'улица Ватутина, 36/3',
    lat: 54.985,
    lng: 82.9,
  },

  // ——— World Class (worldclassnsk.ru) ———
  {
    network: 'World Class',
    name: 'World Class Новосибирск',
    city: 'Новосибирск',
    district: 'Центральный',
    address: 'улица Щетинкина, 18, ЖК Montblanc',
    lat: 55.03,
    lng: 82.92,
  },

  // ——— Alex Fitness (nsk.alexfitness.ru) ———
  {
    network: 'Alex Fitness',
    name: 'Alex Fitness Родники',
    city: 'Новосибирск',
    district: 'Кировский',
    address: 'улица Тюленина, 17/1, ТЦ «Кристалл»',
    lat: 54.975,
    lng: 82.88,
  },
  {
    network: 'Alex Fitness',
    name: 'Alex Fitness Амолл',
    city: 'Новосибирск',
    district: 'Калининский',
    address: 'улица Богдана Хмельницкого, 1/1, ТЦ «Амолл», 4 этаж',
    lat: 55.07,
    lng: 82.95,
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

const nsk = gyms.filter((g) => g.city === 'Новосибирск')
const independent = nsk.filter((g) => g.network === 'Независимый')

console.log(
  JSON.stringify(
    {
      added,
      total: gyms.length,
      nskTotal: nsk.length,
      independentNsk: independent.length,
      addedNames,
      networks: [...new Set(nsk.map((g) => g.network))].sort(),
    },
    null,
    2,
  ),
)
