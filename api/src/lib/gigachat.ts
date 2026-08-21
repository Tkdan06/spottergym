import { randomUUID } from 'node:crypto'
import https from 'node:https'
import { env, isGigachatConfigured } from '../env.js'

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export type GigaChatResult = {
  content: string
  model: string
  promptTokens: number
  completionTokens: number
}

const TOKEN_TTL_MS = 28 * 60 * 1000
const FALLBACK_MODELS = ['GigaChat', 'GigaChat:latest']

let cachedToken = ''
let tokenExpiresAt = 0

function sberRequest(
  url: string,
  opts: { method: string; headers: Record<string, string>; body?: string },
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const headers = { ...opts.headers }
    if (opts.body && !headers['Content-Length']) {
      headers['Content-Length'] = String(Buffer.byteLength(opts.body))
    }
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: `${u.pathname}${u.search}`,
        method: opts.method,
        headers,
        rejectUnauthorized: false,
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c) => chunks.push(c as Buffer))
        res.on('end', () => {
          resolve({
            status: res.statusCode || 0,
            text: Buffer.concat(chunks).toString('utf8'),
          })
        })
      },
    )
    req.on('error', reject)
    if (opts.body) req.write(opts.body)
    req.end()
  })
}

async function getAccessToken() {
  if (!isGigachatConfigured()) {
    throw new Error('GigaChat is not configured')
  }
  const now = Date.now()
  if (cachedToken && now < tokenExpiresAt) return cachedToken

  const body = new URLSearchParams({ scope: env.gigachatScope }).toString()
  const res = await sberRequest(env.gigachatOauthUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      RqUID: randomUUID(),
      Authorization: `Basic ${env.gigachatCredentials}`,
    },
    body,
  })
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`GigaChat OAuth ${res.status}`)
  }
  let data: { access_token?: string } = {}
  try {
    data = JSON.parse(res.text) as { access_token?: string }
  } catch {
    throw new Error('GigaChat OAuth: invalid JSON')
  }
  const token = String(data.access_token || '').trim()
  if (!token) throw new Error('GigaChat OAuth: no access_token')
  cachedToken = token
  tokenExpiresAt = now + TOKEN_TTL_MS
  return token
}

function completionsUrl() {
  return `${env.gigachatBaseUrl}v1/chat/completions`
}

export async function gigachatChat(input: {
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
}): Promise<GigaChatResult> {
  const token = await getAccessToken()
  const models = [env.gigachatModel, ...FALLBACK_MODELS].filter(
    (m, i, arr) => m && arr.indexOf(m) === i,
  )
  let lastErr = 'GigaChat request failed'
  for (const model of models) {
    const payload = JSON.stringify({
      model,
      messages: input.messages,
      temperature: input.temperature ?? 0.3,
      max_tokens: input.maxTokens ?? 1000,
    })
    const res = await sberRequest(completionsUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: payload,
    })
    if (res.status === 401) {
      cachedToken = ''
      tokenExpiresAt = 0
    }
    if (res.status < 200 || res.status >= 300) {
      lastErr = `GigaChat ${res.status}`
      if (res.status === 404 && /no such model/i.test(res.text)) continue
      throw new Error(lastErr)
    }
    let data: {
      choices?: { message?: { content?: string } }[]
      usage?: { prompt_tokens?: number; completion_tokens?: number }
      model?: string
    } = {}
    try {
      data = JSON.parse(res.text) as typeof data
    } catch {
      throw new Error('GigaChat: invalid JSON')
    }
    const content = String(data.choices?.[0]?.message?.content || '').trim()
    if (!content) throw new Error('GigaChat: empty content')
    return {
      content,
      model: String(data.model || model),
      promptTokens: Number(data.usage?.prompt_tokens) || 0,
      completionTokens: Number(data.usage?.completion_tokens) || 0,
    }
  }
  throw new Error(lastErr)
}
