import { prisma } from '../db.js'

export const USERNAME_MIN = 3
export const USERNAME_MAX = 20

const USERNAME_RE = /^[a-z0-9_]{3,20}$/

const RESERVED = new Set([
  'admin',
  'administrator',
  'spotter',
  'support',
  'help',
  'me',
  'api',
  'root',
  'system',
  'null',
  'undefined',
  'mod',
  'moderator',
])

const CYR_MAP: Record<string, string> = {
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
  й: 'y',
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
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
}

export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, '').toLowerCase()
}

export function isValidUsername(username: string): boolean {
  if (!USERNAME_RE.test(username)) return false
  if (RESERVED.has(username)) return false
  return true
}

function translit(input: string): string {
  let out = ''
  for (const ch of input.toLowerCase()) {
    if (CYR_MAP[ch] !== undefined) out += CYR_MAP[ch]
    else if (/[a-z0-9]/.test(ch)) out += ch
    else if (ch === ' ' || ch === '-' || ch === '_') out += '_'
  }
  return out.replace(/_+/g, '_').replace(/^_|_$/g, '')
}

function randomSuffix(len = 4): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let s = ''
  for (let i = 0; i < len; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return s
}

/** Default auto @nick length (user may later set up to USERNAME_MAX). */
const AUTO_USERNAME_LEN = 6

/** Build a short unique @username (6 chars). */
export async function allocateUsername(displayName: string): Promise<string> {
  const letter = translit(displayName).replace(/[^a-z]/g, '')[0] || 'u'

  for (let attempt = 0; attempt < 40; attempt++) {
    const candidate = `${letter}${randomSuffix(AUTO_USERNAME_LEN - 1)}`
    if (!isValidUsername(candidate)) continue
    const exists = await prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    })
    if (!exists) return candidate
  }

  // Last resort
  return randomSuffix(AUTO_USERNAME_LEN)
}

export async function ensureUserHasUsername(userId: string, displayName: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true },
  })
  if (user?.username) return user.username
  const username = await allocateUsername(displayName)
  await prisma.user.update({ where: { id: userId }, data: { username } })
  return username
}
