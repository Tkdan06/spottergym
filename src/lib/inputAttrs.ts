/**
 * Атрибуты полей ввода под мобильную клавиатуру / автозаполнение.
 * Поиск и обычный текст не должны предлагать пароли, карты и логины.
 */

/** Менеджеры паролей (1Password / LastPass) — не предлагать сохранённые данные */
const noPasswordManager = {
  'data-1p-ignore': true,
  'data-lpignore': 'true',
  'data-form-type': 'other',
} as const

/** Поиск клуба, города, админки — только клавиатура, без автозаполнения */
export const searchFieldProps = {
  type: 'search' as const,
  name: 'spotter-search',
  // Нестандартное значение: Safari/Chrome часто игнорируют просто "off"
  autoComplete: 'spotter-search',
  autoCorrect: 'off' as const,
  autoCapitalize: 'off' as const,
  spellCheck: false,
  inputMode: 'search' as const,
  enterKeyHint: 'search' as const,
  ...noPasswordManager,
}

/** Сообщение в чат / обращение — текст, без менеджера паролей */
export const messageFieldProps = {
  name: 'spotter-message',
  autoComplete: 'spotter-message',
  autoCorrect: 'on' as const,
  autoCapitalize: 'sentences' as const,
  spellCheck: true,
  enterKeyHint: 'send' as const,
  ...noPasswordManager,
}

/** Био / «о себе» */
export const bioFieldProps = {
  name: 'spotter-bio',
  autoComplete: 'spotter-bio',
  autoCorrect: 'on' as const,
  autoCapitalize: 'sentences' as const,
  spellCheck: true,
  ...noPasswordManager,
}

/** Возраст — цифры, без карт/контактов */
export const ageFieldProps = {
  type: 'number' as const,
  name: 'spotter-age',
  autoComplete: 'spotter-age',
  inputMode: 'numeric' as const,
  min: 18,
  max: 80,
  ...noPasswordManager,
}

/** Отображаемое имя (не логин) */
export const displayNameFieldProps = {
  name: 'spotter-display-name',
  autoComplete: 'nickname',
  autoCorrect: 'off' as const,
  autoCapitalize: 'words' as const,
  spellCheck: false,
  ...noPasswordManager,
}
