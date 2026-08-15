import type { User } from '@prisma/client'
import { prisma } from '../db.js'
import { env, isMasterAdminEmail } from '../env.js'

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

/** All admins (incl. master), optionally excluding one user. */
export async function listAdminUserIds(excludeUserId?: string): Promise<string[]> {
  const candidates = await prisma.user.findMany({
    where: {
      deletedAt: null,
      OR: [{ isAdmin: true }, { email: env.masterAdminEmail }],
    },
    select: {
      id: true,
      email: true,
      isAdmin: true,
      isMasterAdmin: true,
      adminPermissions: true,
    },
  })

  return candidates
    .filter((u) => {
      if (excludeUserId && u.id === excludeUserId) return false
      return resolveAdminFlags(u).isAdmin
    })
    .map((u) => u.id)
}

/** Admins with tickets permission (incl. master), optionally excluding the actor. */
export async function listTicketAdminIds(excludeUserId?: string): Promise<string[]> {
  const candidates = await prisma.user.findMany({
    where: {
      deletedAt: null,
      OR: [{ isAdmin: true }, { email: env.masterAdminEmail }],
    },
    select: {
      id: true,
      email: true,
      isAdmin: true,
      isMasterAdmin: true,
      adminPermissions: true,
    },
  })

  return candidates
    .filter((u) => {
      if (excludeUserId && u.id === excludeUserId) return false
      const flags = resolveAdminFlags(u)
      return flags.isAdmin && flags.adminPermissions.tickets
    })
    .map((u) => u.id)
}
