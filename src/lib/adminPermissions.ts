import type { AdminPermissions, AdminPermissionKey } from '../types'

export const ADMIN_PERMISSION_KEYS: AdminPermissionKey[] = [
  'tickets',
  'messageUsers',
  'viewUsers',
  'blockUsers',
  'removeUsers',
  'manageAdmins',
]

export const ADMIN_PERMISSION_LABELS: Record<
  AdminPermissionKey,
  { title: string; hint: string }
> = {
  tickets: {
    title: 'Обращения',
    hint: 'Отвечать на тикеты и менять их статус',
  },
  messageUsers: {
    title: 'Писать пользователям',
    hint: 'Исходящие сообщения из админки',
  },
  viewUsers: {
    title: 'Пользователи и статистика',
    hint: 'Смотреть реестр, города, залы, память',
  },
  blockUsers: {
    title: 'Блокировка',
    hint: 'Блокировать и разблокировать email',
  },
  removeUsers: {
    title: 'Удаление',
    hint: 'Удалять аккаунт пользователя с устройства',
  },
  manageAdmins: {
    title: 'Управление админами',
    hint: 'Назначать админов и менять их права',
  },
}

/** Ограниченные права: поддержка */
export const SUPPORT_PERMISSIONS: AdminPermissions = {
  tickets: true,
  messageUsers: true,
  viewUsers: true,
  blockUsers: false,
  removeUsers: false,
  manageAdmins: false,
}

/** Модератор: поддержка + блокировки */
export const MODERATOR_PERMISSIONS: AdminPermissions = {
  ...SUPPORT_PERMISSIONS,
  blockUsers: true,
}

/** Полные права (кроме «главного» — он всегда выше) */
export const FULL_PERMISSIONS: AdminPermissions = {
  tickets: true,
  messageUsers: true,
  viewUsers: true,
  blockUsers: true,
  removeUsers: true,
  manageAdmins: true,
}

export const EMPTY_PERMISSIONS: AdminPermissions = {
  tickets: false,
  messageUsers: false,
  viewUsers: false,
  blockUsers: false,
  removeUsers: false,
  manageAdmins: false,
}

export type AdminPermissionPreset = 'support' | 'moderator' | 'full'

export const ADMIN_PRESETS: {
  id: AdminPermissionPreset
  title: string
  hint: string
  permissions: AdminPermissions
}[] = [
  {
    id: 'support',
    title: 'Поддержка',
    hint: 'Тикеты, переписка, просмотр пользователей',
    permissions: SUPPORT_PERMISSIONS,
  },
  {
    id: 'moderator',
    title: 'Модератор',
    hint: 'Поддержка + блокировка',
    permissions: MODERATOR_PERMISSIONS,
  },
  {
    id: 'full',
    title: 'Полные права',
    hint: 'Всё, включая удаление и назначение админов',
    permissions: FULL_PERMISSIONS,
  },
]

export function normalizeAdminPermissions(
  raw: Partial<AdminPermissions> | null | undefined,
  options?: { isAdmin?: boolean; isMasterAdmin?: boolean; canGrantAdmin?: boolean },
): AdminPermissions {
  if (options?.isMasterAdmin) return { ...FULL_PERMISSIONS }

  if (!options?.isAdmin) return { ...EMPTY_PERMISSIONS }

  const base = { ...SUPPORT_PERMISSIONS }
  if (raw && typeof raw === 'object') {
    for (const key of ADMIN_PERMISSION_KEYS) {
      if (typeof raw[key] === 'boolean') base[key] = raw[key]
    }
  }

  // Legacy: canGrantAdmin → manageAdmins
  if (options.canGrantAdmin) base.manageAdmins = true

  return base
}

export function permissionsMatchPreset(perms: AdminPermissions): AdminPermissionPreset | 'custom' {
  const same = (a: AdminPermissions, b: AdminPermissions) =>
    ADMIN_PERMISSION_KEYS.every((k) => a[k] === b[k])
  if (same(perms, FULL_PERMISSIONS)) return 'full'
  if (same(perms, MODERATOR_PERMISSIONS)) return 'moderator'
  if (same(perms, SUPPORT_PERMISSIONS)) return 'support'
  return 'custom'
}

export function permissionSummary(perms: AdminPermissions, isMaster = false) {
  if (isMaster) return 'Главный · полные права'
  const preset = permissionsMatchPreset(perms)
  if (preset === 'full') return 'Полные права'
  if (preset === 'moderator') return 'Модератор'
  if (preset === 'support') return 'Поддержка'
  const on = ADMIN_PERMISSION_KEYS.filter((k) => perms[k]).map(
    (k) => ADMIN_PERMISSION_LABELS[k].title,
  )
  return on.length ? on.join(' · ') : 'Без прав'
}

export function hasAdminPermission(
  user: {
    isAdmin?: boolean
    isMasterAdmin?: boolean
    adminPermissions?: AdminPermissions | null
  } | null,
  key: AdminPermissionKey,
) {
  if (!user?.isAdmin && !user?.isMasterAdmin) return false
  if (user.isMasterAdmin) return true
  const perms = normalizeAdminPermissions(user.adminPermissions, {
    isAdmin: true,
    isMasterAdmin: false,
  })
  return Boolean(perms[key])
}
