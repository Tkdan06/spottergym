import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(fileURLToPath(import.meta.url))
const script = path.join(root, 'render-og.py')
const result = spawnSync('python3', [script], { stdio: 'inherit' })
process.exit(result.status ?? 1)
