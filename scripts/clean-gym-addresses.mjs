import fs from 'node:fs'

const path = new URL('../src/data/gyms.json', import.meta.url)
const gyms = JSON.parse(fs.readFileSync(path, 'utf8'))

function cleanText(value) {
  if (typeof value !== 'string') return value
  return value
    // literal "\n" / "\r" / "\t" left from scraping (two chars)
    .replace(/\\n/g, ', ')
    .replace(/\\r/g, ' ')
    .replace(/\\t/g, ' ')
    // real newlines/tabs if any
    .replace(/[\r\n\t]+/g, ', ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*/g, ', ')
    .replace(/,\s*,+/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,]+|[\s,]+$/g, '')
    .trim()
}

let touched = 0
const samples = []

for (const gym of gyms) {
  for (const key of ['address', 'district', 'name', 'city']) {
    if (typeof gym[key] !== 'string') continue
    const before = gym[key]
    const after = cleanText(before)
    if (after !== before) {
      gym[key] = after
      touched += 1
      if (samples.length < 12) samples.push({ name: gym.name, key, before, after })
    }
  }
}

let remaining = 0
for (const gym of gyms) {
  for (const value of Object.values(gym)) {
    if (typeof value === 'string' && value.includes('\\n')) remaining += 1
  }
}

fs.writeFileSync(path, `${JSON.stringify(gyms, null, 2)}\n`)
console.log(JSON.stringify({ touched, remaining, samples }, null, 2))
