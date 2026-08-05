/** Главный админ Spotter — Богдан */
export const MASTER_ADMIN_EMAIL = 'tkdan@ua.ru'
export const MASTER_ADMIN_NAME = 'Bogdan'

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function isMasterAdminEmail(email: string) {
  return normalizeEmail(email) === MASTER_ADMIN_EMAIL
}
