/* Spotter PWA service worker — Web Push + home-screen badge */

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

self.addEventListener('push', (event) => {
  let data = {
    title: 'SPOTTER',
    body: 'Новое уведомление',
    href: '/app/notifications',
    type: 'system',
    unreadCount: 1,
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
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title || 'SPOTTER', {
        body: data.body || '',
        icon: '/og-image.png',
        badge: '/og-image.png',
        data: { href: data.href || '/app/notifications', type: data.type },
        tag: data.type ? `spotter-${data.type}` : 'spotter',
        renotify: true,
      }),
      setBadge(unread),
    ]),
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
  }
})
