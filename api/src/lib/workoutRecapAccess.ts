import { prisma } from '../db.js'
import { resolveAdminFlags } from './admin.js'

/** Keep in sync with src/lib/workoutRecap.ts. Flip both to true to restrict recap to admins. */
export const WORKOUT_RECAP_ADMIN_ONLY = false

export async function userCanUseWorkoutRecap(userId: string) {
  if (!WORKOUT_RECAP_ADMIN_ONLY) return true
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, isAdmin: true, isMasterAdmin: true, adminPermissions: true },
  })
  return Boolean(user && resolveAdminFlags(user).isAdmin)
}
