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

function robotsForPage(page) {
  if (page.index === false) {
    return page.canonicalPath ? 'noindex, follow' : 'noindex, nofollow'
  }
  return 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
}

function stripHomepageOnlyBlocks(html, pagePath) {
  if (pagePath === '/') return html
  let out = html
  out = out.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/, (_, raw) => {
    try {
      const data = JSON.parse(raw)
      if (Array.isArray(data['@graph'])) {
        data['@graph'] = data['@graph'].filter((node) => node['@type'] !== 'FAQPage')
      }
      return `<script type="application/ld+json">\n      ${JSON.stringify(data, null, 8).replace(/\n/g, '\n      ')}\n    </script>`
    } catch {
      return _
    }
  })
  return out
}

function applyPage(html, page, origin) {
  const canonicalPath = page.canonicalPath || page.path
  const canonical = canonicalPath === '/' ? `${origin}/` : `${origin}${canonicalPath}`
  const title = page.title.replace(/</g, '')
  const desc = page.description.replace(/"/g, '&quot;')
  const image = page.ogImage ? `${origin}${page.ogImage}` : `${origin}/og-share.png`
  const robots = robotsForPage(page)
  const ogType = page.schemaType === 'Article' ? 'article' : 'website'
  let out = stripHomepageOnlyBlocks(html, page.path)
  out = replaceAttr(out, /<title>[^<]*<\/title>/, `<title>${title}</title>`)
  out = replaceAttr(
    out,
    /<meta\s+name="description"\s+content="[^"]*"\s*\/>/,
    `<meta name="description" content="${desc}" />`,
  )
  out = replaceAttr(
    out,
    /<meta\s+name="robots"\s+content="[^"]*"\s*\/>/,
    `<meta name="robots" content="${robots}" />`,
  )
  out = replaceAttr(
    out,
    /<meta\s+name="googlebot"\s+content="[^"]*"\s*\/>/,
    `<meta name="googlebot" content="${robots}" />`,
  )
  out = replaceAttr(
    out,
    /<meta\s+name="yandex"\s+content="[^"]*"\s*\/>/,
    `<meta name="yandex" content="${page.index === false ? (page.canonicalPath ? 'noindex, follow' : 'noindex, nofollow') : 'index, follow'}" />`,
  )
  out = replaceAttr(
    out,
    /<meta\s+property="og:type"\s+content="[^"]*"\s*\/>/,
    `<meta property="og:type" content="${ogType}" />`,
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
    /<meta\s+property="og:image"\s+content="[^"]*"\s*\/>/,
    `<meta property="og:image" content="${image}" />`,
  )
  out = replaceAttr(
    out,
    /<meta\s+property="og:image:secure_url"\s+content="[^"]*"\s*\/>/,
    `<meta property="og:image:secure_url" content="${image}" />`,
  )
  out = replaceAttr(
    out,
    /<meta\s+property="og:image:alt"\s+content="[^"]*"\s*\/>/,
    `<meta property="og:image:alt" content="${title.replace(/"/g, '&quot;')}" />`,
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
  out = replaceAttr(
    out,
    /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/>/,
    `<meta name="twitter:image" content="${image}" />`,
  )
  out = replaceAttr(
    out,
    /<meta\s+name="twitter:image:alt"\s+content="[^"]*"\s*\/>/,
    `<meta name="twitter:image:alt" content="${title.replace(/"/g, '&quot;')}" />`,
  )

  if (page.path !== '/') {
    out = out.replace(/\n\s*<meta\s+name="keywords"\s+content="[^"]*"\s*\/>/, '')
    out = out.replace(
      /\n\s*<link rel="preload" as="image" href="\/images\/welcome-gym.jpg" fetchpriority="high" \/>/,
      '',
    )
  }

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

  const jsonLd = pageJsonLd(page, origin, canonical)
  if (jsonLd) {
    out = out.replace('</head>', `    <script type="application/ld+json">\n${jsonLd}\n    </script>\n  </head>`)
  }
  return out
}

function pageJsonLd(page, origin, canonical) {
  if (!page.schemaType || page.index === false) return ''
  const crumbs = [{ name: 'Главная', path: '/' }]
  if (page.path === '/guide' || page.path.startsWith('/guide/')) {
    crumbs.push({ name: 'Журнал', path: '/guide' })
  }
  if (page.path === '/guide/workouts' || page.path.startsWith('/guide/workouts/')) {
    crumbs.push({ name: 'Тренировки', path: '/guide/workouts' })
  }
  if (page.crumb && page.path !== '/guide' && page.path !== '/guide/workouts') {
    crumbs.push({ name: page.crumb, path: page.path })
  }
  const graph = [
    {
      '@type': page.schemaType,
      headline: page.h1 || page.title,
      name: page.h1 || page.title,
      description: page.description,
      url: canonical,
      inLanguage: 'ru-RU',
      isPartOf: { '@id': `${origin}/#website` },
      publisher: { '@id': `${origin}/#organization` },
      image: page.ogImage ? `${origin}${page.ogImage}` : `${origin}/og-share.png`,
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((item, i) => {
        const last = i === crumbs.length - 1
        const row = {
          '@type': 'ListItem',
          position: i + 1,
          name: item.name,
        }
        // Last crumb is the current page: name only, no URL (not an HTML self-link).
        if (!last) {
          row.item = item.path === '/' ? `${origin}/` : `${origin}${item.path}`
        }
        return row
      }),
    },
  ]
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 6)
    .split('\n')
    .map((line, i) => (i === 0 ? `      ${line}` : `      ${line}`))
    .join('\n')
}

function sitemapPriority(path) {
  if (path === '/') return '1.0'
  if (path === '/lp') return '0.9'
  if (path === '/guide' || path === '/guide/workouts') return '0.85'
  if (path === '/register' || path === '/lp-coaches') return '0.8'
  if (path === '/terms') return '0.4'
  if (path.startsWith('/guide/')) return '0.8'
  return '0.7'
}

function writeSitemap(pages, origin) {
  const urls = pages
    .filter((page) => page.index !== false)
    .map((page) => {
      const loc = page.path === '/' ? `${origin}/` : `${origin}${page.path}`
      const freq = page.path === '/terms' ? 'yearly' : page.path === '/' || page.path === '/guide' || page.path === '/lp' ? 'weekly' : 'monthly'
      return `  <url>\n    <loc>${loc}</loc>\n    <changefreq>${freq}</changefreq>\n    <priority>${sitemapPriority(page.path)}</priority>\n  </url>`
    })
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
  writeFileSync(join(root, 'dist/sitemap.xml'), xml)
  console.log(`[seo] sitemap → dist/sitemap.xml (${urls.length} urls)`)
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

writeFileSync(join(root, 'dist/.nojekyll'), '')
writeFileSync(join(root, 'dist/guide/404.html'), readFileSync(join(root, 'dist/guide/index.html')))
writeSitemap(catalog.pages, origin)
