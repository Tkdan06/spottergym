/* Spotter PWA service worker — Web Push + home-screen badge */

/** clientId → conversationId while that window is viewing a chat */
const activeChatByClient = new Map()

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

async function setBadge(count) {
  try {
    if (typeof self.navigator?.setAppBadge === 'function') {
      if (count > 0) await self.navigator.setAppBadge(count)
      else if (typeof self.navigator.clearAppBadge === 'function') await self.navigator.clearAppBadge()
    }
  } catch {
    /* badge unsupported */
  }
}

/** Conversation id from /app/messages/:id (optional trailing slash / query). */
function conversationIdFromHref(href) {
  if (!href || typeof href !== 'string') return ''
  try {
    const path = new URL(href, self.location.origin).pathname
    const m = /^\/app\/messages\/([^/]+)\/?$/.exec(path)
    return m ? decodeURIComponent(m[1]) : ''
  } catch {
    return ''
  }
}

/**
 * Skip OS banner when the user already has this chat open and visible.
 * Other conversations still notify. Background / other tabs still notify.
 */
async function isViewingConversation(conversationId) {
  if (!conversationId) return false
  const needle = `/app/messages/${conversationId}`
  const windowClients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  })
  for (const client of windowClients) {
    try {
      const reported = activeChatByClient.get(client.id)
      if (reported === conversationId) {
        if (client.visibilityState === 'visible' || client.focused === true) return true
      }
      const path = new URL(client.url).pathname.replace(/\/$/, '')
      if (path !== needle) continue
      if (client.visibilityState === 'visible' || client.focused === true) return true
    } catch {
      /* ignore bad client url */
    }
  }
  return false
}

self.addEventListener('push', (event) => {
  let data = {
    title: 'Уведомление',
    body: '',
    href: '/app/notifications',
    type: 'system',
    unreadCount: 1,
    conversationId: '',
  }
  try {
    if (event.data) {
      const parsed = event.data.json()
      data = { ...data, ...parsed }
    }
  } catch {
    try {
      const text = event.data?.text()
      if (text) data.body = text
    } catch {
      /* ignore */
    }
  }

  const unread = Number(data.unreadCount) || 1
  const title = String(data.title || 'Уведомление').trim()
  const body = String(data.body || '').trim()
  const href = data.href || '/app/notifications'
  const conversationId =
    String(data.conversationId || '').trim() || conversationIdFromHref(href)

  event.waitUntil(
    (async () => {
      const isChatPush =
        data.type === 'chat_message' ||
        (conversationId && String(href).includes('/app/messages/'))
      if (isChatPush && (await isViewingConversation(conversationId))) {
        await setBadge(unread)
        return
      }

      await Promise.all([
        self.registration.showNotification(title, {
          body,
          icon: '/og-share.png',
          badge: '/og-share.png',
          data: {
            href,
            type: data.type,
            conversationId: conversationId || undefined,
          },
          tag:
            data.tag ||
            (href ? `spotter-${String(href).slice(0, 120)}` : null) ||
            (data.type ? `spotter-${data.type}` : 'spotter'),
          renotify: true,
        }),
        setBadge(unread),
      ])
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const href = event.notification?.data?.href || '/app/notifications'
  const url = new URL(href, self.location.origin).href

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of clients) {
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client) {
            try {
              await client.navigate(url)
            } catch {
              /* navigate may fail on some browsers */
            }
          }
          client.postMessage({ type: 'spotter:navigate', href })
          return
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(url)
    })(),
  )
})

self.addEventListener('message', (event) => {
  const data = event.data
  if (!data || typeof data !== 'object') return
  if (data.type === 'spotter:badge') {
    const count = Number(data.count) || 0
    event.waitUntil(setBadge(count))
    return
  }
  if (data.type === 'spotter:active-chat') {
    const source = event.source
    if (!source || !('id' in source) || typeof source.id !== 'string') return
    const id = String(data.conversationId || '').trim()
    if (id) activeChatByClient.set(source.id, id)
    else activeChatByClient.delete(source.id)
  }
})
