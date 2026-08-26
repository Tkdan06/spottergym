import { createHash } from 'node:crypto'

type Entry = { hash: string; workoutId: string; at: number }

const TTL_MS = 10 * 60 * 1000
const MAX = 4000
const store = new Map<string, Entry>()

function prune(now: number) {
  for (const [k, v] of store) {
    if (now - v.at >= TTL_MS) store.delete(k)
  }
}

export function parseIdempotencyKey(raw: string | undefined | null): string {
  const t = String(raw || '').trim()
  if (!t || t.length > 128) return ''
  if (!/^[\w.-]+$/.test(t)) return ''
  return t
}

export function payloadHash(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(body)).digest('hex')
}

export function rememberIdempotentWorkout(
  userId: string,
  key: string,
  hash: string,
  workoutId: string,
) {
  if (store.size >= MAX) prune(Date.now())
  store.set(`${userId}:${key}`, { hash, workoutId, at: Date.now() })
}

export function lookupIdempotentWorkout(
  userId: string,
  key: string,
  hash: string,
): { status: 'miss' } | { status: 'hit'; workoutId: string } | { status: 'conflict' } {
  prune(Date.now())
  const row = store.get(`${userId}:${key}`)
  if (!row) return { status: 'miss' }
  if (row.hash !== hash) return { status: 'conflict' }
  return { status: 'hit', workoutId: row.workoutId }
}
