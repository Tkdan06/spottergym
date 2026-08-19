/** Лимит фото в профиле — держим localStorage и сервер лёгкими */
export const MAX_PROFILE_PHOTOS = 3

/** Сырой файл до сжатия — максимум 3 МБ на одно фото */
export const MAX_PHOTO_INPUT_BYTES = 3 * 1024 * 1024
const MAX_EDGE = 1080
const TARGET_MAX_BYTES = 280_000
const START_QUALITY = 0.82
const MIN_QUALITY = 0.55

export function clampPhotos(photos: string[]): string[] {
  return photos.filter(Boolean).slice(0, MAX_PROFILE_PHOTOS)
}

/** Inline data-URL — только для отправки на API, не для localStorage. */
export function isInlinePhotoDataUrl(value: string) {
  return /^data:image\//i.test(String(value || '').trim())
}

/** Пути `/api/media/...` и локальные SVG — ок в кэше; base64 выкидываем (QuotaExceeded). */
export function sanitizePhotosForCache(photos: string[] | undefined | null): string[] {
  if (!Array.isArray(photos)) return []
  return clampPhotos(photos.filter((p) => p && !isInlinePhotoDataUrl(p)))
}

export function setMainPhoto(photos: string[], index: number): string[] {
  if (index <= 0 || index >= photos.length) return photos
  const next = [...photos]
  const [main] = next.splice(index, 1)
  return [main, ...next]
}

export function removePhotoAt(photos: string[], index: number): string[] {
  return photos.filter((_, i) => i !== index)
}

type Drawable = {
  width: number
  height: number
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
  close: () => void
}

async function loadDrawable(file: File): Promise<Drawable> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, {
        // EXIF orientation — иначе портреты с телефона «лежат» боком
        imageOrientation: 'from-image',
      } as ImageBitmapOptions)
      return {
        width: bmp.width,
        height: bmp.height,
        draw: (ctx, w, h) => ctx.drawImage(bmp, 0, 0, w, h),
        close: () => bmp.close(),
      }
    } catch {
      // fallback below
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Не удалось прочитать изображение'))
      el.src = url
    })
    return {
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
      close: () => URL.revokeObjectURL(url),
    }
  } catch (err) {
    URL.revokeObjectURL(url)
    throw err
  }
}

function scaleSize(width: number, height: number, maxEdge: number) {
  const longest = Math.max(width, height)
  if (longest <= maxEdge) return { w: width, h: height }
  const ratio = maxEdge / longest
  return {
    w: Math.max(1, Math.round(width * ratio)),
    h: Math.max(1, Math.round(height * ratio)),
  }
}

function canvasToJpegDataUrl(canvas: HTMLCanvasElement, quality: number): string {
  return canvas.toDataURL('image/jpeg', quality)
}

function approxBytes(dataUrl: string) {
  const i = dataUrl.indexOf(',')
  const b64 = i >= 0 ? dataUrl.slice(i + 1) : dataUrl
  return Math.ceil((b64.length * 3) / 4)
}

/**
 * Сжимает фото на клиенте: ресайз до ~1080px по длинной стороне,
 * JPEG с адаптивным качеством, без EXIF. Возвращает data URL.
 */
export async function optimizeImageFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Выбери файл изображения (JPEG, PNG, WebP…)')
  }
  if (file.size > MAX_PHOTO_INPUT_BYTES) {
    throw new Error('Файл слишком большой — максимум 3 МБ')
  }

  const source = await loadDrawable(file)
  try {
    let edge = MAX_EDGE
    let dataUrl = ''
    let bytes = Infinity

    for (let pass = 0; pass < 4; pass++) {
      const { w, h } = scaleSize(source.width, source.height, edge)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Не удалось обработать изображение')
      ctx.fillStyle = '#121816'
      ctx.fillRect(0, 0, w, h)
      source.draw(ctx, w, h)

      let quality = START_QUALITY
      dataUrl = canvasToJpegDataUrl(canvas, quality)
      bytes = approxBytes(dataUrl)

      while (bytes > TARGET_MAX_BYTES && quality > MIN_QUALITY) {
        quality = Math.max(MIN_QUALITY, quality - 0.08)
        dataUrl = canvasToJpegDataUrl(canvas, quality)
        bytes = approxBytes(dataUrl)
      }

      if (bytes <= TARGET_MAX_BYTES || edge <= 720) break
      edge = Math.round(edge * 0.85)
    }

    return dataUrl
  } finally {
    source.close()
  }
}
