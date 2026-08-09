import { SignJWT, jwtVerify } from 'jose'
import { env } from '../env.js'

const encoder = new TextEncoder()

function secretKey() {
  return encoder.encode(env.jwtSecret)
}

export type SessionPayload = {
  sub: string
  email: string
  /** Must match User.tokenVersion */
  tv: number
}

export async function signSession(payload: SessionPayload, expiresIn = '30d') {
  return new SignJWT({ email: payload.email, tv: payload.tv })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey())
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey())
    const sub = typeof payload.sub === 'string' ? payload.sub : ''
    const email = typeof payload.email === 'string' ? payload.email : ''
    const tv = typeof payload.tv === 'number' && Number.isFinite(payload.tv) ? payload.tv : 0
    if (!sub || !email) return null
    return { sub, email, tv }
  } catch {
    return null
  }
}
