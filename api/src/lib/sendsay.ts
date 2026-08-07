import { env } from '../env.js'

export function isSendsayConfigured() {
  return Boolean(env.sendsayLogin && env.sendsayApiKey && env.sendsayFromEmail)
}

type SendsayResponse = {
  errors?: { id?: string; explain?: string }[]
  [key: string]: unknown
}

/**
 * Transactional single email via Sendsay issue.send / personal.
 * @see https://docs.sendsay.ru/sendsay-api/how-to-send-transactional-campaigns/
 */
export async function sendSendsayEmail(input: {
  to: string
  subject: string
  html: string
  text: string
}) {
  if (!isSendsayConfigured()) {
    throw new Error('Sendsay не настроен (SENDSAY_LOGIN / SENDSAY_APIKEY)')
  }

  const url = `https://api.sendsay.ru/general/api/v100/json/${encodeURIComponent(env.sendsayLogin)}/`
  const body = {
    apikey: env.sendsayApiKey,
    action: 'issue.send',
    group: 'personal',
    email: input.to,
    sendwhen: 'now',
    // Do not wrap reset links in tracking redirects
    relink: 0,
    letter: {
      subject: input.subject,
      'from.name': env.sendsayFromName,
      'from.email': env.sendsayFromEmail,
      'reply.email': env.sendsayFromEmail,
      message: {
        html: input.html,
        text: input.text,
      },
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = (await res.json().catch(() => ({}))) as SendsayResponse
  if (!res.ok) {
    throw new Error(`Sendsay HTTP ${res.status}`)
  }
  if (Array.isArray(data.errors) && data.errors.length) {
    const first = data.errors[0]
    throw new Error(first?.explain || first?.id || 'Sendsay error')
  }
  return data
}
