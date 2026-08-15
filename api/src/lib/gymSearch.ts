/** Поиск клубов: кириллица ↔ латиница + частые бренды (комета → Kometa). */

const CYR_TO_LAT: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
}

const LAT_TO_CYR_DIGRAPHS: [string, string][] = [
  ['shch', 'щ'],
  ['zh', 'ж'],
  ['kh', 'х'],
  ['ts', 'ц'],
  ['ch', 'ч'],
  ['sh', 'ш'],
  ['yu', 'ю'],
  ['ya', 'я'],
  ['yo', 'ё'],
  ['ye', 'е'],
]

const LAT_TO_CYR_SINGLE: Record<string, string> = {
  a: 'а',
  b: 'б',
  v: 'в',
  g: 'г',
  d: 'д',
  e: 'е',
  z: 'з',
  i: 'и',
  k: 'к',
  l: 'л',
  m: 'м',
  n: 'н',
  o: 'о',
  p: 'п',
  r: 'р',
  s: 'с',
  t: 'т',
  u: 'у',
  f: 'ф',
  y: 'ы',
  c: 'к',
  h: 'х',
  w: 'в',
  j: 'й',
  x: 'кс',
  q: 'к',
}

const BRAND_ALIASES: [string, string][] = [
  ['комета', 'kometa'],
  ['comet', 'kometa'],
  ['ломов', 'lomov'],
  ['ломов джим', 'lomov gym'],
  ['ворлд класс', 'world class'],
  ['ворлдкласс', 'world class'],
  ['спирит', 'spirit'],
  ['крокус', 'crocus'],
  ['алекс', 'alex'],
  ['фитнес', 'fitness'],
  ['кроссфит', 'crossfit'],
  ['хайрокс', 'hyrox'],
  ['иксфит', 'xfit'],
  ['ддх', 'ddx'],
  ['урбанфит', 'urbanfit'],
  ['urban fit', 'urbanfit'],
]

export function cyrToLat(input: string): string {
  let out = ''
  for (const ch of input.toLowerCase()) {
    out += CYR_TO_LAT[ch] ?? ch
  }
  return out
}

export function latToCyr(input: string): string {
  const s = input.toLowerCase()
  let out = ''
  let i = 0
  while (i < s.length) {
    let matched = false
    for (const [lat, cyr] of LAT_TO_CYR_DIGRAPHS) {
      if (s.startsWith(lat, i)) {
        out += cyr
        i += lat.length
        matched = true
        break
      }
    }
    if (matched) continue
    const ch = s[i]
    out += LAT_TO_CYR_SINGLE[ch] ?? ch
    i += 1
  }
  return out
}

export function normalizeGymSearchKey(input: string): string {
  return cyrToLat(input.toLowerCase())
    .replace(/[.\u00B7/_+\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function expandGymQueryVariants(qRaw: string): string[] {
  const q = qRaw.toLowerCase().trim()
  if (!q) return []
  const set = new Set<string>()
  const add = (s: string) => {
    const t = s.toLowerCase().trim()
    if (t) set.add(t)
  }
  add(q)
  add(cyrToLat(q))
  add(latToCyr(q))
  add(normalizeGymSearchKey(q))

  for (const [a, b] of BRAND_ALIASES) {
    if (q.includes(a) || normalizeGymSearchKey(q).includes(normalizeGymSearchKey(a))) {
      add(q.replaceAll(a, b))
      add(cyrToLat(q).replaceAll(cyrToLat(a), b))
    }
    if (q.includes(b) || normalizeGymSearchKey(q).includes(normalizeGymSearchKey(b))) {
      add(q.replaceAll(b, a))
    }
  }

  return [...set]
}

function tokensMatch(hayKey: string, queryKey: string): boolean {
  const tokens = queryKey.split(' ').filter(Boolean)
  if (!tokens.length) return false
  return tokens.every((t) => hayKey.includes(t))
}

export function gymMatchesQuery(
  gym: { name: string; network: string; district?: string | null; address?: string | null },
  qRaw: string,
): boolean {
  const q = qRaw.toLowerCase().trim()
  if (!q) return true
  const hay = `${gym.name} ${gym.network} ${gym.district || ''} ${gym.address || ''}`.toLowerCase()
  const hayKey = normalizeGymSearchKey(hay)
  for (const variant of expandGymQueryVariants(q)) {
    if (hay.includes(variant)) return true
    const vKey = normalizeGymSearchKey(variant)
    if (vKey && (hayKey.includes(vKey) || tokensMatch(hayKey, vKey))) return true
  }
  return false
}
