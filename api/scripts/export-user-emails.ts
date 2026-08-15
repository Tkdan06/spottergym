/**
 * Export user emails and names for CRM / Sensei import.
 *
 * Usage (from repo root or api/):
 *   npm run users:export-emails --prefix api
 *   npm run users:export-emails --prefix api -- --csv
 *   npm run users:export-emails --prefix api -- --include-deleted
 *
 * Default: two lines — emails comma-separated, then names comma-separated.
 * --csv: one "email,name" row per user (RFC-ish quoting).
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function csvEscape(value: string) {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

async function main() {
  const args = new Set(process.argv.slice(2))
  const asCsv = args.has('--csv')
  const includeDeleted = args.has('--include-deleted')

  const users = await prisma.user.findMany({
    where: includeDeleted ? {} : { deletedAt: null },
    select: { email: true, name: true, deletedAt: true },
    orderBy: { registeredAt: 'asc' },
  })

  // Skip tombstone / invalid system emails
  const rows = users.filter((u) => {
    const email = u.email.toLowerCase()
    if (email.endsWith('@spotter.invalid')) return false
    if (!email.includes('@')) return false
    return true
  })

  if (!rows.length) {
    console.error('No users to export')
    process.exitCode = 1
    return
  }

  if (asCsv) {
    console.log('email,name')
    for (const u of rows) {
      console.log(`${csvEscape(u.email)},${csvEscape(u.name)}`)
    }
  } else {
    console.log(rows.map((u) => u.email).join(','))
    console.log(rows.map((u) => u.name).join(','))
  }

  console.error(`# exported ${rows.length} users`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
