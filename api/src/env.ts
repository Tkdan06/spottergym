const WEAK_JWT_SECRETS = new Set([
  'dev-spotter-jwt-secret',
  'change-me-in-production-spotter-jwt',
  'change-me',
  'secret',
])

function required(name: string, fallback?: string) {
  const v = process.env[name] ?? fallback
  if (v === undefined || v === '') {
    throw new Error(`Missing env ${name}`)
  }
  return v
}

const isProd = process.env.NODE_ENV === 'production'
const jwtSecret = required('JWT_SECRET', isProd ? undefined : 'dev-spotter-jwt-secret')

if (isProd && (WEAK_JWT_SECRETS.has(jwtSecret) || jwtSecret.length < 32)) {
  throw new Error(
    'JWT_SECRET is missing, weak, or too short for production (min 32 chars). Set a strong secret before starting.',
  )
}

export const env = {
  isProd,
  databaseUrl: required(
    'DATABASE_URL',
    isProd ? undefined : 'postgresql://spotter:spotter@localhost:5432/spotter?schema=public',
  ),
  jwtSecret,
  port: Number(process.env.PORT || 3001),
  corsOrigins: String(process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  allowLanCors: !isProd && process.env.ALLOW_LAN_CORS !== 'false',
  /** Единственный мастер-админ */
  masterAdminEmail: String(process.env.MASTER_ADMIN_EMAIL || 'tkdan@ya.ru')
    .trim()
    .toLowerCase(),
  /** Доп. админы отключены по умолчанию — оставляем пустым */
  seedAdminEmails: String(process.env.SEED_ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  vapidPublicKey: String(process.env.VAPID_PUBLIC_KEY || '').trim(),
  vapidPrivateKey: String(process.env.VAPID_PRIVATE_KEY || '').trim(),
  vapidSubject: String(process.env.VAPID_SUBJECT || 'mailto:tkdan@ya.ru').trim(),
  /** Sendsay account login (for API URL path) */
  sendsayLogin: String(process.env.SENDSAY_LOGIN || '').trim(),
  sendsayApiKey: String(process.env.SENDSAY_APIKEY || '').trim(),
  sendsayFromEmail: String(process.env.SENDSAY_FROM_EMAIL || 'noreply@spottergym.ru').trim(),
  sendsayFromName: String(process.env.SENDSAY_FROM_NAME || 'Spotter').trim(),
  /** Public web origin for reset links */
  appPublicUrl: String(process.env.APP_PUBLIC_URL || 'http://localhost:5173')
    .trim()
    .replace(/\/$/, ''),
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function isMasterAdminEmail(email: string) {
  return normalizeEmail(email) === env.masterAdminEmail
}

/** @deprecated seed admins disabled — always false unless SEED_ADMIN_EMAILS set */
export function isSeedAdminEmail(email: string) {
  return env.seedAdminEmails.includes(normalizeEmail(email))
}
