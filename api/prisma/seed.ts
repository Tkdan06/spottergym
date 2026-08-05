import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const __dirname = dirname(fileURLToPath(import.meta.url))

type GymJson = {
  id: string
  name: string
  network: string
  city: string
  district?: string
  address?: string
  image?: string
  lat?: number | null
  lng?: number | null
}

async function main() {
  const gymsPath = resolve(__dirname, '../../src/data/gyms.json')
  const raw = JSON.parse(readFileSync(gymsPath, 'utf8')) as GymJson[]
  if (!Array.isArray(raw) || !raw.length) {
    throw new Error('gyms.json empty or missing')
  }

  const chunkSize = 50
  let upserted = 0
  for (let i = 0; i < raw.length; i += chunkSize) {
    const chunk = raw.slice(i, i + chunkSize)
    await Promise.all(
      chunk.map((g) =>
        prisma.gym.upsert({
          where: { id: g.id },
          create: {
            id: g.id,
            name: g.name,
            network: g.network,
            city: g.city,
            district: g.district || '',
            address: g.address || '',
            image: g.image || '',
            lat: typeof g.lat === 'number' ? g.lat : null,
            lng: typeof g.lng === 'number' ? g.lng : null,
          },
          update: {
            name: g.name,
            network: g.network,
            city: g.city,
            district: g.district || '',
            address: g.address || '',
            image: g.image || '',
            lat: typeof g.lat === 'number' ? g.lat : null,
            lng: typeof g.lng === 'number' ? g.lng : null,
          },
        }),
      ),
    )
    upserted += chunk.length
  }

  console.log(`Seeded ${upserted} gyms`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
