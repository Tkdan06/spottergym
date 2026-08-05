import { SignJWT, jwtVerify } from 'jose'
import { env } from '../env.js'

const encoder = new TextEncoder()

function secretKey() {
  return encoder.encode(env.jwtSecret)
}

export type SessionPayload = {
  sub: string
  email: string
}

export async function signSession(payload: SessionPayload, expiresIn = '30d') {
  return new SignJWT({ email: payload.email })
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
    if (!sub || !email) return null
    return { sub, email }
  } catch {
    return null
  }
}
