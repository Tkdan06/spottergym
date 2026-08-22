import { getApiBase, getStoredToken } from './apiClient'

type PushSubscribePayload = {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i)
  return out
}

export function isStandalonePwa() {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return (
    Boolean(nav.standalone) ||
    window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches
  )
}

export function pushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export async function registerSpotterServiceWorker() {
  if (!pushSupported()) return null
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  } catch (err) {
    console.warn('[push] SW register failed', err)
    return null
  }
}

let activeChatId: string | null = null

export function getActiveChatId() {
  return activeChatId
}

/**
 * Tell the service worker which chat is open so OS pushes for that thread are suppressed
 * while the page is visible. Pass null on leave / when the tab is hidden.
 */
export function setActiveChatForPush(conversationId: string | null) {
  activeChatId = conversationId || null
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  const post = (sw: ServiceWorker | null | undefined) => {
    sw?.postMessage({
      type: 'spotter:active-chat',
      conversationId: conversationId || null,
    })
  }
  post(navigator.serviceWorker.controller)
  void navigator.serviceWorker.ready
    .then((reg) => post(reg.active))
    .catch(() => undefined)
}

async function getReadyRegistration() {
  if (!pushSupported()) return null
  await registerSpotterServiceWorker()
  return navigator.serviceWorker.ready
}

export async function syncAppBadge(count: number) {
  const n = Math.max(0, Math.floor(count))
  try {
    const nav = navigator as Navigator & {
      setAppBadge?: (value?: number) => Promise<void>
      clearAppBadge?: () => Promise<void>
    }
    if (typeof nav.setAppBadge === 'function') {
      if (n > 0) await nav.setAppBadge(n)
      else if (typeof nav.clearAppBadge === 'function') await nav.clearAppBadge()
    }
  } catch {
    /* ignore */
  }

  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    reg?.active?.postMessage({ type: 'spotter:badge', count: n })
  } catch {
    /* ignore */
  }
}

async function fetchVapidPublicKey() {
  const res = await fetch(`${getApiBase()}/push/vapid-public-key`, {
    credentials: 'include',
  })
  const data = (await res.json().catch(() => ({}))) as {
    configured?: boolean
    publicKey?: string
  }
  if (!data.configured || !data.publicKey) return ''
  return data.publicKey
}

async function postSubscription(path: '/push/subscribe' | '/push/unsubscribe', body: PushSubscribePayload | { endpoint: string }) {
  const res = await fetch(`${getApiBase()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error || 'Не удалось сохранить подписку')
  }
}

function serializeSubscription(sub: PushSubscription): PushSubscribePayload {
  const json = sub.toJSON()
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth
  if (!json.endpoint || !p256dh || !auth) {
    throw new Error('Браузер вернул неполную подписку')
  }
  return { endpoint: json.endpoint, keys: { p256dh, auth } }
}

export async function getPushSubscriptionState(): Promise<{
  supported: boolean
  standalone: boolean
  permission: NotificationPermission | 'unsupported'
  subscribed: boolean
  configured: boolean
}> {
  if (!pushSupported()) {
    return {
      supported: false,
      standalone: isStandalonePwa(),
      permission: 'unsupported',
      subscribed: false,
      configured: false,
    }
  }

  let configured = false
  try {
    configured = Boolean(await fetchVapidPublicKey())
  } catch {
    configured = false
  }

  const permission = Notification.permission
  let subscribed = false
  try {
    const reg = await getReadyRegistration()
    const sub = await reg?.pushManager.getSubscription()
    subscribed = Boolean(sub)
  } catch {
    subscribed = false
  }

  return {
    supported: true,
    standalone: isStandalonePwa(),
    permission,
    subscribed,
    configured,
  }
}

/** Must be called from a user gesture on iOS. */
export async function enableWebPush() {
  if (!pushSupported()) throw new Error('Пуши не поддерживаются в этом браузере')
  if (!isStandalonePwa()) {
    throw new Error('Добавь Spotter на домашний экран — пуши работают только из иконки приложения')
  }

  const publicKey = await fetchVapidPublicKey()
  if (!publicKey) throw new Error('Пуши пока не настроены на сервере')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Разрешение на уведомления не выдано')

  const reg = await getReadyRegistration()
  if (!reg) throw new Error('Не удалось зарегистрировать service worker')

  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
  }

  await postSubscription('/push/subscribe', serializeSubscription(sub))
  return true
}

export async function disableWebPush() {
  const reg = await getReadyRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  const endpoint = sub.endpoint
  try {
    await postSubscription('/push/unsubscribe', { endpoint })
  } catch {
    /* still unsubscribe locally */
  }
  await sub.unsubscribe()
}

/** Re-sync existing permission → server (after login / app open). */
export async function ensureWebPushSubscription() {
  if (!pushSupported() || !isStandalonePwa()) return false
  if (Notification.permission !== 'granted') return false
  if (!getStoredToken()) return false

  try {
    const publicKey = await fetchVapidPublicKey()
    if (!publicKey) return false
    const reg = await getReadyRegistration()
    if (!reg) return false
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
    }
    await postSubscription('/push/subscribe', serializeSubscription(sub))
    return true
  } catch (err) {
    console.warn('[push] ensure subscription', err)
    return false
  }
}
