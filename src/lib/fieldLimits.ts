/** Shared input caps — keep FE UI and API in sync (dating-app norms). */

export const NAME_MIN = 2
export const NAME_MAX = 30

export const USERNAME_MIN = 3
export const USERNAME_MAX = 20

/** Tinder-style about-me */
export const BIO_MIN = 5
export const BIO_MAX = 500

export const EMAIL_MAX = 254
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 128

export const CHAT_MESSAGE_MAX = 1000
export const GREETING_MESSAGE_MAX = 500

export const FEEDBACK_MESSAGE_MIN = 10
export const FEEDBACK_MESSAGE_MAX = 2000
export const REPORT_NOTE_MAX = 1000
export const ADMIN_MESSAGE_MAX = 2000

export const CITY_MAX = 80
export const SEARCH_QUERY_MAX = 80

export function clampText(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max)
}
