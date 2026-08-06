/**
 * Fix Moscow gym stubs: real street addresses, remove closed/mis-tagged entries,
 * replace fake Zebra metro stubs with official clubs, move WC Стачек → SPb.
 *
 * Sources: worldclass.ru, brightfit.ru, fitneszebra.ru, ohanabutovo.ru,
 * versofitness.ru, sandowfitness.ru, rockoutgym.ru, wellness-respace.ru,
 * moreon.ru / 2GIS, alexfitness.ru (only Коломенское + Филион remain in Moscow).
 *
 * Run: node scripts/fix-moscow-stub-addresses.mjs
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
  if (city === 'Москва') return 'moskva'
  if (city === 'Санкт-Петербург') return 'sankt-peterburg'
  return slug(city)
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

const PRIORITY = new Set([
  'Москва',
  'Санкт-Петербург',
  'Новосибирск',
  'Екатеринбург',
  'Казань',
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

/** Closed / unverified Moscow stubs — remove rather than invent addresses */
const REMOVE_IDS = [
  'gym-world-class-world-class-sochi-moskva',
  'gym-alex-fitness-alex-fitness-belyaevo-moskva',
  'gym-alex-fitness-alex-fitness-butovo-moskva',
  'gym-alex-fitness-alex-fitness-mitino-moskva',
  'gym-alex-fitness-alex-fitness-novogireevo-moskva',
  'gym-alex-fitness-alex-fitness-prazhskaya-moskva',
  'gym-alex-fitness-alex-fitness-rechnoy-vokzal-moskva',
  'gym-alex-fitness-alex-fitness-schelkovskaya-moskva',
  'gym-planeta-fitnes-planeta-fitnes-butovo-moskva',
  'gym-planeta-fitnes-planeta-fitnes-marino-moskva',
  'gym-fizkult-fizkult-sokolniki-moskva',
  'gym-fizkult-fizkult-teplyy-stan-moskva',
  'gym-fizkult-fizkult-chertanovo-moskva',
  'gym-zebra-fitness-zebra-fitness-baumanskaya-moskva',
  'gym-zebra-fitness-zebra-fitness-novokuznetskaya-moskva',
  'gym-zebra-fitness-zebra-fitness-prospekt-mira-moskva',
  'gym-nezavisimyy-gofitness-altufevo-moskva',
  'gym-nezavisimyy-underground-gym-leninskiy-moskva',
  'gym-nezavisimyy-old-school-gym-moskva',
  // Ohana generic stub replaced by named clubs below
  'gym-nezavisimyy-ohana-fitness-moskva',
  // WC Стачек re-id to SPb
  'gym-world-class-world-class-stachek-moskva',
]

/** In-place field updates (same id) */
const PATCH_BY_ID = {
  'gym-world-class-world-class-tulskaya-moskva': {
    district: 'Даниловский',
    address: 'Варшавское шоссе, 12А',
    lat: 55.7058,
    lng: 37.6255,
  },
  'gym-world-class-world-class-red7-moskva': {
    district: 'Красносельский',
    address: 'проспект Академика Сахарова, 7, ЖК RED7',
    lat: 55.7695,
    lng: 37.6485,
  },
  'gym-world-class-world-class-triumf-moskva': {
    address: 'Чапаевский переулок, 3',
  },
  'gym-brightfit-brightfit-ostankino-moskva': {
    district: 'Останкинский',
    address: 'улица Академика Королева, 13',
    lat: 55.8218,
    lng: 37.6055,
  },
  'gym-nezavisimyy-moreon-fitness-moskva': {
    district: 'Ясенево',
    address: 'улица Голубинская, 16',
    lat: 55.6015,
    lng: 37.5365,
  },
  'gym-nezavisimyy-verso-fitness-moskva': {
    district: 'Обручевский',
    address: 'Ленинский проспект, 111, корп. 1',
    lat: 55.6632,
    lng: 37.5054,
  },
  'gym-nezavisimyy-sandow-fitness-moskva': {
    district: 'Нижегородский',
    address: 'улица Нижегородская, 29–33, БЦ «Нижегородский»',
    lat: 55.7382,
    lng: 37.6981,
  },
  'gym-nezavisimyy-respace-prime-moskva': {
    district: 'Тверской',
    address: '1-я Тверская-Ямская улица, 2А',
    lat: 55.7712,
    lng: 37.5958,
  },
  'gym-nezavisimyy-rockout-gym-moskva': {
    district: 'Бутырский',
    address: 'улица Новодмитровская, 2, корп. 7, МФК «Савеловский Сити»',
    lat: 55.8051,
    lng: 37.5902,
  },
  'gym-nezavisimyy-t-fit-moskva': {
    district: 'Пресненский',
    address: 'Большой Тишинский переулок, 10, стр. 1',
    lat: 55.7674,
    lng: 37.5751,
  },
  'gym-nezavisimyy-pro-trener-moskva': {
    district: 'Пресненский',
    address: 'Благовещенский переулок, 1Б',
    lat: 55.7631,
    lng: 37.5952,
  },
}

/** New clubs (or re-homed entries with new ids) */
const ADD = [
  {
    network: 'World Class',
    name: 'World Class Стачек',
    city: 'Санкт-Петербург',
    district: 'Кировский',
    address: 'проспект Стачек, 99, ТРК «Континент»',
    lat: 59.8512,
    lng: 30.2684,
  },
  {
    network: 'Независимый',
    name: 'Ohana Бутово',
    city: 'Москва',
    district: 'Южное Бутово',
    address: 'улица Бунинская аллея, 9А',
    lat: 55.5382,
    lng: 37.5154,
  },
  {
    network: 'Независимый',
    name: 'Ohana Московский',
    city: 'Москва',
    district: 'Московский',
    address: 'улица Хабарова, 2, г. Московский',
    lat: 55.5991,
    lng: 37.3548,
  },
  {
    network: 'Независимый',
    name: 'Ohana Некрасовка',
    city: 'Москва',
    district: 'Некрасовка',
    address: 'улица 2-я Вольская, 11А',
    lat: 55.6824,
    lng: 37.9285,
  },
  // Official Zebra Moscow clubs (fitneszebra.ru)
  {
    network: 'Zebra Fitness',
    name: 'Zebra Fitness Павелецкая',
    city: 'Москва',
    district: 'Даниловский',
    address: 'Дербеневская набережная, 7, стр. 6',
    lat: 55.7275,
    lng: 37.6545,
  },
  {
    network: 'Zebra Fitness',
    name: 'Zebra Fitness Алтуфьево',
    city: 'Москва',
    district: 'Алтуфьевский',
    address: 'Алтуфьевское шоссе, 18А',
    lat: 55.8975,
    lng: 37.5865,
  },
  {
    network: 'Zebra Fitness',
    name: 'Zebra Fitness Бабушкинская',
    city: 'Москва',
    district: 'Бабушкинский',
    address: 'улица Енисейская, 35',
    lat: 55.8695,
    lng: 37.6615,
  },
  {
    network: 'Zebra Fitness',
    name: 'Zebra Fitness Бульвар Адмирала Ушакова',
    city: 'Москва',
    district: 'Южное Бутово',
    address: 'улица Веневская, 6, ТРК «Витте Молл»',
    lat: 55.5455,
    lng: 37.5435,
  },
  {
    network: 'Zebra Fitness',
    name: 'Zebra Fitness Дубровка',
    city: 'Москва',
    district: 'Южнопортовый',
    address: '1-я улица Машиностроения, 10',
    lat: 55.7185,
    lng: 37.6775,
  },
  {
    network: 'Zebra Fitness',
    name: 'Zebra Fitness Калужская',
    city: 'Москва',
    district: 'Черёмушки',
    address: 'улица Профсоюзная, 76',
    lat: 55.6545,
    lng: 37.5475,
  },
  {
    network: 'Zebra Fitness',
    name: 'Zebra Fitness Ленинский проспект',
    city: 'Москва',
    district: 'Донской',
    address: 'улица Орджоникидзе, 10А',
    lat: 55.7085,
    lng: 37.5955,
  },
  {
    network: 'Zebra Fitness',
    name: 'Zebra Fitness Медведково',
    city: 'Москва',
    district: 'Северное Медведково',
    address: 'улица Широкая, 30',
    lat: 55.8875,
    lng: 37.6615,
  },
  {
    network: 'Zebra Fitness',
    name: 'Zebra Fitness Петровско-Разумовская',
    city: 'Москва',
    district: 'Тимирязевский',
    address: '3-й Нижнелихоборский проезд, 1, стр. 16',
    lat: 55.8405,
    lng: 37.5555,
  },
  {
    network: 'Zebra Fitness',
    name: 'Zebra Fitness Черкизовская',
    city: 'Москва',
    district: 'Преображенское',
    address: 'Щёлковское шоссе, 3',
    lat: 55.8025,
    lng: 37.7455,
  },
]

const existing = JSON.parse(readFileSync(gymsPath, 'utf8'))
const byId = new Map(existing.map((g) => [g.id, g]))

const removed = []
for (const id of REMOVE_IDS) {
  if (byId.delete(id)) removed.push(id)
}

const patched = []
for (const [id, patch] of Object.entries(PATCH_BY_ID)) {
  const row = byId.get(id)
  if (!row) continue
  Object.assign(row, patch)
  patched.push(id)
}

const added = []
for (const [i, raw] of ADD.entries()) {
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
  added.push(raw.name)
}

const gyms = [...byId.values()].sort((a, b) => {
  if (a.network !== b.network) return a.network.localeCompare(b.network, 'en')
  if (a.city !== b.city) return a.city.localeCompare(b.city, 'ru')
  return a.name.localeCompare(b.name, 'ru')
})

writeFileSync(gymsPath, `${JSON.stringify(gyms, null, 2)}\n`)
writeFileSync(citiesPath, `${JSON.stringify(buildCities(gyms), null, 2)}\n`)
copyFileSync(gymsPath, apiGymsPath)

const moscow = gyms.filter((g) => g.city === 'Москва')
const stubsLeft = moscow.filter((g) => {
  const a = (g.address || '').trim()
  return !a || !/\d/.test(a)
})

console.log(
  JSON.stringify(
    {
      removed: removed.length,
      patched: patched.length,
      added: added.length,
      addedNames: added,
      total: gyms.length,
      moscowTotal: moscow.length,
      moscowStubsLeft: stubsLeft.map((g) => `${g.name} | ${JSON.stringify(g.address)}`),
    },
    null,
    2,
  ),
)
