import { createHash, randomUUID } from 'node:crypto'
import { mkdir, writeFile, unlink } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
/** api/data/media — outside src, persisted on disk */
export const MEDIA_ROOT = path.resolve(__dirname, '../../data/media')

const DATA_URL_RE =
  /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/i

export function isMediaPath(value: string) {
  return /^\/api\/media\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+$/.test(value)
}

function extForMime(mime: string) {
  const m = mime.toLowerCase()
  if (m === 'png') return 'png'
  if (m === 'webp') return 'webp'
  return 'jpg'
}

/** Persist a data-URL photo; returns public `/api/media/...` path. */
export async function storePhotoDataUrl(userId: string, dataUrl: string): Promise<string> {
  const match = DATA_URL_RE.exec(dataUrl.trim())
  if (!match) throw new Error('bad_photo')
  const ext = extForMime(match[1])
  const buf = Buffer.from(match[2].replace(/\s/g, ''), 'base64')
  if (buf.length < 32 || buf.length > 3_500_000) throw new Error('bad_photo_size')

  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'user'
  const hash = createHash('sha256').update(buf).digest('hex').slice(0, 16)
  const name = `${randomUUID().slice(0, 8)}_${hash}.${ext}`
  const dir = path.join(MEDIA_ROOT, safeUser)
  await mkdir(dir, { recursive: true })
  const filePath = path.join(dir, name)
  await writeFile(filePath, buf)
  return `/api/media/${safeUser}/${name}`
}

/** Convert profile photo list: keep media paths, persist new data URLs. */
export async function persistPhotoList(userId: string, photos: string[]): Promise<string[]> {
  const out: string[] = []
  for (const p of photos) {
    const value = String(p || '').trim()
    if (!value) continue
    if (isMediaPath(value)) {
      out.push(value)
      continue
    }
    if (DATA_URL_RE.test(value)) {
      out.push(await storePhotoDataUrl(userId, value))
      continue
    }
    throw new Error('bad_photo')
  }
  return out
}

export async function persistAvatar(userId: string, avatar: string): Promise<string> {
  const value = String(avatar || '').trim()
  if (!value) return ''
  if (isMediaPath(value)) return value
  if (DATA_URL_RE.test(value)) return storePhotoDataUrl(userId, value)
  throw new Error('bad_avatar')
}

export function resolveMediaFile(userSeg: string, fileSeg: string): string | null {
  if (!/^[a-zA-Z0-9_-]+$/.test(userSeg)) return null
  if (!/^[a-zA-Z0-9._-]+$/.test(fileSeg)) return null
  if (fileSeg.includes('..')) return null
  return path.join(MEDIA_ROOT, userSeg, fileSeg)
}

export async function tryDeleteMediaPath(mediaUrl: string) {
  if (!isMediaPath(mediaUrl)) return
  const parts = mediaUrl.split('/')
  // /api/media/:user/:file
  const userSeg = parts[3]
  const fileSeg = parts[4]
  const full = resolveMediaFile(userSeg, fileSeg)
  if (!full) return
  await unlink(full).catch(() => undefined)
}
