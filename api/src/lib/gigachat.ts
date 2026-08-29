import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import https from 'node:https'
import tls from 'node:tls'
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

/** Extra CA for Sber hosts (НУЦ Минцифры). Never disables verification. */
function tlsOptions(): Pick<https.RequestOptions, 'ca' | 'rejectUnauthorized'> {
  const extraPath = env.gigachatCaFile
  const extra = extraPath && existsSync(extraPath) ? readFileSync(extraPath) : null
  return {
    rejectUnauthorized: true,
    ...(extra ? { ca: [...tls.rootCertificates, extra] } : {}),
  }
}

function tlsErrorMessage(err: unknown) {
  const code =
    err && typeof err === 'object' && 'code' in err ? String((err as { code?: unknown }).code) : ''
  if (
    code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
    code === 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY' ||
    code === 'CERT_UNTRUSTED' ||
    code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
    /certificate/i.test(err instanceof Error ? err.message : String(err))
  ) {
    return 'GigaChat TLS: certificate verify failed. Set GIGACHAT_CA_FILE to the Russian Trusted Root CA PEM.'
  }
  return err instanceof Error ? err.message : 'GigaChat request failed'
}

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
        ...tlsOptions(),
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
    req.on('error', (err) => reject(new Error(tlsErrorMessage(err))))
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
