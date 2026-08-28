import { Fragment, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { registerHref } from '../lib/inviteShare'
import { trackLanding } from '../lib/landingTrack'
import { normalizeSeoPath } from '../seo/pages'

function plainText(text: string) {
  return text.replace(/\*\*/g, '')
}

function isAllBold(text: string) {
  return /^\*\*[^*]+\*\*$/.test(text)
}

function isCue(text: string) {
  return text === 'Например:' || text === 'Или:'
}

function isBullet(text: string) {
  return text.startsWith('* ')
}

function isFactLine(text: string) {
  return text.endsWith(';') && !isBullet(text) && text.length < 90
}

function isFactContinue(text: string) {
  return text.length < 90 && /^[а-яёa-z+0-9]/.test(text) && !text.includes('. ')
}

function isExampleLine(text: string) {
  const plain = plainText(text)
  if (text.startsWith('«') || isCue(text)) return true
  if (isAllBold(text)) return true
  if (plain.includes('×')) return true
  return false
}

function paragraphClass(text: string) {
  const plain = plainText(text)
  if (text.startsWith('«') || (isAllBold(text) && plain.startsWith('«'))) return 'guide-quote'
  if (isAllBold(text) && (plain.endsWith('?') || plain.endsWith('.'))) return 'guide-punch'
  if (isCue(text) || plain === 'Жим лёжа') return 'guide-cue'
  if (plain === '+12,5%' || plain === 'Похоже, ты застрял') return 'guide-stat'
  if (plain.includes('×')) return 'guide-quote'
  if (
    text === 'Увидел в зале — написал в Spotter.' ||
    text === 'Записал тренировку сегодня — увидел свой прогресс завтра.'
  ) {
    return 'guide-punch'
  }
  return undefined
}

export function GuideInline({ text }: { text: string }) {
  const { pathname } = useLocation()
  const here = normalizeSeoPath(pathname)
  const chunks = text.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*)/g)
  return (
    <>
      {chunks.map((part, i) => {
        const link = part.match(/^\[([^\]]+)\]\((\/[^)]+)\)$/)
        if (link) {
          if (normalizeSeoPath(link[2]) === here) return <Fragment key={i}>{link[1]}</Fragment>
          return (
            <Link key={i} to={link[2]}>
              {link[1]}
            </Link>
          )
        }
        const m = part.match(/^\*\*([^*]+)\*\*$/)
        if (m) return <strong key={i}>{m[1]}</strong>
        return <Fragment key={i}>{part}</Fragment>
      })}
    </>
  )
}

type GuideBlock =
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'examples'; lines: string[] }

export function GuideParagraphs({ texts }: { texts: string[] }) {
  const blocks: GuideBlock[] = []
  for (const text of texts) {
    const last = blocks[blocks.length - 1]
    if (isBullet(text) || isFactLine(text) || (last?.type === 'ul' && isFactContinue(text))) {
      const item = isBullet(text) ? text.slice(2) : text
      if (last?.type === 'ul') {
        last.items.push(item)
        continue
      }
      blocks.push({ type: 'ul', items: [item] })
      continue
    }
    if (isExampleLine(text) && last?.type === 'examples') {
      last.lines.push(text)
      continue
    }
    if (isExampleLine(text)) {
      blocks.push({ type: 'examples', lines: [text] })
      continue
    }
    blocks.push({ type: 'p', text })
  }

  return blocks.map((block, i) => {
    if (block.type === 'ul') {
      return (
        <ul key={`ul-${i}`} className="guide-bullets">
          {block.items.map((item) => (
            <li key={item}>
              <GuideInline text={item} />
            </li>
          ))}
        </ul>
      )
    }
    if (block.type === 'examples') {
      return (
        <div key={`ex-${i}`} className="guide-examples">
          {block.lines.map((p) => (
            <p key={p} className={paragraphClass(p)}>
              <GuideInline text={p} />
            </p>
          ))}
        </div>
      )
    }
    return (
      <p key={block.text} className={paragraphClass(block.text)}>
        <GuideInline text={block.text} />
      </p>
    )
  })
}

export type GuideCrumb = { to: string; label: string }

export function GuideBreadcrumbs({ items }: { items: GuideCrumb[] }) {
  return (
    <nav className="guide-crumbs" aria-label="Навигация по разделу">
      <ol>
        {items.map((item, i) => {
          const last = i === items.length - 1
          return (
            <li key={`${item.to}-${item.label}`}>
              {last ? (
                <span aria-current="page">{item.label}</span>
              ) : (
                <Link to={item.to}>{item.label}</Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export function GuideFooter({
  cta,
  children,
}: {
  cta?: { label: string; to: string; placement: string } | null
  children?: ReactNode
}) {
  const href = cta?.to ?? registerHref()
  const label = cta?.label ?? 'Создать аккаунт'
  const placement = cta?.placement ?? 'guide'
  return (
    <footer className="guide-footer">
      {children}
      {cta === null ? null : (
        <Link
          to={href}
          className="btn btn-primary btn-block"
          onClick={() => trackLanding('cta_register', { placement })}
        >
          {label}
        </Link>
      )}
      <p className="muted">
        <Link to="/">На главную</Link>
        {' · '}
        <Link to="/guide">Все материалы</Link>
        {' · '}
        <Link to="/terms">Соглашение</Link>
      </p>
    </footer>
  )
}
