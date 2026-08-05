import { hash, verify } from '@node-rs/argon2'

const opts = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
}

export async function hashPassword(password: string) {
  return hash(password, opts)
}

export async function verifyPassword(passwordHash: string, password: string) {
  try {
    return await verify(passwordHash, password, opts)
  } catch {
    return false
  }
}
