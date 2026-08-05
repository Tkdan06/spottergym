import { normalizeEmail } from './adminConfig'

/** Единственный тестовый аккаунт с демо-перепиской, лайками и людьми в зале */
export const DEMO_ACCOUNT_EMAIL = 'demo@demo.ru'
export const DEMO_ACCOUNT_NAME = 'Алекс'

export function isDemoAccount(email: string | null | undefined) {
  if (!email) return false
  return normalizeEmail(email) === DEMO_ACCOUNT_EMAIL
}
