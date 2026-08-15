import { createMiddleware } from 'hono/factory'

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()
const MAX_BUCKETS = 20_000

function clientKey(ip: string, route: string) {
  return `${route}:${ip}`
}

/**
 * Client IP: prefer nginx X-Real-IP (set from $remote_addr).
 * Do NOT trust the leftmost X-Forwarded-For (client-spoofable).
 */
export function clientIp(c: { req: { header: (name: string) => string | undefined } }) {
  const real = c.req.header('x-real-ip')?.trim()
  if (real) return real.slice(0, 64)

  const xf = c.req.header('x-forwarded-for')
  if (xf) {
    // Rightmost hop is typically the one added by the trusted proxy
    const parts = xf.split(',').map((p) => p.trim()).filter(Boolean)
    const last = parts[parts.length - 1]
    if (last) return last.slice(0, 64)
  }
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
