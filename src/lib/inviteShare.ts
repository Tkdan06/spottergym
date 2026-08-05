const INVITE_STORAGE_KEY = 'spotter.inviteFrom'

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
}): InvitePayload {
  // Always production HTTPS so Telegram/WhatsApp/Max can fetch OG tags + og-image.png
  const url = `${SHARE_ORIGIN}/register?invite=${encodeURIComponent(opts.userId)}`
  const title = 'SPOTTER — найди своих в зале'
  const gym = opts.gymName?.trim()
  // Текст без сырого URL: ссылка уходит отдельно в `url`, мессенджер рисует красивое OG-превью
  const text = gym
    ? `Привет! Присоединяйся ко мне в Spotter — ищем своих в «${gym}».`
    : 'Привет! Присоединяйся ко мне в Spotter — найди своих в зале.'

  return { title, text, url }
}

export type ShareInviteResult = 'shared' | 'cancelled' | 'unavailable'

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

export function persistInviteFrom(inviteId: string | null | undefined): void {
  const id = inviteId?.trim()
  if (!id) return
  try {
    sessionStorage.setItem(INVITE_STORAGE_KEY, id)
  } catch {
    // ignore
  }
}

export function consumeInviteFrom(): string | null {
  try {
    const id = sessionStorage.getItem(INVITE_STORAGE_KEY)
    if (id) sessionStorage.removeItem(INVITE_STORAGE_KEY)
    return id
  } catch {
    return null
  }
}

export function peekInviteFrom(): string | null {
  try {
    return sessionStorage.getItem(INVITE_STORAGE_KEY)
  } catch {
    return null
  }
}
