# Spotter operations

## Local development

```bash
npm install
npm run dev
```

For the API and PostgreSQL:

```bash
docker compose up -d postgres
cd api && npm install && npm run db:setup && npm run dev
```

Vite proxies `/api` to `http://127.0.0.1:3001`. Required variables are described in `.env.example` and `api/.env.example`; never commit actual `.env` files or production secrets.

## Database and gym catalog

`api/prisma/seed.ts` upserts the gym catalog. It reads the packaged `api/prisma/data/gyms.json` in containers and the monorepo catalog locally. Existing user data, memberships and check-ins are not deleted by a normal seed.

When the catalog changes:

1. Keep `src/data/gyms.json` and `api/prisma/data/gyms.json` identical.
2. Update `src/data/cities.json` counts when the city totals change.
3. Rebuild/restart the production API so its startup seed performs the upsert.

## Verification commands

```bash
npm run lint
npm run build
npm run build --prefix api
npm test --prefix api
```

Report existing warnings or unrelated test failures separately from the change being made.

## Production update

On the VPS, follow `DEPLOY.md`. The normal update is:

```bash
cd ~/spottergym
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
npm ci && VITE_API_URL= VITE_SITE_LOCK_ENABLED=false npm run build
rsync -a --delete dist/ /var/www/spottergym/dist/
```

The API container startup runs Prisma migrations and the idempotent seed before starting the server. Validate `/health` after an API deployment. For nginx/TLS and media-routing procedures, use the exact guidance in `DEPLOY.md` rather than overwriting a live certbot-managed configuration.
