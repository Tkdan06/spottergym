import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '../db.js'
import { env } from '../env.js'
import { isSendsayConfigured, sendSendsayEmail } from './sendsay.js'

const TOKEN_TTL_MS = 60 * 60 * 1000 // 60 minutes

export function hashResetToken(rawToken: string) {
  return createHash('sha256').update(rawToken).digest('hex')
}

export function createRawResetToken() {
  return randomBytes(32).toString('base64url')
}

export async function issuePasswordResetForUser(user: {
  id: string
  email: string
  name: string
}) {
  if (!isSendsayConfigured()) {
    console.warn('[password-reset] Sendsay not configured — skip send')
    return { sent: false as const, reason: 'sendsay_not_configured' }
  }

  const rawToken = createRawResetToken()
  const tokenHash = hashResetToken(rawToken)
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)

  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  })

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  })

  const resetUrl = `${env.appPublicUrl}/reset-password?token=${encodeURIComponent(rawToken)}`
  const name = (user.name || 'Привет').trim() || 'Привет'

  const text = [
    `${name},`,
    '',
    'Мы получили запрос на восстановление пароля Spotter.',
    'Открой ссылку (действует 60 минут):',
    resetUrl,
    '',
    'Если это были не ты — просто проигнорируй письмо. Пароль не изменится.',
    '',
    '— Spotter',
  ].join('\n')

  // Colors match src/styles/global.css UI kit tokens (inline — email clients ignore CSS vars).
  const html = `
<!DOCTYPE html>
<html lang="ru">
<body style="margin:0;padding:0;background:#0b0f0e;color:#eef5ef;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;background:#0b0f0e;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:480px;background:#141b18;border:1px solid rgba(232,240,234,0.1);border-radius:16px;padding:28px 24px;">
          <tr><td style="font-family:Syne,'Manrope',sans-serif;font-size:22px;font-weight:800;letter-spacing:0.04em;color:#eef5ef;">SPOT<span style="color:#c8f542;">TER</span></td></tr>
          <tr><td style="padding-top:18px;font-size:16px;line-height:1.45;color:#eef5ef;">${escapeHtml(name)}, мы получили запрос на восстановление пароля.</td></tr>
          <tr><td style="padding-top:22px;" align="center">
            <a href="${escapeAttr(resetUrl)}" style="display:inline-block;background:#c8f542;color:#13200a;text-decoration:none;font-weight:800;padding:14px 22px;border-radius:12px;">Сбросить пароль</a>
          </td></tr>
          <tr><td style="padding-top:18px;font-size:13px;line-height:1.45;color:#94a39a;">Ссылка действует 60 минут и только один раз. Если кнопка не открывается, скопируй адрес:</td></tr>
          <tr><td style="padding-top:8px;font-size:12px;line-height:1.4;word-break:break-all;color:#6b7a71;">${escapeHtml(resetUrl)}</td></tr>
          <tr><td style="padding-top:20px;font-size:12px;color:#6b7a71;">Если это были не ты — просто проигнорируй письмо.</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim()

  await sendSendsayEmail({
    to: user.email,
    subject: 'Восстановление пароля Spotter',
    html,
    text,
  })

  return { sent: true as const }
}

export async function consumePasswordResetToken(rawToken: string) {
  const tokenHash = hashResetToken(rawToken)
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, deletedAt: true } } },
  })
  if (!row || row.usedAt || row.user.deletedAt) {
    return { ok: false as const, error: 'Ссылка недействительна или уже использована' }
  }
  if (row.expiresAt.getTime() < Date.now()) {
    return { ok: false as const, error: 'Ссылка устарела — запроси новую' }
  }
  return { ok: true as const, tokenId: row.id, userId: row.user.id }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(value: string) {
  return escapeHtml(value).replace(/'/g, '&#39;')
}
