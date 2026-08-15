import { prisma } from '../db.js'

export const EMERGENCY_SETTING_KEY = 'emergency_shutdown'

type Cache = { active: boolean; at: number }

let cache: Cache | null = null
const CACHE_MS = 2_000

export async function isEmergencyShutdown(): Promise<boolean> {
  const now = Date.now()
  if (cache && now - cache.at < CACHE_MS) return cache.active
  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key: EMERGENCY_SETTING_KEY },
      select: { value: true },
    })
    const active = row?.value === '1'
    cache = { active, at: now }
    return active
  } catch (err) {
    console.warn('[emergency] status check failed', err)
    return cache?.active ?? false
  }
}

export async function enableEmergencyShutdown(actorId: string) {
  await prisma.systemSetting.upsert({
    where: { key: EMERGENCY_SETTING_KEY },
    create: {
      key: EMERGENCY_SETTING_KEY,
      value: '1',
      updatedById: actorId,
    },
    update: {
      value: '1',
      updatedById: actorId,
    },
  })
  cache = { active: true, at: Date.now() }
  console.error(`[emergency] SHUTDOWN enabled by ${actorId}`)
}

export async function disableEmergencyShutdown(actorId?: string) {
  await prisma.systemSetting.upsert({
    where: { key: EMERGENCY_SETTING_KEY },
    create: {
      key: EMERGENCY_SETTING_KEY,
      value: '0',
      updatedById: actorId || null,
    },
    update: {
      value: '0',
      updatedById: actorId || null,
    },
  })
  cache = { active: false, at: Date.now() }
  console.error(`[emergency] SHUTDOWN cleared${actorId ? ` by ${actorId}` : ''}`)
}

/** Schedule process exit so the HTTP response can flush first. */
export function scheduleProcessShutdown(delayMs = 400) {
  setTimeout(() => {
    console.error('[emergency] process exiting')
    process.exit(0)
  }, delayMs).unref?.()
}
