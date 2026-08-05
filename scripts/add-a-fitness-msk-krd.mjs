/**
 * Add A-Fitness + ~50 gyms for Krasnodar/Moscow (chains + independents).
 * Run: node scripts/add-a-fitness-msk-krd.mjs
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
    'Санкт-Петербург': 'sankt-peterburg',
    Краснодар: 'krasnodar',
    Мурино: 'murino',
    Новоселье: 'novoselye',
    Балашиха: 'balashiha',
    Казань: 'kazan',
    Уфа: 'ufa',
    'Ростов-на-Дону': 'rostov-na-donu',
    Майкоп: 'maykop',
    Сочи: 'sochi',
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
  // ——— A-Fitness (afitness.ru) ———
  { network: 'A-Fitness', name: 'A-Fitness Кондратьевский', city: 'Санкт-Петербург', district: 'Лесная', address: 'проспект Кондратьевский, 64 корпус 6', lat: 59.9858, lng: 30.3852 },
  { network: 'A-Fitness', name: 'A-Fitness Марата', city: 'Санкт-Петербург', district: 'Маяковская', address: 'улица Марата, 5/21', lat: 59.9312, lng: 30.3548 },
  { network: 'A-Fitness', name: 'A-Fitness Велотрек', city: 'Санкт-Петербург', district: 'Удельная', address: 'проспект Тореза, 114 корпус 2', lat: 60.0185, lng: 30.3188 },
  { network: 'A-Fitness', name: 'A-Fitness Модум', city: 'Санкт-Петербург', district: 'Комендантский', address: 'проспект Авиаконструкторов, 54', lat: 60.0128, lng: 30.2485 },
  { network: 'A-Fitness', name: 'A-Fitness Оптиков', city: 'Санкт-Петербург', district: 'Старая Деревня', address: 'улица Оптиков, 4 корпус 2', lat: 59.9888, lng: 30.2285 },
  { network: 'A-Fitness', name: 'A-Fitness Девяткино', city: 'Мурино', district: 'Девяткино', address: 'улица Шувалова, 6', lat: 60.0488, lng: 30.4452 },
  { network: 'A-Fitness', name: 'A-Fitness Новоселье', city: 'Новоселье', district: 'Новоселье', address: 'Красносельское шоссе, 10', lat: 59.8085, lng: 30.0785 },
  { network: 'A-Fitness', name: 'A-Fitness Железнодорожный', city: 'Балашиха', district: 'Железнодорожный', address: 'улица Некрасова, 8А', lat: 55.7485, lng: 38.0185 },
  { network: 'A-Fitness', name: 'A-Fitness Тандем', city: 'Казань', district: 'Казань', address: 'проспект Ибрагимова, 54', lat: 55.7985, lng: 49.1055 },
  { network: 'A-Fitness', name: 'A-Fitness Бикбая', city: 'Уфа', district: 'Уфа', address: 'улица Б. Бикбая, 15', lat: 54.7385, lng: 56.0085 },
  { network: 'A-Fitness', name: 'A-Fitness Северный', city: 'Ростов-на-Дону', district: 'Северный', address: 'проспект Космонавтов, 31Б', lat: 47.2685, lng: 39.7185 },
  { network: 'A-Fitness', name: 'A-Fitness Майкоп', city: 'Майкоп', district: 'Майкоп', address: 'улица Спортивная, 43', lat: 44.6085, lng: 40.1085 },

  // ——— Краснодар: сети ———
  { network: 'World Class', name: 'World Class Lite Краснодар', city: 'Краснодар', district: 'Центр', address: 'Кубанская набережная, 39', lat: 45.0255, lng: 38.9725 },
  { network: 'Orange Fitness', name: 'Orange Fitness Набережная', city: 'Краснодар', district: 'Центр', address: 'Кубанская набережная, 1', lat: 45.0285, lng: 38.9685 },
  { network: 'Orange Fitness', name: 'Orange Fitness Стахановская', city: 'Краснодар', district: 'Западный', address: 'улица Стахановская, 3', lat: 45.0355, lng: 38.9485 },
  { network: 'Orange Fitness', name: 'Orange Fitness Леваневского', city: 'Краснодар', district: 'Центр', address: 'улица Леваневского, 185Б', lat: 45.0385, lng: 38.9785 },
  { network: 'Orange Fitness', name: 'Orange Fitness Звёздный', city: 'Сочи', district: 'Сочи', address: 'Звёздный', lat: 43.5855, lng: 39.7235 },
  { network: 'Balance', name: 'Balance Империал', city: 'Краснодар', district: 'Бородинская', address: 'улица Бородинская, 137 корпус 2', lat: 45.0685, lng: 39.0025 },
  { network: 'Balance', name: 'Balance Абрикосово', city: 'Краснодар', district: 'Абрикосово', address: 'улица им. Героя Бочарникова, 4 строение Б', lat: 45.0785, lng: 38.9785 },
  { network: 'XFIT', name: 'XFIT Солнечный', city: 'Краснодар', district: 'Солнечный', address: 'бульвар Клары Лучко, 1', lat: 45.0185, lng: 38.9485 },
  { network: 'XFIT', name: 'XFIT Юбилейный', city: 'Краснодар', district: 'Юбилейный', address: 'проспект Константина Образцова, 24', lat: 45.0585, lng: 38.9785 },
  { network: 'Spirit. Fitness', name: 'Spirit. Fitness Краснодар', city: 'Краснодар', district: 'Центр', address: 'улица Красная / центр', lat: 45.0355, lng: 38.9755 },
  { network: 'Alex Fitness', name: 'Alex Fitness Краснодар', city: 'Краснодар', district: 'Краснодар', address: 'улица Ставропольская', lat: 45.0425, lng: 39.0085 },

  // ——— Краснодар: независимые ———
  { network: 'Независимый', name: 'Терраспорт Галерея', city: 'Краснодар', district: 'Галерея', address: 'улица Красная, ТРЦ Галерея', lat: 45.0358, lng: 38.9765 },
  { network: 'Независимый', name: 'Терраспорт Мега', city: 'Краснодар', district: 'Мега', address: 'ТРЦ Мега Адыгея-Кубань', lat: 45.0125, lng: 38.9285 },
  { network: 'Независимый', name: 'PowerGym Краснодар', city: 'Краснодар', district: 'ФМР', address: 'улица Московская / ФМР', lat: 45.0685, lng: 39.0285 },
  { network: 'Независимый', name: 'Hardcore Gym Краснодар', city: 'Краснодар', district: 'ЮМР', address: 'улица Уральская / ЮМР', lat: 45.0185, lng: 39.0485 },
  { network: 'Независимый', name: 'Iron Club Краснодар', city: 'Краснодар', district: 'ЧМР', address: 'улица Тургенева / ЧМР', lat: 45.0485, lng: 38.9585 },
  { network: 'Независимый', name: 'MaxFit Краснодар', city: 'Краснодар', district: 'Энка', address: 'улица Российская / Энка', lat: 45.0525, lng: 39.0185 },
  { network: 'Независимый', name: 'City Gym Краснодар', city: 'Краснодар', district: 'Центр', address: 'улица Гимназическая', lat: 45.0325, lng: 38.9725 },
  { network: 'Независимый', name: 'Атлетик Холл', city: 'Краснодар', district: 'Комсомольский', address: 'улица 40-летия Победы', lat: 45.0085, lng: 39.0685 },
  { network: 'Независимый', name: 'СпортЛэнд Краснодар', city: 'Краснодар', district: 'Гидростроителей', address: 'микрорайон Гидростроителей', lat: 45.0885, lng: 39.0085 },
  { network: 'Независимый', name: 'Fresh Fitness Краснодар', city: 'Краснодар', district: 'Пашковский', address: 'улица им. 40-летия Победы / Пашковский', lat: 45.0285, lng: 39.1085 },
  { network: 'Независимый', name: 'GymStation Краснодар', city: 'Краснодар', district: 'КМР', address: 'улица Восточно-Кругликовская', lat: 45.0785, lng: 39.0485 },
  { network: 'Независимый', name: 'Form Gym Краснодар', city: 'Краснодар', district: 'Фестивальный', address: 'микрорайон Фестивальный', lat: 45.0585, lng: 38.9485 },
  { network: 'Независимый', name: 'ProGym Краснодар', city: 'Краснодар', district: 'Центр', address: 'улица Северная', lat: 45.0485, lng: 38.9825 },
  { network: 'Независимый', name: 'FitHouse Краснодар', city: 'Краснодар', district: 'Музыкальный', address: 'улица им. 70-летия Октября', lat: 45.0125, lng: 39.0285 },
  { network: 'Независимый', name: 'Force Gym Краснодар', city: 'Краснодар', district: 'ЗИП', address: 'улица ЗИП / Завод Измерительных Приборов', lat: 45.0685, lng: 38.9685 },

  // ——— Москва: независимые и локальные сети вне каталога ———
  { network: 'Независимый', name: 'Rockout Gym', city: 'Москва', district: 'Дмитровская', address: 'ЖК Савеловский Сити, метро Дмитровская', lat: 55.8085, lng: 37.5785 },
  { network: 'Независимый', name: 'Pro Trener', city: 'Москва', district: 'Центр', address: 'Студия персонального тренинга', lat: 55.7525, lng: 37.6085 },
  { network: 'Независимый', name: 'Sandow Fitness', city: 'Москва', district: 'Москва', address: 'Sandow Fitness', lat: 55.7685, lng: 37.5985 },
  { network: 'Независимый', name: 'Verso Fitness', city: 'Москва', district: 'Москва', address: 'Verso Fitness', lat: 55.7425, lng: 37.6285 },
  { network: 'Независимый', name: 'Ohana Fitness', city: 'Москва', district: 'Москва', address: 'Ohana Fitness', lat: 55.7585, lng: 37.5685 },
  { network: 'Независимый', name: 'Underground Gym Ленинский', city: 'Москва', district: 'Ленинский проспект', address: 'Ленинский проспект', lat: 55.7085, lng: 37.5785 },
  { network: 'Независимый', name: 'Respace Prime', city: 'Москва', district: 'Москва', address: 'Respace Prime Wellness & SPA', lat: 55.7485, lng: 37.5385 },
  { network: 'Независимый', name: 'T-Fit', city: 'Москва', district: 'Москва', address: 'T-Fit', lat: 55.7785, lng: 37.6485 },
  { network: 'Физкульт', name: 'Физкульт Тёплый Стан', city: 'Москва', district: 'Тёплый Стан', address: 'улица Профсоюзная / Тёплый Стан', lat: 55.6185, lng: 37.5085 },
  { network: 'Физкульт', name: 'Физкульт Чертаново', city: 'Москва', district: 'Чертаново', address: 'Чертаново', lat: 55.6185, lng: 37.6085 },
  { network: 'Физкульт', name: 'Физкульт Сокольники', city: 'Москва', district: 'Сокольники', address: 'Сокольники', lat: 55.7885, lng: 37.6785 },
  { network: 'Zebra Fitness', name: 'Zebra Fitness Бауманская', city: 'Москва', district: 'Бауманская', address: 'Бауманская', lat: 55.7725, lng: 37.6785 },
  { network: 'Zebra Fitness', name: 'Zebra Fitness Новокузнецкая', city: 'Москва', district: 'Новокузнецкая', address: 'Новокузнецкая', lat: 55.7425, lng: 37.6285 },
  { network: 'Zebra Fitness', name: 'Zebra Fitness Проспект Мира', city: 'Москва', district: 'Проспект Мира', address: 'проспект Мира', lat: 55.7785, lng: 37.6325 },
  { network: 'Планета Фитнес', name: 'Планета Фитнес Марьино', city: 'Москва', district: 'Марьино', address: 'Марьино', lat: 55.6485, lng: 37.7485 },
  { network: 'Планета Фитнес', name: 'Планета Фитнес Бутово', city: 'Москва', district: 'Бутово', address: 'Бутово', lat: 55.5485, lng: 37.5785 },
  { network: 'Независимый', name: 'Moreon Fitness', city: 'Москва', district: 'Ясенево', address: 'улица Голубинская / Moreon', lat: 55.6085, lng: 37.5285 },
  { network: 'Независимый', name: 'GoFitness Алтуфьево', city: 'Москва', district: 'Алтуфьево', address: 'Алтуфьево', lat: 55.8885, lng: 37.5885 },
  { network: 'Независимый', name: 'Gym80 Москва', city: 'Москва', district: 'Москва', address: 'Gym 80 / силовой зал', lat: 55.7285, lng: 37.6085 },
  { network: 'Независимый', name: 'Old School Gym', city: 'Москва', district: 'Москва', address: 'Old School Gym', lat: 55.7625, lng: 37.6485 },
]

const PRIORITY = new Set([
  'Москва',
  'Санкт-Петербург',
  'Казань',
  'Екатеринбург',
  'Новосибирск',
  'Краснодар',
  'Самара',
  'Ростов-на-Дону',
  'Уфа',
  'Челябинск',
  'Воронеж',
  'Пермь',
  'Волгоград',
  'Красноярск',
  'Сочи',
  'Тюмень',
  'Иркутск',
  'Владивосток',
  'Калининград',
  'Кудрово',
  'Мурино',
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
const addedByCity = {}
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
  addedByCity[raw.city] = (addedByCity[raw.city] || 0) + 1
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
      addedByCity,
      aFitness: gyms.filter((g) => g.network === 'A-Fitness').length,
      independent: gyms.filter((g) => g.network === 'Независимый').length,
      krasnodar: gyms.filter((g) => g.city === 'Краснодар').length,
      moscow: gyms.filter((g) => g.city === 'Москва').length,
    },
    null,
    2,
  ),
)
