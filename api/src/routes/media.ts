import { readFile, stat } from 'node:fs/promises'
import { Hono } from 'hono'
import { resolveMediaFile } from '../lib/mediaStore.js'
import { rateLimit } from '../middleware/rateLimit.js'

export const mediaRoutes = new Hono()

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

mediaRoutes.get(
  '/:userId/:file',
  rateLimit({ windowMs: 60_000, max: 240, route: 'media-get' }),
  async (c) => {
    const userId = c.req.param('userId')
    const file = c.req.param('file')
    const full = resolveMediaFile(userId, file)
    if (!full) return c.json({ error: 'Не найдено' }, 404)

    try {
      const st = await stat(full)
      if (!st.isFile()) return c.json({ error: 'Не найдено' }, 404)
    } catch {
      return c.json({ error: 'Не найдено' }, 404)
    }

    const ext = file.split('.').pop()?.toLowerCase() || 'jpg'
    const type = MIME[ext] || 'application/octet-stream'
    const buf = await readFile(full)
    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': type,
        'Cache-Control': 'public, max-age=604800, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  },
)
