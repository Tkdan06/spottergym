import { createMiddleware } from 'hono/factory'
import { prisma } from '../db.js'
import { resolveAdminFlags, type AdminPermissions } from '../lib/admin.js'
import type { AuthedEnv } from './auth.js'

export type AdminEnv = AuthedEnv & {
  Variables: AuthedEnv['Variables'] & {
    adminPermissions: AdminPermissions
  }
}

export function requireAdminPermission(key: keyof AdminPermissions) {
  return createMiddleware<AdminEnv>(async (c, next) => {
    const userId = c.get('userId')
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return c.json({ error: 'Требуется вход' }, 401)
    const flags = resolveAdminFlags(user)
    if (!flags.isAdmin || !flags.adminPermissions[key]) {
      return c.json({ error: 'Недостаточно прав' }, 403)
    }
    c.set('adminPermissions', flags.adminPermissions)
    await next()
  })
}
