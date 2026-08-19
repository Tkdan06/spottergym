import { createHash, randomUUID } from 'node:crypto'
import { mkdir, writeFile, unlink } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
/**
 * api/data/media — outside src, persisted on disk (Docker: /app/data/media).
 * Override with MEDIA_ROOT if the process cwd/layout differs.
 */
export const MEDIA_ROOT =
  process.env.MEDIA_ROOT?.trim() || path.resolve(__dirname, '../../data/media')

const DATA_URL_RE =
  /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/i

/**
 * Public media URLs must NOT end with .jpg/.png — nginx `location ~* \.(jpg|…)$`
 * otherwise steals them from the API proxy and returns a static 404 (gender stub in UI).
 * Legacy paths with extensions are still accepted for existing DB rows.
 */
export function isMediaPath(value: string) {
  return /^\/api\/media\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+$/.test(value)
}

/** Persist a data-URL photo; returns public `/api/media/...` path (no file extension). */
export async function storePhotoDataUrl(userId: string, dataUrl: string): Promise<string> {
  const match = DATA_URL_RE.exec(dataUrl.trim())
  if (!match) throw new Error('bad_photo')
  const buf = Buffer.from(match[2].replace(/\s/g, ''), 'base64')
  if (buf.length < 32 || buf.length > 3_500_000) throw new Error('bad_photo_size')

  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'user'
  const hash = createHash('sha256').update(buf).digest('hex').slice(0, 16)
  // No extension in the public URL / on-disk name — see isMediaPath note above
  const name = `${randomUUID().slice(0, 8)}_${hash}`
  const dir = path.join(MEDIA_ROOT, safeUser)
  await mkdir(dir, { recursive: true })
  const filePath = path.join(dir, name)
  await writeFile(filePath, buf)
  return `/api/media/${safeUser}/${name}`
}

function mediaOwnerPrefix(userId: string) {
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'user'
  return `/api/media/${safeUser}/`
}

/** Convert profile photo list: keep own media paths, persist new data URLs. */
export async function persistPhotoList(userId: string, photos: string[]): Promise<string[]> {
  const prefix = mediaOwnerPrefix(userId)
  const out: string[] = []
  for (const p of photos) {
    const value = String(p || '').trim()
    if (!value) continue
    if (isMediaPath(value)) {
      // Reject cross-user media URL reuse
      if (!value.startsWith(prefix)) throw new Error('bad_photo_owner')
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

/** Delete media paths that dropped out of the new list (same owner only). */
export async function deleteRemovedMedia(userId: string, prev: string[], next: string[]) {
  const prefix = mediaOwnerPrefix(userId)
  const kept = new Set(next.filter((p) => isMediaPath(p)))
  for (const old of prev) {
    if (!isMediaPath(old) || !old.startsWith(prefix)) continue
    if (kept.has(old)) continue
    await tryDeleteMediaPath(old)
  }
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
