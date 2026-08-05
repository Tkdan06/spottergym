# Spotter API

Postgres + Hono + Prisma. Auth (Argon2 + JWT cookie), профили, залы, check-in.

## Быстрый старт

```bash
# из корня репозитория
docker compose up -d postgres
cd api
cp .env.example .env   # если ещё нет
npm install
npm run db:setup       # prisma db push + seed gyms.json
npm run dev            # http://localhost:3001
```

Фронт (Vite) проксирует `/api` → `:3001`.  
Админ: **зарегистрируй** аккаунт с `MASTER_ADMIN_EMAIL` (логин сам аккаунт не создаёт).  
Прод-деплой: см. [../DEPLOY.md](../DEPLOY.md).

## Эндпоинты

- `GET /health`
- `POST /auth/register` `{ name, email, password, gender }` (rate limited; password ≥ 8)
- `POST /auth/login` `{ email, password }` (rate limited; unified error text)
- `POST /auth/logout`
- `GET /auth/me`
- `GET|PATCH /me`
- `POST /me/check-in` `{ gymId }`
- `POST /me/check-out`
- `POST|DELETE /me/gyms/:gymId`
- `GET /gyms`, `GET /gyms/:id`
- `GET /gyms/:id/people` (auth required; public profile fields only)
- `GET /likes`, `POST /likes/:userId/toggle`
- `GET|PATCH /notifications`, prefs, read-all
- `GET|POST /tickets`, reply, admin outbound
- `GET|POST /conversations`, messages, accept, read
