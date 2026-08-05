/** Главный и единственный админ Spotter */
export const MASTER_ADMIN_EMAIL = 'tkdan@ya.ru'
export const MASTER_ADMIN_NAME = 'Bogdan'

/** Доп. админы отключены */
export const SEED_ADMIN_EMAILS: readonly string[] = []

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function isMasterAdminEmail(email: string) {
  return normalizeEmail(email) === MASTER_ADMIN_EMAIL
}

export function isSeedAdminEmail(_email: string) {
  return false
}
