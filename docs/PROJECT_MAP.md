# Spotter project map

## System at a glance

```text
React PWA (Vite) → /api proxy or same-origin nginx → Hono API → Prisma → PostgreSQL
       │                                              │
       └─ service worker / Web Push                    └─ media volume, push, Sendsay, optional GigaChat
```

The production topology and exact deployment commands are in [`OPERATIONS.md`](OPERATIONS.md).

## Frontend

- `src/main.tsx` — fonts, PWA boot, site lock, emergency gate, React root.
- `src/App.tsx` — routes, protected/guest areas, lazy admin and secondary pages.
- `src/context/AppContext.tsx` — authenticated user, social state, API synchronization, legacy local fallback.
- `src/lib/apiClient.ts` — typed client API boundary; do not bypass it from pages.
- `src/types.ts` — shared client model types.
- `src/pages/` — route-level features; styles are generally co-located as `PageName.css`.
- `src/components/` — reusable visual and behavioral primitives.
- `src/styles/` — global tokens, global primitives, sheets.

### Primary product routes

- `/app` — My gym and check-in (`HomePage.tsx`).
- `/app/discover`, `/app/gym/:gymId` — catalog and gym detail.
- `/app/messages`, `/app/messages/:conversationId` — inbox and chat.
- `/app/workouts/*`, `/app/activity` — workout journal, progress, coach and gym activity.
- `/app/profile`, `/app/settings`, `/app/invite`, `/app/notifications` — account areas.
- `/app/admin/*` — permission-gated operations and analytics.

## Backend

- `api/src/index.ts` — Hono application, middleware, route mounting and service loops.
- `api/src/routes/` — HTTP boundaries; validate input with Zod here.
- `api/src/lib/` — domain logic, serializers, analytics calculation, integrations.
- `api/src/middleware/auth.ts` — cookie/custom-header session validation and user context.
- `api/prisma/schema.prisma` — database models and indexes.
- `api/prisma/migrations/` — immutable schema history.
- `api/prisma/seed.ts` — idempotent catalog seed via Prisma upsert.

## Key domain boundaries

- Authentication, profile, gyms and check-in: `api/src/routes/auth.ts`, `me.ts`, `gyms.ts`.
- Social: `likes.ts`, `conversations.ts`, `blocks.ts`, and matching `src/lib/` clients.
- Workout journal and AI: `api/src/routes/meWorkouts.ts`, `api/src/lib/workouts.ts`, `workoutInsight.ts`, `workoutMonthly.ts`, `workoutCoach.ts`.
- Admin and analytics: `api/src/routes/admin.ts`, `analytics.ts`, and `api/src/lib/admin*.ts`.
- Privacy-safe public responses: `api/src/lib/serialize.ts`; modify carefully and cover with privacy tests.

## Catalog and static content

- `src/data/gyms.json` — frontend catalog/fallback source.
- `api/prisma/data/gyms.json` — packaged production seed copy; it must match the frontend catalog exactly.
- `src/data/cities.json` — city metadata/counts; update when catalog city totals change.
- `src/content/`, `src/seo/`, `public/sitemap.xml` — guide and SEO content.

## Before changing a cross-cutting area

| Task | Read first |
| --- | --- |
| Profile/privacy/social | `DOMAIN_RULES.md`, `serialize.ts`, relevant API route, `AppContext.tsx` |
| Gym catalog/check-in | `DOMAIN_RULES.md`, both gym JSON files, `me.ts`, `gyms.ts`, `gymHours.ts` |
| Workouts/AI | `DOMAIN_RULES.md`, `meWorkouts.ts`, relevant `api/src/lib/workout*.ts` |
| Visual UI | `UI_KIT.md`, `/app/admin/ui`, component and CSS used by the nearest existing screen |
| Analytics/admin | `docs/analytics/`, route/lib pair, related unit tests |
| Deployment | `OPERATIONS.md`, `DEPLOY.md`, Docker/nginx configuration |
