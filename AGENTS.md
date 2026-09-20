# Spotter — working agreement

Spotter is an existing production mobile-first PWA for people who train in real gyms.
Improve the existing product; do not rebuild it without an explicit, evidence-based reason.

## Start every task here

1. Read this file and the relevant file in `docs/`.
2. Find the existing implementation before proposing or writing code.
3. Treat code, Prisma schema, migrations, and tests as the current technical truth.
4. Make the smallest backward-compatible change that satisfies the request.
5. Do not stage, alter, or delete unrelated working-tree changes.

## Sources of truth

1. Runtime code, `api/prisma/schema.prisma`, migrations, and tests.
2. This file and `docs/`.
3. Product context and task discussion.

When these disagree, report the discrepancy and follow the code unless the task explicitly changes it.

## Product invariants

- `Activity` is check-in based; `Workout` is a manually recorded session. They are not interchangeable.
- A user may complete onboarding without a gym and may browse any gym.
- Check-in is the source of live gym presence and expires automatically. Do not invent live gym metrics.
- Social messaging follows request → acceptance → chat. Do not turn it into unrestricted DMs.
- Anonymous mode must not disclose identity, gym graph, city, schedule, or other private profile details.
- AI coaching is available to all users, distinguishes missing data from no progress, and makes no medical claims.
- Existing analytics uses real event names and server-side aggregation. Never log passwords, tokens, secrets, message text, or other sensitive data.

See `docs/DOMAIN_RULES.md` for the detailed product rules.

## Architecture map

- React routes: `src/App.tsx`; application state: `src/context/AppContext.tsx`.
- Client/server contract: `src/lib/apiClient.ts`; API routes: `api/src/routes/`.
- Database model: `api/prisma/schema.prisma`; catalog seed: `src/data/gyms.json` and `api/prisma/data/gyms.json`.
- Visual source of truth: `/app/admin/ui`, `src/pages/UiKitPage.tsx`, `src/styles/color-themes.css`, and `src/styles/global.css`.

Read `docs/PROJECT_MAP.md` before cross-cutting work.

## Change discipline

- Preserve API contracts and data semantics; use migrations for schema changes.
- Include loading, empty, error, and retry states for user-facing async work.
- Keep production and seed copies of the gym catalog identical.
- Update the relevant `docs/` file only when a product rule, architecture, API contract, operational process, or UI convention changes.
- Add an ADR in `docs/adr/` for decisions that would otherwise be rediscovered or debated.

## Verification

Run checks proportionate to the risk. For frontend work, normally run `npm run lint` and `npm run build`; for API changes, also run `npm run build --prefix api` and relevant API tests. Report pre-existing failures separately.

## Deployment

The user has authorized GitHub work required by a task without an additional confirmation: creating repositories, committing changes, and pushing branches. Do not delete repositories, force-push, alter unrelated remotes, or deploy to production unless explicitly requested. The documented VPS procedure is in `docs/OPERATIONS.md` and `DEPLOY.md`.
