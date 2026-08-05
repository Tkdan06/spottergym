/** Keep in sync with webapp `src/lib/fieldLimits.ts` + `src/lib/photos.ts`. */

export const NAME_MIN = 2
export const NAME_MAX = 30
export const USERNAME_MIN = 3
export const USERNAME_MAX = 20
export const BIO_MAX = 500
export const EMAIL_MAX = 254
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 128

export const CITY_MAX = 80
export const PHOTO_MAX_COUNT = 3
/** ~3 MB binary as base64 data-URL (+ header) — верхняя граница на сервере */
export const PHOTO_DATA_URL_MAX_CHARS = 4_200_000
export const AVATAR_MAX_CHARS = 4_200_000
export const GYM_IDS_MAX = 30
export const GYM_ID_MAX = 64
export const TAG_ITEM_MAX = 40
export const TAGS_MAX = 24
export const VISIT_SLOTS_MAX = 21
export const BREAK_UNTIL_MAX = 32

export const CHAT_MESSAGE_MAX = 1000
export const GREETING_MESSAGE_MAX = 500
export const FEEDBACK_MESSAGE_MIN = 10
export const FEEDBACK_MESSAGE_MAX = 2000
export const ADMIN_MESSAGE_MAX = 2000

/** Reject oversized JSON bodies before parsing into memory (несколько фото) */
export const HTTP_BODY_MAX_BYTES = 8 * 1024 * 1024
