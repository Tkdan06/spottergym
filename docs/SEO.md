# Spotter SEO operations

## What is indexable

- Public discovery pages live under `/`, `/lp`, `/lp-coaches`, `/guide` and `/guide/workouts/*`.
- Authenticated product routes under `/app` are intentionally `noindex`.
- Canonical metadata lives in `src/seo/pages.json`.
- `public/robots.txt` points to the root sitemap. The committed `public/sitemap.xml` is a development/source copy; production `dist/sitemap.xml` is generated from `src/seo/pages.json` on every frontend build.

## Static content for guide pages

Guide text is sourced from `src/content/guides.ts` and `src/content/workoutsGuide.ts`. During `npm run build`, `scripts/prerender-seo.mjs` writes page-specific metadata, JSON-LD, sitemap URLs and the visible guide content into the initial HTML response.

The React client replaces this fallback with the interactive page after it loads. The fallback and client must communicate the same content; do not add crawler-only copy or different claims.

The build uses Node's TypeScript stripping to consume the content source. Use Node 22.6+ (Node 24 is used locally) for frontend builds.

## Content standards

- One page answers one clear user task. Do not generate city or keyword variants from the gym catalog.
- Use a specific H1, meaningful H2 hierarchy, readable paragraphs, useful internal links and a product CTA appropriate to the article.
- Keep workout data semantics exact: a manual workout is not a check-in; `Я в зале` is the source of activity/presence.
- Do not make medical claims, prescribe training or present a universal plan as appropriate for everyone.
- Visible FAQ blocks are for readers. Do not add FAQPage structured data solely to chase a rich result.

## Before release

1. Run `npm run lint` and `npm run build`.
2. Inspect the generated `dist/<path>/index.html`: title, description, canonical, robots, H1 and article text must be present.
3. Confirm `dist/sitemap.xml` contains only canonical, indexable URLs.
4. In Yandex Webmaster, use **Indexing → Check page** and **JavaScript page rendering** for at least one new URL on mobile.
5. In Google Search Console, use URL Inspection on the same URL and confirm that Google-selected canonical matches the declared canonical.

## Reindexing after production deployment

Submit the root sitemap once in both webmaster tools. For a small batch of new or materially updated pages, request reindexing individually after confirming a public `200 OK` response. Requests are a crawl hint, not a publication guarantee. Track impressions, clicks, registration completion and first meaningful action before expanding a content cluster.
