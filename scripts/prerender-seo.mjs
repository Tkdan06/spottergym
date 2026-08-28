#!/usr/bin/env node
/**
 * After Vite build: copy dist/index.html to /lp/index.html etc. with unique
 * title, description and canonical so nginx/GitHub Pages serve crawler HTML
 * without waiting for React.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const catalog = JSON.parse(readFileSync(join(root, 'src/seo/pages.json'), 'utf8'))
const distIndex = join(root, 'dist/index.html')

function replaceAttr(html, pattern, replacement) {
  if (!pattern.test(html)) return html
  return html.replace(pattern, replacement)
}

function applyPage(html, page, origin) {
  const canonical = page.path === '/' ? `${origin}/` : `${origin}${page.path}`
  const title = page.title.replace(/</g, '')
  const desc = page.description.replace(/"/g, '&quot;')
  let out = html
  out = replaceAttr(out, /<title>[^<]*<\/title>/, `<title>${title}</title>`)
  out = replaceAttr(
    out,
    /<meta\s+name="description"\s+content="[^"]*"\s*\/>/,
    `<meta name="description" content="${desc}" />`,
  )
  out = replaceAttr(
    out,
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/>/,
    `<link rel="canonical" href="${canonical}" />`,
  )
  out = replaceAttr(
    out,
    /<link\s+rel="alternate"\s+href="[^"]*"\s+hreflang="ru"\s*\/>/,
    `<link rel="alternate" href="${canonical}" hreflang="ru" />`,
  )
  out = replaceAttr(
    out,
    /<link\s+rel="alternate"\s+href="[^"]*"\s+hreflang="x-default"\s*\/>/,
    `<link rel="alternate" href="${canonical}" hreflang="x-default" />`,
  )
  out = replaceAttr(
    out,
    /<meta\s+property="og:url"\s+content="[^"]*"\s*\/>/,
    `<meta property="og:url" content="${canonical}" />`,
  )
  out = replaceAttr(
    out,
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/>/,
    `<meta property="og:title" content="${title.replace(/"/g, '&quot;')}" />`,
  )
  out = replaceAttr(
    out,
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/,
    `<meta property="og:description" content="${desc}" />`,
  )
  out = replaceAttr(
    out,
    /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/>/,
    `<meta name="twitter:title" content="${title.replace(/"/g, '&quot;')}" />`,
  )
  out = replaceAttr(
    out,
    /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/>/,
    `<meta name="twitter:description" content="${desc}" />`,
  )

  const yandex = (process.env.VITE_YANDEX_VERIFICATION || '').trim()
  const google = (process.env.VITE_GOOGLE_SITE_VERIFICATION || '').trim()
  const verify = []
  if (yandex) verify.push(`    <meta name="yandex-verification" content="${yandex}" />`)
  if (google) verify.push(`    <meta name="google-site-verification" content="${google}" />`)
  if (verify.length) {
    out = out.replace(
      '    <!--\n      Optional verification (paste codes from Webmaster tools before release):\n      <meta name="yandex-verification" content="YOUR_YANDEX_CODE" />\n      <meta name="google-site-verification" content="YOUR_GOOGLE_CODE" />\n    -->',
      verify.join('\n'),
    )
  }
  return out
}

function outPath(pagePath) {
  if (pagePath === '/') return join(root, 'dist/index.html')
  return join(root, 'dist', pagePath.replace(/^\//, ''), 'index.html')
}

const html = readFileSync(distIndex, 'utf8')
const origin = String(catalog.origin || 'https://spottergym.ru').replace(/\/$/, '')

for (const page of catalog.pages) {
  const next = applyPage(html, page, origin)
  const file = outPath(page.path)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, next)
  console.log(`[seo] ${page.path} → ${file.replace(root + '/', '')}`)
}
