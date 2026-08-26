/** Shared guards for weekly/monthly letters. Numbers in prose must exist in the model JSON. */

const MEDICAL_RE =
  /перетрен|перетренир|травм|лечен|лекарств|диагноз|заболеван|гормон|стероид|препарат|\bврач|больниц|реабилитац|физиотерап|восстановленн/i

const ACTIVITY_TIME_RE =
  /в зале.{0,32}\d|\d.{0,16}(час|мин)|провёл[аи]?\s+в зале|провел[аи]?\s+в зале/i

export const INSIGHT_PENDING_JSON = { pending: true as const }
export const STALE_PENDING_MS = 120_000

export function isPendingInsightOutput(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false
  const o = raw as { pending?: unknown; summary?: unknown; headline?: unknown }
  return o.pending === true && o.summary == null && o.headline == null
}

export function hasMedicalClaim(text: string) {
  return MEDICAL_RE.test(text)
}

export function hasActivityTimeClaim(text: string) {
  return ACTIVITY_TIME_RE.test(text)
}

function valueAllowed(raw: string, allowed: Set<string>): boolean {
  const t = raw.trim().replace(',', '.')
  if (!t) return false
  if (allowed.has(t)) return true
  const noPct = t.replace(/%/g, '').trim()
  return allowed.has(noPct) || allowed.has(`${noPct}%`)
}

/** Drop calendar years and «26 августа» so date copy is not treated as a metric. */
export function proseNumberTokens(text: string): string[] {
  const stripped = text
    .replace(/\b20\d{2}\b/g, ' ')
    .replace(
      /\b\d{1,2}\s+(январ|феврал|март|апрел|ма[йяе]|июн|июл|август|сентябр|октябр|ноябр|декабр)/gi,
      ' ',
    )
  const out: string[] = []
  const re = /\d+(?:[.,]\d+)?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(stripped))) out.push(m[0].replace(',', '.'))
  return out
}

export function proseHasDisallowedNumber(text: string, allowed: Set<string>) {
  for (const raw of proseNumberTokens(text)) {
    if (!valueAllowed(raw, allowed)) return true
  }
  return false
}

export function insightProseOk(
  text: string,
  allowed: Set<string>,
  activityPresent: boolean,
) {
  const t = text.trim()
  if (!t) return true
  if (hasMedicalClaim(t)) return false
  if (!activityPresent && hasActivityTimeClaim(t)) return false
  if (proseHasDisallowedNumber(t, allowed)) return false
  return true
}
