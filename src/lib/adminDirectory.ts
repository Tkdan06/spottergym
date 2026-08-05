import { USERS } from '../data/mock'
import type { AdminDirectoryUser } from '../types'
import { isMasterAdminEmail, MASTER_ADMIN_EMAIL, MASTER_ADMIN_NAME, normalizeEmail } from './adminConfig'
import { loadJson, saveJson } from './storage'

export const STORAGE_ADMIN_DIR = 'spotter.admin.directory'
export const STORAGE_BLOCKED = 'spotter.admin.blockedEmails'

function demoEmail(id: string, name: string) {
  return `${name.toLowerCase().replace(/[^a-zа-яё0-9]/gi, '') || id}@spotter.demo`
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
  const fromMock: AdminDirectoryUser[] = USERS.map((u) => ({
    id: u.id,
    name: u.name,
    email: demoEmail(u.id, u.name),
    isAdmin: false,
    isMasterAdmin: false,
    canGrantAdmin: false,
  }))
  return [
    {
      id: 'master-bogdan',
      name: MASTER_ADMIN_NAME,
      email: MASTER_ADMIN_EMAIL,
      isAdmin: true,
      isMasterAdmin: true,
      canGrantAdmin: true,
    },
    ...fromMock,
  ]
}

export function loadDirectory(): AdminDirectoryUser[] {
  const raw = loadJson<AdminDirectoryUser[] | null>(STORAGE_ADMIN_DIR, null)
  if (!raw?.length) {
    const seeded = seedDirectory()
    saveJson(STORAGE_ADMIN_DIR, seeded)
    return seeded
  }
  // Гарантируем запись мастера
  if (!raw.some((u) => isMasterAdminEmail(u.email))) {
    const withMaster = [
      {
        id: 'master-bogdan',
        name: MASTER_ADMIN_NAME,
        email: MASTER_ADMIN_EMAIL,
        isAdmin: true,
        isMasterAdmin: true,
        canGrantAdmin: true,
      },
      ...raw,
    ]
    saveJson(STORAGE_ADMIN_DIR, withMaster)
    return withMaster
  }
  return raw.map((u) =>
    isMasterAdminEmail(u.email)
      ? { ...u, isAdmin: true, isMasterAdmin: true, canGrantAdmin: true, name: u.name || MASTER_ADMIN_NAME }
      : u,
  )
}

export function saveDirectory(users: AdminDirectoryUser[]) {
  saveJson(STORAGE_ADMIN_DIR, users)
}

export function upsertDirectoryUser(input: {
  id: string
  name: string
  email: string
  isAdmin?: boolean
  isMasterAdmin?: boolean
  canGrantAdmin?: boolean
}) {
  const email = normalizeEmail(input.email)
  const dir = loadDirectory()
  const master = isMasterAdminEmail(email)
  const idx = dir.findIndex((u) => normalizeEmail(u.email) === email || u.id === input.id)
  const base: AdminDirectoryUser = {
    id: input.id,
    name: input.name,
    email,
    isAdmin: master ? true : Boolean(input.isAdmin),
    isMasterAdmin: master,
    canGrantAdmin: master ? true : Boolean(input.canGrantAdmin),
  }
  if (idx >= 0) {
    const prev = dir[idx]
    dir[idx] = {
      ...prev,
      ...base,
      isAdmin: master ? true : input.isAdmin ?? prev.isAdmin,
      isMasterAdmin: master || prev.isMasterAdmin,
      canGrantAdmin: master ? true : input.canGrantAdmin ?? prev.canGrantAdmin,
    }
  } else {
    dir.push(base)
  }
  saveDirectory(dir)
  return dir[idx >= 0 ? idx : dir.length - 1]
}

export function getDirectoryUser(emailOrId: string) {
  const key = normalizeEmail(emailOrId)
  return loadDirectory().find((u) => normalizeEmail(u.email) === key || u.id === emailOrId)
}

export function setUserAdmin(targetId: string, isAdmin: boolean, actorCanManage: boolean) {
  if (!actorCanManage) throw new Error('Недостаточно прав')
  const dir = loadDirectory()
  const idx = dir.findIndex((u) => u.id === targetId)
  if (idx < 0) throw new Error('Пользователь не найден')
  if (dir[idx].isMasterAdmin) throw new Error('Нельзя менять права главного админа')
  dir[idx] = {
    ...dir[idx],
    isAdmin,
    canGrantAdmin: isAdmin ? dir[idx].canGrantAdmin : false,
  }
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
  dir[idx] = { ...dir[idx], canGrantAdmin: canGrant }
  saveDirectory(dir)
  return dir[idx]
}

export function adminFlagsForEmail(email: string) {
  const master = isMasterAdminEmail(email)
  const entry = getDirectoryUser(email)
  return {
    isAdmin: master || Boolean(entry?.isAdmin),
    isMasterAdmin: master || Boolean(entry?.isMasterAdmin),
    canGrantAdmin: master || Boolean(entry?.canGrantAdmin),
  }
}
