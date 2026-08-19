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

/** Magic-byte sniff for extensionless media files (and mislabeled legacy). */
function sniffImageMime(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return 'image/png'
  }
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp'
  }
  return null
}

function contentTypeFor(file: string, buf: Buffer): string {
  const sniffed = sniffImageMime(buf)
  if (sniffed) return sniffed
  const ext = file.includes('.') ? file.split('.').pop()?.toLowerCase() || '' : ''
  return MIME[ext] || 'application/octet-stream'
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

    const buf = await readFile(full)
    const type = contentTypeFor(file, buf)
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
