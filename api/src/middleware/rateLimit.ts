import { createMiddleware } from 'hono/factory'

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()
const MAX_BUCKETS = 20_000

function clientKey(ip: string, route: string) {
  return `${route}:${ip}`
}

/**
 * Client IP: prefer nginx X-Real-IP (set from $remote_addr).
 * Do not trust X-Forwarded-For from the client.
 */
export function clientIp(c: { req: { header: (name: string) => string | undefined }; env?: unknown }) {
  const real = c.req.header('x-real-ip')?.trim()
  if (real) return real.slice(0, 64)

  // Direct to Node: ignore client X-Forwarded-For (spoofable). Nginx should set X-Real-IP.
  const incoming = (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)
    ?.incoming
  const remote = incoming?.socket?.remoteAddress?.replace(/^::ffff:/, '').trim()
  if (remote && remote !== '::1') return remote.slice(0, 64)
  if (remote === '::1') return '127.0.0.1'
  return 'unknown'
}

/** Simple in-memory limiter (single-node). Bound map size against spoof floods. */
export function rateLimit(opts: { windowMs: number; max: number; route: string }) {
  return createMiddleware(async (c, next) => {
    const key = clientKey(clientIp(c), opts.route)
    const now = Date.now()
    const bucket = buckets.get(key)
    if (!bucket || now >= bucket.resetAt) {
      if (buckets.size >= MAX_BUCKETS) {
        // Drop expired entries; if still full, reject this request
        for (const [k, b] of buckets) {
          if (now >= b.resetAt) buckets.delete(k)
        }
        if (buckets.size >= MAX_BUCKETS) {
          return c.json({ error: 'Слишком много запросов. Попробуй позже.' }, 429)
        }
      }
      buckets.set(key, { count: 1, resetAt: now + opts.windowMs })
      await next()
      return
    }
    bucket.count += 1
    if (bucket.count > opts.max) {
      return c.json({ error: 'Слишком много запросов. Попробуй позже.' }, 429)
    }
    await next()
  })
}

/** Occasional cleanup so the map does not grow forever */
setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key)
  }
}, 60_000).unref?.()
