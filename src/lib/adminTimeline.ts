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

export type TimelineEntry = {
  id: string
  at: string
  event: string
  eventKey: string
  domain: TimelineDomain | 'other'
  kind: 'event' | 'fact'
  userId: string | null
  source: string
  metadata: Record<string, string>
}

export type TimelineSearchHit = {
  id: string
  name: string
  username: string
  email: string
  registeredAt: string
  deleted: boolean
}

export type AdminTimelinePayload = {
  timezone: 'Europe/Moscow'
  generatedAt: string
  range: { preset: string; from: string; to: string; fromKey: string; toKey: string }
  user: TimelineSearchHit & { homeGymId: string | null }
  entries: TimelineEntry[]
  hasMore: boolean
  nextCursor: string | null
  options: {
    domains: { id: TimelineDomain; label: string }[]
    events: { key: string; domain: string; label: string }[]
    sources: string[]
  }
}

export type AdminEventDebugPayload = {
  timezone: 'Europe/Moscow'
  generatedAt: string
  range: { preset: string; fromKey: string; toKey: string }
  eventCount: number
  uniqueUsers: number
  missingUserId: number
  duplicates: {
    groups: number
    sample: { name: string; userId: string | null; at: string; count: number }[]
  }
  invalidTimestamp: {
    count: number
    sample: { id: string; name: string; at: string; userId: string | null }[]
  }
  invalidReferences: {
    count: number
    sample: { id: string; name: string; at: string; userId: string | null }[]
  }
  byName: { name: string; events: number; uniqueUsers: number; missingUserId: number }[]
}

export const TIMELINE_DOMAIN_OPTIONS: { id: TimelineDomain; label: string }[] = [
  { id: 'registration', label: 'Registration' },
  { id: 'gym', label: 'Gym' },
  { id: 'people', label: 'People' },
  { id: 'profile', label: 'Profile' },
  { id: 'like', label: 'Like' },
  { id: 'request', label: 'Request' },
  { id: 'chat', label: 'Chat' },
  { id: 'workout', label: 'Workout' },
  { id: 'activity', label: 'Activity' },
  { id: 'progress', label: 'Progress' },
  { id: 'ai', label: 'AI' },
  { id: 'landing', label: 'Landing' },
]

export function isTimelineDomain(value: string | null | undefined): value is TimelineDomain {
  return !!value && (TIMELINE_DOMAINS as readonly string[]).includes(value)
}
