/**
 * Add independent (Независимый) Saint Petersburg gyms + fix/fill key network gaps.
 * Sources: gfit.spb.ru, onfit.club, parusclub.ru, fitnessclub24.ru, fit1.spb.ru,
 * sport.neptun.spb.ru, crocusfitness.com, worldclass.ru, 2GIS / Yandex Maps.
 * Run: node scripts/add-spb-independent-gyms.mjs
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
  // ——— Гимназия Фитнес (gfit.spb.ru) ———
  {
    network: 'Независимый',
    name: 'Гимназия Фитнес',
    city: 'Санкт-Петербург',
    district: 'Фрунзенский',
    address: 'улица Ташкентская, 3, корп. 3, БЦ «Фландрия Плаза»',
    lat: 59.8755,
    lng: 30.3755,
  },

  // ——— ONFiT (onfit.club) ———
  {
    network: 'Независимый',
    name: 'ONFiT Планерная',
    city: 'Санкт-Петербург',
    district: 'Приморский',
    address: 'улица Планерная, 91, корп. 1, стр. 1',
    lat: 59.999,
    lng: 30.239,
  },

  // ——— Парус (parusclub.ru) ———
  {
    network: 'Независимый',
    name: 'Парус Парадный',
    city: 'Санкт-Петербург',
    district: 'Центральный',
    address: 'улица Парадная, 3, корп. 2, ЖК «Парадный квартал»',
    lat: 59.944,
    lng: 30.37,
  },

  // ——— Hard Club (Yandex / 2GIS) ———
  {
    network: 'Независимый',
    name: 'Hard Club Болотная',
    city: 'Санкт-Петербург',
    district: 'Калининский',
    address: 'улица Болотная, 2, корп. 2',
    lat: 59.9855,
    lng: 30.345,
  },

  // ——— Нептун (sport.neptun.spb.ru) ———
  {
    network: 'Независимый',
    name: 'Нептун Обводный',
    city: 'Санкт-Петербург',
    district: 'Адмиралтейский',
    address: 'набережная Обводного канала, 93А, МДЦ «Нептун»',
    lat: 59.914,
    lng: 30.321,
  },

  // ——— СКА Петроградский ———
  {
    network: 'Независимый',
    name: 'СКА Петроградский',
    city: 'Санкт-Петербург',
    district: 'Петроградский',
    address: 'улица Дивенская, 4',
    lat: 59.96,
    lng: 30.315,
  },

  // ——— Fitness One (fit1.spb.ru) ———
  {
    network: 'Независимый',
    name: 'Fitness One Путиловский',
    city: 'Санкт-Петербург',
    district: 'Кировский',
    address: 'проспект Народного Ополчения, 6, ТК «Путиловский»',
    lat: 59.851,
    lng: 30.269,
  },

  // ——— Smolny Fitness ———
  {
    network: 'Независимый',
    name: 'Smolny Fitness',
    city: 'Санкт-Петербург',
    district: 'Центральный',
    address: 'улица Орловская, 1, корп. 2',
    lat: 59.9485,
    lng: 30.3705,
  },

  // ——— TheMostFit ———
  {
    network: 'Независимый',
    name: 'TheMostFit Лиговский',
    city: 'Санкт-Петербург',
    district: 'Центральный',
    address: 'Лиговский проспект, 56Г',
    lat: 59.924,
    lng: 30.359,
  },

  // ——— FitnessKing ———
  {
    network: 'Независимый',
    name: 'FitnessKing Коллонтай',
    city: 'Санкт-Петербург',
    district: 'Невский',
    address: 'улица Коллонтай, 31, корп. 1',
    lat: 59.917,
    lng: 30.482,
  },

  // ——— FITNESS 24 (fitnessclub24.ru) — локальный питерский бренд ———
  {
    network: 'Независимый',
    name: 'Fitness 24 Ветеранов',
    city: 'Санкт-Петербург',
    district: 'Кировский',
    address: 'улица Солдата Корзуна, 1, корп. 2, лит. Б',
    lat: 59.841,
    lng: 30.218,
  },
  {
    network: 'Независимый',
    name: 'Fitness 24 Лиговский',
    city: 'Санкт-Петербург',
    district: 'Центральный',
    address: 'улица Ново-Рыбинская, 19-21, ТЦ «Квартал», 4 этаж',
    lat: 59.9165,
    lng: 30.355,
  },
  {
    network: 'Независимый',
    name: 'Fitness 24 Народная',
    city: 'Санкт-Петербург',
    district: 'Невский',
    address: 'улица Народная, 4, МФДЦ «Невский», 4 этаж',
    lat: 59.878,
    lng: 30.458,
  },
  {
    network: 'Независимый',
    name: 'Fitness 24 Просвещения',
    city: 'Санкт-Петербург',
    district: 'Выборгский',
    address: 'улица Кустодиева, 7, корп. 2, ЖК «Лондон Парк»',
    lat: 60.038,
    lng: 30.355,
  },
  {
    network: 'Независимый',
    name: 'Fitness 24 Савушкина',
    city: 'Санкт-Петербург',
    district: 'Приморский',
    address: 'улица Савушкина, 126, ТРК «Атлантик Сити»',
    lat: 59.985,
    lng: 30.215,
  },

  // ——— World Class Крестовский (worldclass.ru) — в каталоге ошибочно был в Москве ———
  {
    network: 'World Class',
    name: 'World Class Крестовский',
    city: 'Санкт-Петербург',
    district: 'Петроградский',
    address: 'набережная Мартынова, 38А',
    lat: 59.9705,
    lng: 30.2505,
  },

  // ——— Crocus Fitness SPB (crocusfitness.com) — сеть есть в каталоге, СПб отсутствовал ———
  {
    network: 'Crocus Fitness',
    name: 'Crocus Fitness Рубинштейна',
    city: 'Санкт-Петербург',
    district: 'Центральный',
    address: 'Владимирский проспект, 19, Владимирский пассаж',
    lat: 59.9295,
    lng: 30.3485,
  },
  {
    network: 'Crocus Fitness',
    name: 'Crocus Fitness СКА Арена',
    city: 'Санкт-Петербург',
    district: 'Московский',
    address: 'проспект Юрия Гагарина, 8, СКА Арена',
    lat: 59.8675,
    lng: 30.33,
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

/** Remove mis-tagged Moscow stub for World Class Крестовский (actual club is in SPB). */
const WRONG_WC_KRESTOVSKY = 'gym-world-class-world-class-krestovskiy-moskva'
const byId = new Map(
  existing.filter((g) => g.id !== WRONG_WC_KRESTOVSKY).map((g) => [g.id, g]),
)
const removedWrong = existing.some((g) => g.id === WRONG_WC_KRESTOVSKY)

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

const spb = gyms.filter((g) => g.city === 'Санкт-Петербург')
const independent = spb.filter((g) => g.network === 'Независимый')

console.log(
  JSON.stringify(
    {
      added,
      removedWrongMoscowKrestovsky: removedWrong,
      total: gyms.length,
      spbTotal: spb.length,
      independentSpb: independent.length,
      addedNames,
      spbNetworks: [...new Set(spb.map((g) => g.network))].sort(),
    },
    null,
    2,
  ),
)
