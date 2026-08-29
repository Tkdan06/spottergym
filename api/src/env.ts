import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Fill process.env from api/.env if the process was started without --env-file. */
function loadLocalEnv() {
  const path = fileURLToPath(new URL('../.env', import.meta.url))
  if (!existsSync(path)) return
  let text = ''
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    return
  }
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 1) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

loadLocalEnv()

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

if (isProd && !String(process.env.MASTER_ADMIN_EMAIL || '').trim()) {
  throw new Error('MASTER_ADMIN_EMAIL must be set in production')
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
  /** Единственный мастер-админ (email only on server — never ship to the client) */
  masterAdminEmail: String(
    process.env.MASTER_ADMIN_EMAIL || (isProd ? '' : 'admin@localhost'),
  )
    .trim()
    .toLowerCase(),
  /** Доп. админы отключены по умолчанию — оставляем пустым */
  seedAdminEmails: String(process.env.SEED_ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  vapidPublicKey: String(process.env.VAPID_PUBLIC_KEY || '').trim(),
  vapidPrivateKey: String(process.env.VAPID_PRIVATE_KEY || '').trim(),
  vapidSubject: String(process.env.VAPID_SUBJECT || 'mailto:noreply@spottergym.ru').trim(),
  /** Sendsay account login (for API URL path) */
  sendsayLogin: String(process.env.SENDSAY_LOGIN || '').trim(),
  sendsayApiKey: String(process.env.SENDSAY_APIKEY || '').trim(),
  sendsayFromEmail: String(process.env.SENDSAY_FROM_EMAIL || 'noreply@spottergym.ru').trim(),
  sendsayFromName: String(process.env.SENDSAY_FROM_NAME || 'Spotter').trim(),
  /** Public web origin for reset links */
  appPublicUrl: String(process.env.APP_PUBLIC_URL || 'http://localhost:5173')
    .trim()
    .replace(/\/$/, ''),
  /** Authorization Key from GigaChat studio (Base64 client_id:client_secret). Alias: GIGACHAT_AUTH_KEY */
  gigachatCredentials: String(
    process.env.GIGACHAT_CREDENTIALS || process.env.GIGACHAT_AUTH_KEY || '',
  ).trim(),
  gigachatScope: String(process.env.GIGACHAT_SCOPE || 'GIGACHAT_API_PERS').trim() ||
    'GIGACHAT_API_PERS',
  gigachatBaseUrl: String(
    process.env.GIGACHAT_BASE_URL || 'https://gigachat.devices.sberbank.ru/api/',
  )
    .trim()
    .replace(/\/?$/, '/'),
  gigachatOauthUrl: String(
    process.env.GIGACHAT_OAUTH_URL ||
      'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
  ).trim(),
  gigachatModel: String(process.env.GIGACHAT_MODEL || 'GigaChat').trim() || 'GigaChat',
  gigachatCoachPeriodDays: (() => {
    const n = Number(process.env.GIGACHAT_COACH_PERIOD_DAYS || 7)
    if (!Number.isFinite(n)) return 7
    return Math.min(14, Math.max(1, Math.round(n)))
  })(),
  /**
   * PEM of НУЦ Минцифры (Russian Trusted Root CA). Required for GigaChat TLS.
   * Override with GIGACHAT_CA_FILE / GIGACHAT_CA_BUNDLE_FILE.
   */
  gigachatCaFile: (() => {
    const fromEnv = String(
      process.env.GIGACHAT_CA_FILE || process.env.GIGACHAT_CA_BUNDLE_FILE || '',
    ).trim()
    if (fromEnv) return fromEnv
    const here = path.dirname(fileURLToPath(import.meta.url))
    const candidates = [
      path.resolve(here, '../certs/russian_trusted_root_ca.pem'),
      path.resolve(process.cwd(), 'certs/russian_trusted_root_ca.pem'),
    ]
    return candidates.find((p) => existsSync(p)) || ''
  })(),
}

export function isGigachatConfigured() {
  return Boolean(env.gigachatCredentials)
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
