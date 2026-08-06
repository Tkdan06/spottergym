import { createNotification } from './notify.js'
import { prisma } from '../db.js'

/** Soft ask after onboarding (web.dev: promote install after conversion, not mid-form). */
export const WELCOME_INSTALL_HREF = '/app/install'
export const WELCOME_INSTALL_TITLE = 'Добро пожаловать в Spotter'
export const WELCOME_INSTALL_BODY =
  'Поставь ярлык на домашний экран — быстрый вход и уведомления, чтобы не пропустить своих в зале.'

/** One-shot: create welcome + install tip when onboarding finishes. */
export async function ensureWelcomeInstallNotification(userId: string) {
  const existing = await prisma.notification.findFirst({
    where: { userId, href: WELCOME_INSTALL_HREF },
    select: { id: true },
  })
  if (existing) return existing

  return createNotification({
    userId,
    type: 'system',
    title: WELCOME_INSTALL_TITLE,
    body: WELCOME_INSTALL_BODY,
    href: WELCOME_INSTALL_HREF,
  })
}
