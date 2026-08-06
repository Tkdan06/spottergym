/** Приветствие после онбординга: soft ask поставить ярлык (web.dev «after conversion»). */

export const WELCOME_INSTALL_HREF = '/app/install'

export const WELCOME_INSTALL_TITLE = 'Добро пожаловать в Spotter'

export const WELCOME_INSTALL_BODY =
  'Поставь ярлык на домашний экран — быстрый вход и уведомления, чтобы не пропустить своих в зале.'

export const WELCOME_INSTALL_LOCAL_ID = 'n-onboarding-welcome'

export function isWelcomeInstallNotification(n: {
  href?: string
  title?: string
}) {
  return n.href === WELCOME_INSTALL_HREF || n.title === WELCOME_INSTALL_TITLE
}
