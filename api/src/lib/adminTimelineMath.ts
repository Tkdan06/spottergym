export const TIMELINE_DOMAINS = [
  'registration',
  'gym',
  'people',
  'profile',
  'like',
  'request',
  'chat',
  'workout',
  'activity',
  'progress',
  'ai',
  'landing',
] as const

export type TimelineDomain = (typeof TIMELINE_DOMAINS)[number]
export type TimelineKind = 'event' | 'fact'

export const TIMELINE_PAGE_DEFAULT = 40
export const TIMELINE_PAGE_MAX = 80
export const SEARCH_LIMIT = 20
export const DEBUG_SAMPLE = 40
export const NEARBY_MS = 2000
export const MIN_VALID_EVENT = Date.parse('2020-01-01T00:00:00.000Z')

export const TIMELINE_SEARCH_FIELDS = ['id', 'username', 'name', 'email'] as const

const SECRET_KEY_RE =
  /password|passwd|token|secret|apikey|api_key|authorization|bearer|cookie|gigachat|private.?key|inputjson|outputjson|refresh/i

const SECRET_META_KEYS = new Set([
  'text',
  'message',
  'notes',
  'weight',
  'bodyweightkg',
  'ip',
  'useragent',
  'user_agent',
  'clickid',
  'passwordhash',
  'tokenversion',
])

const META_ALLOW = new Set(['source', 'range', 'reason', 'surface', 'gymid', 'placement', 'path'])

export const EVENT_CATALOG: { key: string; domain: TimelineDomain; label: string }[] = [
  { key: 'registration_completed', domain: 'registration', label: 'Регистрация' },
  { key: 'register_success', domain: 'registration', label: 'Регистрация с лендинга' },
  { key: 'register_view', domain: 'registration', label: 'Открыл регистрацию' },
  { key: 'gym_selected', domain: 'gym', label: 'Выбрал зал' },
  { key: 'gym_skipped', domain: 'gym', label: 'Пропустил зал' },
  { key: 'first_checkin', domain: 'gym', label: 'Первый чекин' },
  { key: 'people_list_viewed', domain: 'people', label: 'Смотрел людей' },
  { key: 'profile_completed', domain: 'profile', label: 'Заполнил профиль' },
  { key: 'profile_viewed', domain: 'profile', label: 'Открыл профиль' },
  { key: 'like_sent', domain: 'like', label: 'Лайк' },
  { key: 'chat_request_sent', domain: 'request', label: 'Запрос в чат' },
  { key: 'chat_request_accepted', domain: 'chat', label: 'Принял запрос' },
  { key: 'first_message_sent', domain: 'chat', label: 'Начал чат' },
  { key: 'workout_started', domain: 'workout', label: 'Начал тренировку' },
  { key: 'exercise_added', domain: 'workout', label: 'Добавил упражнение' },
  { key: 'workout_saved', domain: 'workout', label: 'Сохранил тренировку' },
  { key: 'check_in', domain: 'activity', label: 'Чекин' },
  { key: 'activity_opened', domain: 'activity', label: 'Открыл активность' },
  { key: 'progress_opened', domain: 'progress', label: 'Открыл прогресс' },
  { key: 'ai_analysis_opened', domain: 'ai', label: 'Открыл AI' },
  { key: 'ai_analysis_requested', domain: 'ai', label: 'Запросил разбор' },
  { key: 'ai_analysis_completed', domain: 'ai', label: 'AI-разбор готов' },
  { key: 'ai_analysis_failed', domain: 'ai', label: 'AI не ответил' },
  { key: 'ai_recommendation_viewed', domain: 'ai', label: 'Смотрел рекомендацию' },
  { key: 'view', domain: 'landing', label: 'Просмотр лендинга' },
  { key: 'scroll_50', domain: 'landing', label: 'Скролл 50%' },
  { key: 'scroll_90', domain: 'landing', label: 'Скролл 90%' },
  { key: 'cta_register', domain: 'landing', label: 'CTA регистрация' },
  { key: 'cta_login', domain: 'landing', label: 'CTA вход' },
]

const CATALOG_BY_KEY = new Map(EVENT_CATALOG.map((item) => [item.key, item]))

export type TimelineCursor = { at: Date; id: string }

export type RawTimelineRow = {
  id: string
  at: Date
  name: string
  placement: string
  path: string
  utmSource: string
  userId: string | null
  kind: TimelineKind
}

export type TimelineEntry = {
  id: string
  at: string
  event: string
  eventKey: string
  domain: TimelineDomain | 'other'
  kind: TimelineKind
  userId: string | null
  source: string
  metadata: Record<string, string>
}

export function isTimelineDomain(value: string | undefined): value is TimelineDomain {
  return !!value && (TIMELINE_DOMAINS as readonly string[]).includes(value)
}

export function parseTimelineDomain(raw: string | undefined): TimelineDomain | null {
  const value = (raw || '').trim()
  return isTimelineDomain(value) ? value : null
}

export function parseEventKey(raw: string | undefined): string | null {
  const value = (raw || '').trim().slice(0, 64)
  return value || null
}

export function parseSourceKey(raw: string | undefined): string | null {
  const value = (raw || '').trim().slice(0, 80)
  return value || null
}

export function parsePageLimit(raw: string | undefined): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return TIMELINE_PAGE_DEFAULT
  return Math.min(TIMELINE_PAGE_MAX, Math.max(1, Math.floor(n)))
}

export function parseSearchQuery(raw: string | undefined): { q: string } | { error: string } {
  const q = (raw || '').trim().slice(0, 80)
  if (!q) return { error: 'Укажи id, username, имя или email' }
  return { q }
}

export function canReadTimeline(flags: {
  isAdmin: boolean
  adminPermissions: { viewUsers: boolean }
}): boolean {
  return flags.isAdmin && flags.adminPermissions.viewUsers
}

export function encodeCursor(at: Date, id: string): string {
  return `${at.toISOString()}|${id}`
}

export function parseCursor(raw: string | undefined): TimelineCursor | null {
  const value = (raw || '').trim()
  if (!value) return null
  const split = value.indexOf('|')
  if (split <= 0) return null
  const at = new Date(value.slice(0, split))
  const id = value.slice(split + 1).slice(0, 120)
  if (!id || Number.isNaN(at.getTime())) return null
  return { at, id }
}

export function isSecretKey(key: string): boolean {
  const lower = key.toLowerCase()
  return SECRET_META_KEYS.has(lower) || SECRET_KEY_RE.test(key)
}

export function parsePlacementMeta(placement: string): Record<string, string> {
  if (!placement) return {}
  try {
    const raw = JSON.parse(placement) as unknown
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    const out: Record<string, string> = {}
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof value !== 'string' || !value.trim()) continue
      if (isSecretKey(key)) continue
      const allow = META_ALLOW.has(key.toLowerCase())
      if (!allow) continue
      out[key] = value.trim().slice(0, 80)
    }
    return out
  } catch {
    return {}
  }
}

export function eventSource(utmSource: string, placement: string, kind: TimelineKind): string {
  if (kind === 'fact') return 'fact'
  const meta = parsePlacementMeta(placement)
  if (meta.source) return meta.source
  const utm = (utmSource || '').trim()
  if (utm) return utm
  return 'direct'
}

export function matchesSource(row: RawTimelineRow, source: string | null): boolean {
  if (!source) return true
  return eventSource(row.utmSource, row.placement, row.kind) === source
}

export function domainOf(eventKey: string): TimelineDomain | 'other' {
  return CATALOG_BY_KEY.get(eventKey)?.domain ?? (eventKey.startsWith('cta_') || eventKey.startsWith('scroll_')
    ? 'landing'
    : 'other')
}

export function productLabel(eventKey: string): string {
  return CATALOG_BY_KEY.get(eventKey)?.label ?? eventKey
}

export function namesForDomain(domain: TimelineDomain | null): string[] | null {
  if (!domain) return null
  return EVENT_CATALOG.filter((item) => item.domain === domain).map((item) => item.key)
}

export function matchesDomainAndEvent(
  name: string,
  domain: TimelineDomain | null,
  eventKey: string | null,
): boolean {
  if (eventKey && name !== eventKey) return false
  if (domain && domainOf(name) !== domain) return false
  return true
}

export function sanitizeMetadata(input: Record<string, string | undefined | null>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(input)) {
    if (!value || isSecretKey(key)) continue
    const allow = META_ALLOW.has(key.toLowerCase()) || key === 'kind'
    if (!allow) continue
    out[key] = value.trim().slice(0, 80)
  }
  return out
}

export function toTimelineEntry(row: RawTimelineRow): TimelineEntry {
  const meta = parsePlacementMeta(row.placement)
  const placementPlain = row.placement && !row.placement.startsWith('{') ? row.placement : ''
  return {
    id: row.id,
    at: row.at.toISOString(),
    event: productLabel(row.name),
    eventKey: row.name,
    domain: domainOf(row.name),
    kind: row.kind,
    userId: row.userId,
    source: eventSource(row.utmSource, row.placement, row.kind),
    metadata: sanitizeMetadata({
      ...meta,
      path: row.path || undefined,
      placement: placementPlain || undefined,
      gymId: row.kind === 'fact' && row.name === 'check_in' ? row.placement || undefined : undefined,
    }),
  }
}

export function isBeforeCursor(row: RawTimelineRow, cursor: TimelineCursor | null): boolean {
  if (!cursor) return true
  if (row.at.getTime() < cursor.at.getTime()) return true
  if (row.at.getTime() > cursor.at.getTime()) return false
  return row.id < cursor.id
}

export function sortTimelineRows(rows: RawTimelineRow[]): RawTimelineRow[] {
  return [...rows].sort((a, b) => {
    const dt = b.at.getTime() - a.at.getTime()
    if (dt !== 0) return dt
    return b.id < a.id ? -1 : b.id > a.id ? 1 : 0
  })
}

/** Merge already-capped source pages. Never requires the full history. */
export function paginateMergedRows(
  pages: RawTimelineRow[][],
  cursor: TimelineCursor | null,
  limit: number,
): { rows: RawTimelineRow[]; hasMore: boolean } {
  const merged = sortTimelineRows(pages.flat().filter((row) => isBeforeCursor(row, cursor)))
  return {
    rows: merged.slice(0, limit),
    hasMore: merged.length > limit,
  }
}

export function collapseNearby(entries: TimelineEntry[], windowMs = NEARBY_MS): TimelineEntry[] {
  const out: TimelineEntry[] = []
  for (const entry of entries) {
    const prev = out[out.length - 1]
    if (
      prev &&
      prev.eventKey === entry.eventKey &&
      prev.userId === entry.userId &&
      Math.abs(Date.parse(prev.at) - Date.parse(entry.at)) <= windowMs
    ) {
      if (prev.kind === 'fact' && entry.kind === 'event') out[out.length - 1] = entry
      continue
    }
    out.push(entry)
  }
  return out
}

export function classifyTimestamp(at: Date, now: Date): 'ok' | 'future' | 'too_old' {
  const t = at.getTime()
  if (!Number.isFinite(t)) return 'too_old'
  if (t > now.getTime() + 60 * 60 * 1000) return 'future'
  if (t < MIN_VALID_EVENT) return 'too_old'
  return 'ok'
}

export function duplicateSecondKey(userId: string | null, name: string, at: Date): string {
  const second = new Date(Math.floor(at.getTime() / 1000) * 1000).toISOString()
  return `${userId ?? 'anon'}|${name}|${second}`
}

export function findDuplicateGroups(
  events: { userId: string | null; name: string; at: Date }[],
): { key: string; count: number; name: string; userId: string | null; at: string }[] {
  const map = new Map<string, { count: number; name: string; userId: string | null; at: Date }>()
  for (const event of events) {
    const key = duplicateSecondKey(event.userId, event.name, event.at)
    const prev = map.get(key)
    if (prev) prev.count += 1
    else map.set(key, { count: 1, name: event.name, userId: event.userId, at: event.at })
  }
  return [...map.values()]
    .filter((row) => row.count > 1)
    .map((row) => ({
      key: duplicateSecondKey(row.userId, row.name, row.at),
      count: row.count,
      name: row.name,
      userId: row.userId,
      at: row.at.toISOString(),
    }))
}

export function nextCursorOf(rows: RawTimelineRow[]): string | null {
  const last = rows[rows.length - 1]
  return last ? encodeCursor(last.at, last.id) : null
}
