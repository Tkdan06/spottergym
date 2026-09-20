export type WorkoutShareSet = {
  weightKg: number | string
  reps: number | string
  weightDelta?: number | null
  repsDelta?: number | null
}

export type WorkoutShareExercise = {
  name: string
  setCountDelta?: number | null
  sets: WorkoutShareSet[]
}

export type WorkoutShareCardData = {
  title: string
  performedAt: string
  exercises: WorkoutShareExercise[]
}

const WIDTH = 1080
const HEIGHT = 1920
const MAX_EXERCISES = 6

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (char) => {
    const entities: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      "'": '&apos;',
      '"': '&quot;',
    }
    return entities[char] || char
  })
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',')
}

function truncate(value: string, limit: number) {
  const text = value.trim()
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text
}

function setLine(set: WorkoutShareSet) {
  const weight = Number(String(set.weightKg).replace(',', '.'))
  const reps = Math.floor(Number(set.reps))
  if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(reps) || reps <= 0) return ''
  return `${formatNumber(weight)} × ${reps}`
}

function exerciseProgress(exercise: WorkoutShareExercise) {
  if (exercise.setCountDelta) {
    const count = Math.abs(exercise.setCountDelta)
    const suffix = count === 1 ? 'подход' : count >= 2 && count <= 4 ? 'подхода' : 'подходов'
    return `${exercise.setCountDelta > 0 ? '+' : '−'}${count} ${suffix}`
  }
  const weightDelta = exercise.sets.find((set) => set.weightDelta)?.weightDelta
  if (weightDelta) return `${weightDelta > 0 ? '+' : '−'}${formatNumber(Math.abs(weightDelta))} кг`
  const repsDelta = exercise.sets.find((set) => set.repsDelta)?.repsDelta
  if (repsDelta) return `${repsDelta > 0 ? '+' : '−'}${Math.abs(repsDelta)} повт.`
  return ''
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

/** Story-sized, local-only SVG. No workout data is uploaded or made public. */
export function createWorkoutShareSvg(data: WorkoutShareCardData) {
  const exercises = data.exercises.filter((exercise) => exercise.name.trim()).slice(0, MAX_EXERCISES)
  const rows = exercises.map((exercise, index) => {
    const y = 645 + index * 168
    const sets = exercise.sets.map(setLine).filter(Boolean).join('  ·  ') || 'Без записанных подходов'
    const progress = exerciseProgress(exercise)
    return `
      <line x1="88" y1="${y - 48}" x2="992" y2="${y - 48}" stroke="#28342e" stroke-width="2" />
      <text x="88" y="${y}" fill="#eef5ef" font-family="Arial, sans-serif" font-size="38" font-weight="700">${escapeXml(truncate(exercise.name, 42))}</text>
      <text x="88" y="${y + 52}" fill="#aebbb3" font-family="Arial, sans-serif" font-size="31" font-weight="500">${escapeXml(truncate(sets, 58))}</text>
      ${progress ? `<text x="992" y="${y}" text-anchor="end" fill="#c8f542" font-family="Arial, sans-serif" font-size="28" font-weight="700">${escapeXml(progress)}</text>` : ''}
    `
  }).join('')
  const remaining = Math.max(0, data.exercises.filter((exercise) => exercise.name.trim()).length - exercises.length)
  const endY = 645 + exercises.length * 168

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <rect width="${WIDTH}" height="${HEIGHT}" fill="#0b0f0e" />
    <circle cx="980" cy="204" r="190" fill="#c8f542" opacity="0.12" />
    <circle cx="102" cy="1694" r="216" fill="#c8f542" opacity="0.08" />
    <text x="88" y="142" fill="#c8f542" font-family="Arial, sans-serif" font-size="46" font-weight="800" letter-spacing="5">SPOTTER</text>
    <text x="88" y="275" fill="#eef5ef" font-family="Arial, sans-serif" font-size="76" font-weight="800">Моя тренировка сегодня</text>
    <text x="88" y="342" fill="#94a39a" font-family="Arial, sans-serif" font-size="34" font-weight="500">${escapeXml(truncate(data.title || 'Тренировка', 44))} · ${escapeXml(formatDate(data.performedAt))}</text>
    <rect x="88" y="438" width="904" height="2" fill="#3a4840" />
    ${rows}
    ${remaining ? `<text x="88" y="${endY + 30}" fill="#94a39a" font-family="Arial, sans-serif" font-size="30" font-weight="600">Ещё ${remaining} упр.</text>` : ''}
    <text x="88" y="1705" fill="#c8f542" font-family="Arial, sans-serif" font-size="31" font-weight="700">ТРЕНИРУЙСЯ. ЗНАКОМЬСЯ. ВОЗВРАЩАЙСЯ.</text>
    <text x="88" y="1774" fill="#eef5ef" font-family="Arial, sans-serif" font-size="42" font-weight="800">spottergym.ru</text>
  </svg>`
}

export function workoutSharePreviewUrl(data: WorkoutShareCardData) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(createWorkoutShareSvg(data))}`
}

export async function createWorkoutShareFile(data: WorkoutShareCardData) {
  const svgUrl = workoutSharePreviewUrl(data)
  const image = new Image()
  image.decoding = 'async'
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Не удалось подготовить изображение'))
    image.src = svgUrl
  })
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Не удалось подготовить изображение')
  context.drawImage(image, 0, 0, WIDTH, HEIGHT)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Не удалось подготовить изображение')
  return new File([blob], 'spotter-workout.png', { type: 'image/png' })
}
