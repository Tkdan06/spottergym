/** Display name for master admin UI (identity is server-side only via isMasterAdmin). */
export const MASTER_ADMIN_NAME = 'Bogdan'

/** Доп. админы отключены */
export const SEED_ADMIN_EMAILS: readonly string[] = []

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function isSeedAdminEmail(_email: string) {
  return false
}
