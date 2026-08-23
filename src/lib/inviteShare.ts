const INVITE_STORAGE_KEY = 'spotter.inviteFrom'
/** Keep the inviter id across Telegram → Safari / PWA hops. */
const INVITE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

type StoredInvite = { id: string; at: number }

/** Public HTTPS origin — messengers scrape this for the link preview (OG image). */
const SHARE_ORIGIN = 'https://spottergym.ru'

export interface InvitePayload {
  title: string
  /** Message body without the URL — the link goes in `url` for rich preview */
  text: string
  url: string
}

export function buildInvitePayload(opts: {
  userId: string
  gymName?: string | null
  /** Current referral status title, e.g. Команда Spotter */
  statusTitle?: string | null
}): InvitePayload {
  // Always production HTTPS so Telegram/WhatsApp/Max can fetch OG tags + og-share.png
  const url = `${SHARE_ORIGIN}/register?invite=${encodeURIComponent(opts.userId)}`
  const title = 'SPOTTER — найди людей в своём клубе'
  const gym = opts.gymName?.trim()
  const status = opts.statusTitle?.trim()
  const text = status
    ? gym
      ? `Я уже ${status} в Spotter — зайди по ссылке, будем в «${gym}».`
      : `Я уже ${status} в Spotter — зайди по ссылке, найдём людей в зале.`
    : gym
      ? `Привет! Присоединяйся ко мне в Spotter — находи людей в «${gym}».`
      : 'Привет! Присоединяйся ко мне в Spotter — найди людей в своём клубе.'

  return { title, text, url }
}

export type ShareInviteResult = 'shared' | 'cancelled' | 'unavailable'
export type ShareOrCopyResult = 'shared' | 'copied' | 'cancelled' | 'failed'

/** Web Share only works in a secure context (HTTPS or localhost). */
export function canUseNativeShare(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function'
  )
}

/**
 * Open the phone OS share sheet from a direct user click.
 * URL goes in `url` (or alone in fallback) so messengers show OG preview
 * instead of dumping a long raw link into the message body when possible.
 */
export async function shareInvite(payload: InvitePayload): Promise<ShareInviteResult> {
  if (!canUseNativeShare()) return 'unavailable'

  try {
    await navigator.share({
      title: payload.title,
      text: payload.text,
      url: payload.url,
    })
    return 'shared'
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return 'cancelled'
    }
    // Some browsers only accept text — keep invite short; link still needed to open.
    try {
      await navigator.share({
        text: `${payload.text}\n${payload.url}`,
      })
      return 'shared'
    } catch (retryErr) {
      if (retryErr instanceof DOMException && retryErr.name === 'AbortError') {
        return 'cancelled'
      }
      return 'unavailable'
    }
  }
}

/** Clipboard fallback when Web Share is missing or fails. */
export async function copyInviteLink(payload: InvitePayload): Promise<boolean> {
  const text = `${payload.text}\n${payload.url}`
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/** Prefer native share; always fall back to copy so the CTA never no-ops. */
export async function shareOrCopyInvite(payload: InvitePayload): Promise<ShareOrCopyResult> {
  if (canUseNativeShare()) {
    const result = await shareInvite(payload)
    if (result === 'shared' || result === 'cancelled') return result
  }
  const copied = await copyInviteLink(payload)
  return copied ? 'copied' : 'failed'
}

function parseStoredInvite(raw: string | null): StoredInvite | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as StoredInvite
    if (parsed && typeof parsed.id === 'string' && typeof parsed.at === 'number') {
      return { id: parsed.id.trim(), at: parsed.at }
    }
  } catch {
    const id = raw.trim()
    if (id) return { id, at: Date.now() }
  }
  return null
}

function readStoredInvite(): StoredInvite | null {
  try {
    const local = parseStoredInvite(localStorage.getItem(INVITE_STORAGE_KEY))
    if (local) {
      if (Date.now() - local.at > INVITE_MAX_AGE_MS) {
        localStorage.removeItem(INVITE_STORAGE_KEY)
        return null
      }
      return local
    }
    const session = parseStoredInvite(sessionStorage.getItem(INVITE_STORAGE_KEY))
    if (session?.id) {
      if (Date.now() - session.at > INVITE_MAX_AGE_MS) {
        sessionStorage.removeItem(INVITE_STORAGE_KEY)
        return null
      }
      persistInviteFrom(session.id)
      return parseStoredInvite(localStorage.getItem(INVITE_STORAGE_KEY)) ?? session
    }
  } catch {
    /* private mode / quota */
  }
  return null
}

export function persistInviteFrom(inviteId: string | null | undefined): void {
  const id = inviteId?.trim()
  if (!id) return
  const value = JSON.stringify({ id, at: Date.now() } satisfies StoredInvite)
  try {
    localStorage.setItem(INVITE_STORAGE_KEY, value)
    try {
      sessionStorage.removeItem(INVITE_STORAGE_KEY)
    } catch {
      // ignore
    }
  } catch {
    try {
      sessionStorage.setItem(INVITE_STORAGE_KEY, value)
    } catch {
      // ignore
    }
  }
}

export function consumeInviteFrom(): string | null {
  const stored = readStoredInvite()
  try {
    localStorage.removeItem(INVITE_STORAGE_KEY)
  } catch {
    // ignore
  }
  try {
    sessionStorage.removeItem(INVITE_STORAGE_KEY)
  } catch {
    // ignore
  }
  return stored?.id ?? null
}

export function peekInviteFrom(): string | null {
  return readStoredInvite()?.id ?? null
}

/** Keep `?invite=` on register hops (welcome, login, terms). */
export function registerHref(extra?: Record<string, string>): string {
  const params = new URLSearchParams()
  const invite = peekInviteFrom()
  if (invite) params.set('invite', invite)
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) params.set(key, value)
    }
  }
  const query = params.toString()
  return query ? `/register?${query}` : '/register'
}
