import type { Context } from 'hono'
import { prisma } from '../db.js'

export type OpsFaultGroup = {
  method: string
  path: string
  status: number
  code: string
  title: string
  meaning: string
  count: number
  lastAt: string
  sampleMessage: string
}

export type OpsFaultRow = {
  id: string
  createdAt: string
  method: string
  path: string
  status: number
  code: string
  title: string
  meaning: string
  message: string
  userId: string | null
}

export type OpsHealth = {
  last24h: number
  last5xx24h: number
  groups: OpsFaultGroup[]
  recent: OpsFaultRow[]
}

type Explained = { code: string; title: string; meaning: string }

function normalizePath(path: string) {
  return path
    .replace(/\/+$/, '')
    .replace(/\/me\/activity\/day\/\d{4}-\d{2}-\d{2}/g, '/me/activity/day/:date')
    .replace(/\/[a-z]+_[a-z0-9]{20,}/gi, '/:id')
    .replace(/\/c[a-z0-9]{20,}/g, '/:id')
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27}/gi, '/:id')
    .replace(/\/\d{6,}/g, '/:id')
}

function shouldIgnore(method: string, path: string, status: number) {
  if (method === 'OPTIONS') return true
  if (status < 400) return true
  if (path === '/health' || path === '/admin/emergency-recover') return true
  if (path.startsWith('/analytics')) return true
  if (path.startsWith('/media') && status < 500) return true
  if (path.startsWith('/admin') && status < 500) return true
  if (status === 401) return true
  return false
}

function explain(method: string, path: string, status: number, message: string): Explained {
  const key = `${method} ${path}`
  const text = message.trim()

  if (status >= 500) {
    return {
      code: 'server',
      title: 'Сервер упал',
      meaning:
        'Внутренняя ошибка API. Экран мог показать «не удалось сохранить» или пустую загрузку. Нужно смотреть логи контейнера api.',
    }
  }

  if (key === 'PATCH /me') {
    if (/зал/i.test(text)) {
      return {
        code: 'me.gyms',
        title: 'Не сохранился список залов',
        meaning:
          'Человек в онбординге или настройках отправил залы, но сервер их не принял. Профиль и возраст могли тоже не записаться, если это был один запрос.',
      }
    }
    if (/возраст|18|80|int|number/i.test(text) || /некорректн/i.test(text)) {
      return {
        code: 'me.profile',
        title: 'Профиль или возраст не сохранились',
        meaning:
          'Онбординг или «Настройки»: сервер отверг тело запроса. Человек видит «некорректные данные». Возраст, залы или другие поля не обновились.',
      }
    }
    if (/ник|username/i.test(text)) {
      return {
        code: 'me.username',
        title: 'Не сохранился @ник',
        meaning: 'Настройки профиля: ник занят или не проходит правила. Остальные поля этого сохранения тоже могли не уйти.',
      }
    }
    if (/фото|аватар|место/i.test(text)) {
      return {
        code: 'me.photo',
        title: 'Не загрузилось фото',
        meaning: 'Загрузка фото или аватара в профиле не прошла. Остальные данные этого запроса могли не сохраниться.',
      }
    }
    return {
      code: 'me.patch',
      title: 'Не сохранился профиль',
      meaning:
        'PATCH профиля не принят. Обычно это онбординг («Готово») или кнопка «Сохранить» в настройках.',
    }
  }

  if (key === 'POST /auth/register') {
    if (status === 409) {
      return {
        code: 'auth.register.exists',
        title: 'Регистрация: email уже есть',
        meaning: 'Человек жмёт «Создать аккаунт», но такой email уже зарегистрирован. Нужно вести на вход.',
      }
    }
    return {
      code: 'auth.register',
      title: 'Регистрация не прошла',
      meaning: 'Форма регистрации отвергнута (поля, лимит с IP или блок). Аккаунт не создался.',
    }
  }

  if (key === 'POST /auth/login') {
    return {
      code: 'auth.login',
      title: 'Вход не прошёл',
      meaning: 'Неверный пароль, нет аккаунта или сеть в блок-листе. Человек остаётся на экране входа.',
    }
  }

  if (key.startsWith('POST /auth/password') || key.startsWith('POST /auth/reset')) {
    return {
      code: 'auth.reset',
      title: 'Сброс пароля не прошёл',
      meaning: 'Письмо не ушло или токен не принят. Человек не может сменить пароль.',
    }
  }

  if (key.startsWith('POST /me/check-in')) {
    return {
      code: 'me.checkin',
      title: 'Не сработала отметка «Я в зале»',
      meaning: 'Чекин отклонён. Человек не появляется в зале у других.',
    }
  }

  if (key.startsWith('POST /likes') || key === 'POST /likes') {
    return {
      code: 'likes',
      title: 'Лайк не поставился',
      meaning: 'Кнопка сердца на карточке не прошла. Лайк и взаимность не записались.',
    }
  }

  if (key.includes('/conversations') && method === 'POST') {
    return {
      code: 'chat.send',
      title: 'Сообщение не отправилось',
      meaning: 'Чат: текст не ушёл или запрос на переписку отклонён.',
    }
  }

  if (key.startsWith('POST /tickets') || key.startsWith('POST /feedback')) {
    return {
      code: 'tickets',
      title: 'Обращение не создалось',
      meaning: 'Форма «Написать нам» не сохранилась.',
    }
  }

  if (status === 429) {
    return {
      code: 'rate',
      title: 'Слишком много запросов',
      meaning:
        'Сработал лимит. Кнопка «не работает» несколько секунд: повторная регистрация, сохранение профиля или пуш.',
    }
  }

  if (status === 403) {
    return {
      code: 'forbidden',
      title: 'Доступ закрыт',
      meaning: text || 'Сервер отказал в действии (блок, нет прав, аккаунт удалён).',
    }
  }

  return {
    code: 'other',
    title: 'Ошибка запроса',
    meaning: text
      ? `${method} ${path} → ${status}. Сервер: «${text}». Экран мог показать эту фразу или общую ошибку сохранения.`
      : `${method} ${path} ответил ${status}. Действие в приложении не выполнилось.`,
  }
}

export function recordOpsFaultFromContext(c: Context) {
  const status = c.res.status
  const method = c.req.method.toUpperCase()
  const rawPath = c.req.path || '/'
  if (shouldIgnore(method, rawPath, status)) return

  const path = normalizePath(rawPath) || rawPath
  const userId = (() => {
    try {
      const id = c.get('userId')
      return typeof id === 'string' && id ? id : undefined
    } catch {
      return undefined
    }
  })()

  void (async () => {
    let message = ''
    try {
      const data = (await c.res.clone().json()) as { error?: unknown }
      if (typeof data?.error === 'string') message = data.error.slice(0, 280)
    } catch {
      /* not json */
    }
    const explained = explain(method, path, status, message)
    try {
      await prisma.opsFault.create({
        data: {
          method,
          path,
          status,
          code: explained.code,
          title: explained.title,
          meaning: explained.meaning,
          message,
          userId,
        },
      })
      if (Math.random() < 0.03) {
        const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        await prisma.opsFault.deleteMany({ where: { createdAt: { lt: cutoff } } })
      }
    } catch (err) {
      console.warn('[ops] persist failed', err instanceof Error ? err.message : err)
    }
  })()
}

export async function opsFaultCounts(since: Date) {
  const [last24h, last5xx24h] = await Promise.all([
    prisma.opsFault.count({ where: { createdAt: { gte: since } } }),
    prisma.opsFault.count({ where: { createdAt: { gte: since }, status: { gte: 500 } } }),
  ])
  return { last24h, last5xx24h }
}

export async function buildOpsHealth(): Promise<OpsHealth> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const [counts, rows, recent] = await Promise.all([
    opsFaultCounts(since),
    prisma.opsFault.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 400,
    }),
    prisma.opsFault.findMany({
      orderBy: { createdAt: 'desc' },
      take: 40,
    }),
  ])

  const grouped = new Map<string, OpsFaultGroup>()
  for (const row of rows) {
    const key = `${row.method} ${row.path} ${row.status} ${row.code}`
    const prev = grouped.get(key)
    if (prev) {
      prev.count += 1
      if (row.createdAt.toISOString() > prev.lastAt) {
        prev.lastAt = row.createdAt.toISOString()
        prev.sampleMessage = row.message
      }
    } else {
      grouped.set(key, {
        method: row.method,
        path: row.path,
        status: row.status,
        code: row.code,
        title: row.title,
        meaning: row.meaning,
        count: 1,
        lastAt: row.createdAt.toISOString(),
        sampleMessage: row.message,
      })
    }
  }

  const groups = [...grouped.values()].sort((a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt))

  return {
    last24h: counts.last24h,
    last5xx24h: counts.last5xx24h,
    groups,
    recent: recent.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      method: row.method,
      path: row.path,
      status: row.status,
      code: row.code,
      title: row.title,
      meaning: row.meaning,
      message: row.message,
      userId: row.userId,
    })),
  }
}
