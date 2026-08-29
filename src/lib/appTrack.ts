import { getApiBase } from './apiClient'
import { getLandingSessionId, getLandingVisitorId } from './landingTrack'

export type AppTrackName =
  | 'registration_completed'
  | 'gym_selected'
  | 'gym_skipped'
  | 'profile_completed'
  | 'first_checkin'
  | 'people_list_viewed'
  | 'profile_viewed'
  | 'like_sent'
  | 'chat_request_sent'
  | 'chat_request_accepted'
  | 'first_message_sent'
  | 'workout_started'
  | 'exercise_added'
  | 'workout_saved'
  | 'progress_opened'
  | 'activity_opened'
  | 'ai_analysis_opened'
  | 'ai_analysis_requested'
  | 'ai_analysis_completed'
  | 'ai_analysis_failed'
  | 'ai_recommendation_viewed'

const FIRED_KEY = 'spotter_app_fired'
const META_KEYS = ['source', 'range', 'reason', 'surface'] as const

const ONCE_PER_SESSION: ReadonlySet<AppTrackName> = new Set([
  'people_list_viewed',
  'progress_opened',
  'activity_opened',
  'ai_analysis_opened',
  'registration_completed',
  'profile_completed',
])

function alreadyFired(key: string) {
  try {
    const raw = sessionStorage.getItem(FIRED_KEY)
    const set = raw ? (JSON.parse(raw) as string[]) : []
    return Array.isArray(set) && set.includes(key)
  } catch {
    return false
  }
}

function markFired(key: string) {
  try {
    const raw = sessionStorage.getItem(FIRED_KEY)
    const set = raw ? (JSON.parse(raw) as string[]) : []
    const next = Array.isArray(set) ? set : []
    if (!next.includes(key)) next.push(key)
    sessionStorage.setItem(FIRED_KEY, JSON.stringify(next.slice(-80)))
  } catch {
    /* ignore */
  }
}

/** Product funnel — names and tiny metadata only. No workout payloads. */
export function trackApp(
  name: AppTrackName,
  meta?: Partial<Record<(typeof META_KEYS)[number], string>>,
) {
  if (typeof window === 'undefined') return
  const onceExtra = meta?.surface || meta?.range || ''
  const onceKey = onceExtra ? `${name}:${onceExtra}` : name
  if (ONCE_PER_SESSION.has(name)) {
    if (alreadyFired(onceKey)) return
    markFired(onceKey)
  }

  const clean: Record<string, string> = {}
  if (meta) {
    for (const key of META_KEYS) {
      const v = meta[key]
      if (typeof v === 'string' && v.trim()) clean[key] = v.trim().slice(0, 32)
    }
  }

  void fetch(`${getApiBase()}/analytics/app`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      name,
      visitorId: getLandingVisitorId(),
      sessionId: getLandingSessionId(),
      path: window.location.pathname.slice(0, 80),
      meta: clean,
    }),
    keepalive: true,
  }).catch(() => {
    /* offline / adblock */
  })
}
