import { listAdminUserIds } from './admin.js'
import { createNotification } from './notify.js'

/** Notify admins who opted in to «new registrations» (respects prefs + push). */
export async function notifyRegistrationAdmins(input: {
  userId: string
  userName: string
  userEmail: string
}) {
  const adminIds = await listAdminUserIds(input.userId)
  if (!adminIds.length) return

  const name = (input.userName || 'Новый пользователь').trim() || 'Новый пользователь'
  const title = 'Новая регистрация'
  const body = `${name} · ${input.userEmail}`.slice(0, 500)
  const href = `/app/user/${input.userId}`

  await Promise.all(
    adminIds.map((userId) =>
      createNotification({
        userId,
        type: 'new_registration',
        title,
        body,
        href,
        actorId: input.userId,
      }),
    ),
  )
}
