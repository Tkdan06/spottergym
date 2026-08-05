import type { User } from '@prisma/client'
import { isMasterAdminEmail } from '../env.js'

export type AdminPermissions = {
  tickets: boolean
  messageUsers: boolean
  viewUsers: boolean
  blockUsers: boolean
  removeUsers: boolean
  manageAdmins: boolean
}

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

/**
 * Master email always full admin.
 * Other users: only if isAdmin in DB (granted by master).
 */
export function resolveAdminFlags(
  user: Pick<User, 'email' | 'isAdmin' | 'isMasterAdmin' | 'adminPermissions'>,
) {
  const master = isMasterAdminEmail(user.email)
  if (master) {
    return {
      isAdmin: true,
      isMasterAdmin: true,
      canGrantAdmin: true,
      adminPermissions: { ...FULL_PERMISSIONS },
    }
  }

  const stored =
    user.adminPermissions && typeof user.adminPermissions === 'object'
      ? (user.adminPermissions as AdminPermissions)
      : null

  const isAdmin = Boolean(user.isAdmin)
  const adminPermissions: AdminPermissions = isAdmin
    ? {
        tickets: Boolean(stored?.tickets),
        messageUsers: Boolean(stored?.messageUsers),
        viewUsers: Boolean(stored?.viewUsers),
        blockUsers: Boolean(stored?.blockUsers),
        removeUsers: Boolean(stored?.removeUsers),
        manageAdmins: Boolean(stored?.manageAdmins),
      }
    : { ...EMPTY_PERMISSIONS }

  return {
    isAdmin,
    isMasterAdmin: false,
    canGrantAdmin: adminPermissions.manageAdmins,
    adminPermissions,
  }
}
