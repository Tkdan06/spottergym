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
// Keep important content clear of the Stories chrome (progress/header at the top,
// reply field at the bottom). Background decoration may extend beyond this area.
const STORY_SAFE_BOTTOM = 380
const CONTENT_BOTTOM = HEIGHT - STORY_SAFE_BOTTOM
const ROW_TOP = 700
const ROW_HEIGHT = 110

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

function exerciseProgress(exercise: WorkoutShareExercise): { text: string; color: string } | null {
  if (exercise.setCountDelta) {
    const count = Math.abs(exercise.setCountDelta)
    const suffix = count === 1 ? 'подход' : count >= 2 && count <= 4 ? 'подхода' : 'подходов'
    return {
      text: `${exercise.setCountDelta > 0 ? '+' : '−'}${count} ${suffix}`,
      color: exercise.setCountDelta > 0 ? '#67efc1' : '#ff5263',
    }
  }
  const weightDelta = exercise.sets.find((set) => set.weightDelta)?.weightDelta
  if (weightDelta) {
    return {
      text: `${weightDelta > 0 ? '+' : '−'}${formatNumber(Math.abs(weightDelta))} кг`,
      color: weightDelta > 0 ? '#67efc1' : '#ff5263',
    }
  }
  const repsDelta = exercise.sets.find((set) => set.repsDelta)?.repsDelta
  if (repsDelta) {
    return {
      text: `${repsDelta > 0 ? '+' : '−'}${Math.abs(repsDelta)} повт.`,
      color: repsDelta > 0 ? '#67efc1' : '#ff5263',
    }
  }
  return null
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
    const y = ROW_TOP + index * ROW_HEIGHT
    const sets = exercise.sets.map(setLine).filter(Boolean).join('  ·  ') || 'Без записанных подходов'
    const progress = exerciseProgress(exercise)
    return `
      ${index > 0 ? `<line x1="88" y1="${y - 55}" x2="992" y2="${y - 55}" stroke="#28342e" stroke-width="2" />` : ''}
      <text x="88" y="${y}" fill="#eef5ef" font-family="Arial, sans-serif" font-size="38" font-weight="700">${escapeXml(truncate(exercise.name, 42))}</text>
      <text x="88" y="${y + 44}" fill="#aebbb3" font-family="Arial, sans-serif" font-size="31" font-weight="500">${escapeXml(truncate(sets, 58))}</text>
      ${progress ? `<text x="992" y="${y}" text-anchor="end" fill="${progress.color}" font-family="Arial, sans-serif" font-size="28" font-weight="700">${escapeXml(progress.text)}</text>` : ''}
    `
  }).join('')
  const remaining = Math.max(0, data.exercises.filter((exercise) => exercise.name.trim()).length - exercises.length)
  const endY = ROW_TOP + exercises.length * ROW_HEIGHT

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <defs>
      <linearGradient id="story-base" x1="0" y1="0" x2="1080" y2="1920" gradientUnits="userSpaceOnUse">
        <stop stop-color="#0a0f0d" />
        <stop offset="0.48" stop-color="#101914" />
        <stop offset="1" stop-color="#070a09" />
      </linearGradient>
      <linearGradient id="story-ribbon-top" x1="562" y1="108" x2="1080" y2="926" gradientUnits="userSpaceOnUse">
        <stop stop-color="#42624c" stop-opacity="0.42" />
        <stop offset="0.44" stop-color="#203d31" stop-opacity="0.24" />
        <stop offset="1" stop-color="#0d1713" stop-opacity="0" />
      </linearGradient>
      <linearGradient id="story-ribbon-bottom" x1="-86" y1="1194" x2="756" y2="1834" gradientUnits="userSpaceOnUse">
        <stop stop-color="#244536" stop-opacity="0" />
        <stop offset="0.52" stop-color="#315743" stop-opacity="0.24" />
        <stop offset="1" stop-color="#14251d" stop-opacity="0.12" />
      </linearGradient>
      <filter id="story-soften" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="22" />
      </filter>
    </defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#story-base)" />
    <path d="M722 -120C949 88 1142 157 1164 479c16 231-112 438-324 535-94 43-202 67-301 152 115-206 231-287 265-482 35-202-80-340-203-465 52-5 79-50 121-120Z" fill="url(#story-ribbon-top)" filter="url(#story-soften)" />
    <path d="M-184 1354c214-176 402-219 602-107 181 102 239 294 468 381 90 34 162 65 242 146H-92c45-131 82-280-92-420Z" fill="url(#story-ribbon-bottom)" filter="url(#story-soften)" />
    <path d="M723 18c157 150 249 257 260 408" fill="none" stroke="#6e9676" stroke-opacity="0.14" stroke-width="5" />
    <path d="M-64 1507c199-98 343-41 510 84" fill="none" stroke="#577961" stroke-opacity="0.13" stroke-width="4" />
    <text x="540" y="405" text-anchor="middle" fill="#eef5ef" font-family="Syne, Arial, sans-serif" font-size="58" font-weight="800" letter-spacing="-2.3">SPOT<tspan fill="#c8f542">TER</tspan></text>
    <text x="88" y="520" fill="#eef5ef" font-family="Arial, sans-serif" font-size="76" font-weight="800">Моя тренировка сегодня</text>
    <text x="88" y="587" fill="#94a39a" font-family="Arial, sans-serif" font-size="34" font-weight="500">${escapeXml(truncate(data.title || 'Тренировка', 44))} · ${escapeXml(formatDate(data.performedAt))}</text>
    <rect x="88" y="638" width="904" height="2" fill="#3a4840" />
    ${rows}
    ${remaining ? `<text x="88" y="${Math.min(endY + 20, CONTENT_BOTTOM - 104)}" fill="#94a39a" font-family="Arial, sans-serif" font-size="30" font-weight="600">Ещё ${remaining} упр.</text>` : ''}
    <text x="88" y="${CONTENT_BOTTOM - 68}" fill="#c8f542" font-family="Arial, sans-serif" font-size="31" font-weight="700">ТРЕНИРУЙСЯ. ЗНАКОМЬСЯ. ВОЗВРАЩАЙСЯ.</text>
    <text x="88" y="${CONTENT_BOTTOM}" fill="#eef5ef" font-family="Arial, sans-serif" font-size="42" font-weight="800">spottergym.ru</text>
  </svg>`
}

export function workoutSharePreviewUrl(data: WorkoutShareCardData) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(createWorkoutShareSvg(data))}`
}

export async function createWorkoutShareFile(data: WorkoutShareCardData) {
  await document.fonts?.load('800 58px Syne')
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
