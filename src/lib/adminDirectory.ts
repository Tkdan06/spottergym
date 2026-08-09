import type { AdminDirectoryUser, AdminPermissions, AppUser, Gender } from '../types'
import {
  isSeedAdminEmail,
  MASTER_ADMIN_NAME,
  normalizeEmail,
  SEED_ADMIN_EMAILS,
} from './adminConfig'
import {
  FULL_PERMISSIONS,
  normalizeAdminPermissions,
  SUPPORT_PERMISSIONS,
} from './adminPermissions'
import { loadJson, saveJson } from './storage'

export const STORAGE_ADMIN_DIR = 'spotter.admin.directory'
export const STORAGE_BLOCKED = 'spotter.admin.blockedEmails'
export const ACCOUNT_KEY_PREFIX = 'spotter.account:'

export function utf8ByteLength(value: string) {
  try {
    return new TextEncoder().encode(value).length
  } catch {
    return value.length
  }
}

export function estimatePhotosBytes(photos: string[] | undefined | null) {
  if (!Array.isArray(photos) || !photos.length) return 0
  return photos.reduce((sum, p) => sum + (typeof p === 'string' ? utf8ByteLength(p) : 0), 0)
}

function seedAdminEntries(): AdminDirectoryUser[] {
  return SEED_ADMIN_EMAILS.map((email, i) => ({
    id: `seed-admin-${i + 1}`,
    name: email.split('@')[0] || 'Admin',
    email,
    isAdmin: true,
    isMasterAdmin: false,
    canGrantAdmin: true,
    adminPermissions: { ...FULL_PERMISSIONS },
    isDemoSeed: false,
    registeredAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
  }))
}

function withNormalizedPermissions(entry: AdminDirectoryUser): AdminDirectoryUser {
  const adminPermissions = normalizeAdminPermissions(entry.adminPermissions, {
    isAdmin: entry.isAdmin,
    isMasterAdmin: entry.isMasterAdmin,
    canGrantAdmin: entry.canGrantAdmin,
  })
  return {
    ...entry,
    adminPermissions,
    canGrantAdmin: adminPermissions.manageAdmins,
  }
}

export function loadBlockedEmails(): string[] {
  const raw = loadJson<string[]>(STORAGE_BLOCKED, [])
  return [...new Set(raw.map(normalizeEmail).filter(Boolean))]
}

export function saveBlockedEmails(emails: string[]) {
  saveJson(STORAGE_BLOCKED, [...new Set(emails.map(normalizeEmail))])
}

export function isEmailBlocked(email: string) {
  return loadBlockedEmails().includes(normalizeEmail(email))
}

export function blockEmail(email: string) {
  const next = [...loadBlockedEmails(), normalizeEmail(email)]
  saveBlockedEmails(next)
  return next
}

export function unblockEmail(email: string) {
  const next = loadBlockedEmails().filter((e) => e !== normalizeEmail(email))
  saveBlockedEmails(next)
  return next
}

function seedDirectory(): AdminDirectoryUser[] {
  // Master identity comes from API isMasterAdmin — never hardcode email in the client.
  return [...seedAdminEntries()]
}

function ensureSeedAdmins(dir: AdminDirectoryUser[]): AdminDirectoryUser[] {
  let next = [...dir]
  let changed = false

  for (const seed of seedAdminEntries()) {
    const idx = next.findIndex((u) => normalizeEmail(u.email) === seed.email)
    if (idx < 0) {
      next = [seed, ...next]
      changed = true
      continue
    }
    if (!next[idx].isAdmin) {
      next[idx] = { ...next[idx], isAdmin: true }
      changed = true
    }
  }

  if (changed) saveDirectory(next)
  return next
}

export function loadDirectory(): AdminDirectoryUser[] {
  const raw = loadJson<AdminDirectoryUser[] | null>(STORAGE_ADMIN_DIR, null)
  if (!raw?.length) {
    const seeded = seedDirectory()
    saveJson(STORAGE_ADMIN_DIR, seeded)
    return seeded
  }
  // Drop legacy client-seeded master row (hardcoded email was shipped in old builds).
  let dir = raw.filter((u) => u.id !== 'master-bogdan')
  if (dir.length !== raw.length) saveJson(STORAGE_ADMIN_DIR, dir)
  dir = dir.map((u) =>
    withNormalizedPermissions(
      u.isMasterAdmin
        ? {
            ...u,
            isAdmin: true,
            isMasterAdmin: true,
            canGrantAdmin: true,
            adminPermissions: { ...FULL_PERMISSIONS },
            name: u.name || MASTER_ADMIN_NAME,
            isDemoSeed: false,
          }
        : u,
    ),
  )
  // Старые демо-сиды из прошлых билдов — убрать из админки
  const withoutFloorSeeds = dir.filter((u) => !u.isDemoSeed)
  if (withoutFloorSeeds.length !== dir.length) {
    saveDirectory(withoutFloorSeeds)
    dir = withoutFloorSeeds
  }
  return ensureSeedAdmins(dir).map(withNormalizedPermissions)
}

export function saveDirectory(users: AdminDirectoryUser[]) {
  saveJson(STORAGE_ADMIN_DIR, users)
}

export type DirectoryUpsertInput = {
  id: string
  name: string
  email: string
  isAdmin?: boolean
  isMasterAdmin?: boolean
  canGrantAdmin?: boolean
  adminPermissions?: AdminPermissions
  age?: number
  gender?: Gender
  city?: string
  homeGymId?: string
  gymIds?: string[]
  intent?: AdminDirectoryUser['intent']
  experienceLevel?: AdminDirectoryUser['experienceLevel']
  isCoach?: boolean
  onboardingDone?: boolean
  isActive?: boolean
  checkedInGymId?: string
  photosCount?: number
  photosBytes?: number
  registeredAt?: string
  lastSeenAt?: string
  isDemoSeed?: boolean
}

export function upsertDirectoryUser(input: DirectoryUpsertInput) {
  const email = normalizeEmail(input.email)
  const dir = loadDirectory()
  const idx = dir.findIndex((u) => normalizeEmail(u.email) === email || u.id === input.id)
  const master = Boolean(input.isMasterAdmin || (idx >= 0 && dir[idx].isMasterAdmin))
  const seedAdmin = isSeedAdminEmail(email)

  const isAdmin = master || seedAdmin ? true : Boolean(input.isAdmin)
  const adminPermissions = normalizeAdminPermissions(
    input.adminPermissions ?? (idx >= 0 ? dir[idx].adminPermissions : undefined),
    {
      isAdmin: master || seedAdmin || isAdmin || (idx >= 0 ? dir[idx].isAdmin : false),
      isMasterAdmin: master,
      canGrantAdmin: master
        ? true
        : input.canGrantAdmin ?? (idx >= 0 ? dir[idx].canGrantAdmin : false),
    },
  )

  const snapshot: Partial<AdminDirectoryUser> = {
    age: input.age,
    gender: input.gender,
    city: input.city,
    homeGymId: input.homeGymId,
    gymIds: input.gymIds,
    intent: input.intent,
    experienceLevel: input.experienceLevel,
    isCoach: input.isCoach,
    onboardingDone: input.onboardingDone,
    isActive: input.isActive,
    checkedInGymId: input.checkedInGymId,
    photosCount: input.photosCount,
    photosBytes: input.photosBytes,
    registeredAt: input.registeredAt,
    lastSeenAt: input.lastSeenAt,
    isDemoSeed: input.isDemoSeed,
  }

  const cleanSnapshot = Object.fromEntries(
    Object.entries(snapshot).filter(([, v]) => v !== undefined),
  ) as Partial<AdminDirectoryUser>

  if (idx >= 0) {
    const prev = dir[idx]
    const nextAdmin =
      master || seedAdmin ? true : input.isAdmin !== undefined ? input.isAdmin : prev.isAdmin
    const nextPerms =
      input.adminPermissions !== undefined
        ? normalizeAdminPermissions(input.adminPermissions, {
            isAdmin: nextAdmin,
            isMasterAdmin: master,
            canGrantAdmin: input.canGrantAdmin ?? adminPermissions.manageAdmins,
          })
        : normalizeAdminPermissions(prev.adminPermissions, {
            isAdmin: nextAdmin,
            isMasterAdmin: master,
            canGrantAdmin: input.canGrantAdmin ?? prev.canGrantAdmin,
          })
    dir[idx] = withNormalizedPermissions({
      ...prev,
      id: input.id || prev.id,
      name: input.name || prev.name,
      email,
      isAdmin: nextAdmin,
      isMasterAdmin: master || prev.isMasterAdmin,
      canGrantAdmin: nextPerms.manageAdmins,
      adminPermissions: nextPerms,
      ...cleanSnapshot,
      registeredAt: cleanSnapshot.registeredAt || prev.registeredAt,
      isDemoSeed: cleanSnapshot.isDemoSeed ?? prev.isDemoSeed ?? false,
    })
  } else {
    dir.push(
      withNormalizedPermissions({
        id: input.id,
        name: input.name,
        email,
        isAdmin: master || seedAdmin || isAdmin,
        isMasterAdmin: master,
        canGrantAdmin: adminPermissions.manageAdmins,
        adminPermissions,
        ...cleanSnapshot,
        registeredAt: cleanSnapshot.registeredAt || new Date().toISOString(),
        isDemoSeed: cleanSnapshot.isDemoSeed ?? false,
      }),
    )
  }
  saveDirectory(dir)
  return dir[idx >= 0 ? idx : dir.length - 1]
}

/** Синхронизировать снимок живого AppUser в директорию админки */
export function syncDirectoryFromAppUser(user: AppUser) {
  const photos = Array.isArray(user.photos) ? user.photos : []
  return upsertDirectoryUser({
    id: user.id,
    name: user.name,
    email: user.email,
    isAdmin: user.isAdmin,
    isMasterAdmin: user.isMasterAdmin,
    canGrantAdmin: user.adminPermissions?.manageAdmins ?? user.canGrantAdmin,
    adminPermissions: user.adminPermissions,
    age: user.age,
    gender: user.gender,
    city: user.city,
    homeGymId: user.homeGymId,
    gymIds: [...(user.gymIds || [])],
    intent: user.intent,
    experienceLevel: user.experienceLevel,
    isCoach: user.isCoach,
    onboardingDone: user.onboardingDone,
    isActive: user.isActive,
    checkedInGymId: user.checkedInGymId,
    photosCount: photos.length,
    photosBytes: estimatePhotosBytes(photos),
    registeredAt: user.registeredAt || user.lastSeenAt || new Date().toISOString(),
    lastSeenAt: user.lastSeenAt,
    isDemoSeed: false,
  })
}

export function getDirectoryUser(emailOrId: string) {
  const key = normalizeEmail(emailOrId)
  return loadDirectory().find((u) => normalizeEmail(u.email) === key || u.id === emailOrId)
}

export function setUserAdmin(
  targetId: string,
  isAdmin: boolean,
  actorCanManage: boolean,
  permissions: AdminPermissions = SUPPORT_PERMISSIONS,
) {
  if (!actorCanManage) throw new Error('Недостаточно прав')
  const dir = loadDirectory()
  const idx = dir.findIndex((u) => u.id === targetId)
  if (idx < 0) throw new Error('Пользователь не найден')
  if (dir[idx].isMasterAdmin) throw new Error('Нельзя менять права главного админа')
  const nextPerms = isAdmin
    ? normalizeAdminPermissions(permissions, { isAdmin: true })
    : normalizeAdminPermissions(null, { isAdmin: false })
  dir[idx] = withNormalizedPermissions({
    ...dir[idx],
    isAdmin,
    canGrantAdmin: nextPerms.manageAdmins,
    adminPermissions: nextPerms,
  })
  saveDirectory(dir)
  return dir[idx]
}

export function setAdminPermissions(
  targetId: string,
  permissions: AdminPermissions,
  actorCanManage: boolean,
) {
  if (!actorCanManage) throw new Error('Недостаточно прав')
  const dir = loadDirectory()
  const idx = dir.findIndex((u) => u.id === targetId)
  if (idx < 0) throw new Error('Пользователь не найден')
  if (dir[idx].isMasterAdmin) throw new Error('Нельзя менять права главного админа')
  if (!dir[idx].isAdmin) throw new Error('Сначала назначь админом')
  const nextPerms = normalizeAdminPermissions(permissions, { isAdmin: true })
  // Нельзя выдать manageAdmins, если сам актор не master — проверяет вызывающий
  dir[idx] = withNormalizedPermissions({
    ...dir[idx],
    isAdmin: true,
    canGrantAdmin: nextPerms.manageAdmins,
    adminPermissions: nextPerms,
  })
  saveDirectory(dir)
  return dir[idx]
}

export function setCanGrantAdmin(targetId: string, canGrant: boolean, actorIsMaster: boolean) {
  if (!actorIsMaster) throw new Error('Только главный админ')
  const dir = loadDirectory()
  const idx = dir.findIndex((u) => u.id === targetId)
  if (idx < 0) throw new Error('Пользователь не найден')
  if (dir[idx].isMasterAdmin) throw new Error('Нельзя менять права главного админа')
  if (!dir[idx].isAdmin) throw new Error('Сначала назначь админом')
  const prev = normalizeAdminPermissions(dir[idx].adminPermissions, {
    isAdmin: true,
    canGrantAdmin: dir[idx].canGrantAdmin,
  })
  const nextPerms = { ...prev, manageAdmins: canGrant }
  dir[idx] = withNormalizedPermissions({
    ...dir[idx],
    canGrantAdmin: canGrant,
    adminPermissions: nextPerms,
  })
  saveDirectory(dir)
  return dir[idx]
}

export function adminFlagsForEmail(_email: string) {
  // Admin flags come from the API (isMasterAdmin / isAdmin). No email allowlist in the client.
  const adminPermissions = normalizeAdminPermissions(undefined, {
    isAdmin: false,
    isMasterAdmin: false,
    canGrantAdmin: false,
  })
  return {
    isAdmin: false,
    isMasterAdmin: false,
    canGrantAdmin: false,
    adminPermissions,
  }
}

function isMasterInDirectory(email: string) {
  const key = normalizeEmail(email)
  return loadDirectory().some(
    (u) => u.isMasterAdmin && normalizeEmail(u.email) === key,
  )
}

/** Удалить аккаунт пользователя с этого устройства + запись в директории */
export function removeUserAccount(email: string, options?: { alsoBlock?: boolean }) {
  const key = normalizeEmail(email)
  if (!key) throw new Error('Пустой email')
  if (isMasterInDirectory(key)) throw new Error('Нельзя удалить главного админа')

  const prefixes = [
    `spotter.account:${key}`,
    `spotter.auth:${key}`,
    `spotter.conversations:${key}`,
    `spotter.messages:${key}`,
    `spotter.likes:${key}`,
    `spotter.notifications:${key}`,
    `spotter.notificationPrefs:${key}`,
  ]
  for (const storageKey of prefixes) {
    try {
      localStorage.removeItem(storageKey)
    } catch {
      /* ignore */
    }
  }

  const dir = loadDirectory().filter((u) => normalizeEmail(u.email) !== key)
  saveDirectory(dir)

  if (options?.alsoBlock) {
    blockEmail(key)
  }

  return { email: key, blocked: Boolean(options?.alsoBlock) }
}

/** Все ключи профилей в localStorage этого браузера */
export function listStoredAccountEmails(): string[] {
  const emails: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key?.startsWith(ACCOUNT_KEY_PREFIX)) {
        emails.push(key.slice(ACCOUNT_KEY_PREFIX.length))
      }
    }
  } catch {
    /* ignore */
  }
  return emails
}

export function loadStoredAccountProfile(email: string): AppUser | null {
  const raw = loadJson<AppUser | null>(`${ACCOUNT_KEY_PREFIX}${normalizeEmail(email)}`, null)
  return raw && typeof raw === 'object' && raw.email ? raw : null
}

/**
 * Подтянуть в директорию аккаунты из localStorage, которых ещё нет в списке.
 * Возвращает обновлённый список.
 */
export function mergeStoredAccountsIntoDirectory(): AdminDirectoryUser[] {
  for (const email of listStoredAccountEmails()) {
    const profile = loadStoredAccountProfile(email)
    if (!profile) continue
    syncDirectoryFromAppUser({
      ...profile,
      email: normalizeEmail(profile.email || email),
      registeredAt:
        profile.registeredAt || profile.lastSeenAt || new Date().toISOString(),
    } as AppUser)
  }
  return loadDirectory()
}
