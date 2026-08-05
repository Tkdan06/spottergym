# Spotter — friends beta deploy

На сервере общие: профили, залы, check-in, лайки, уведомления, тикеты, чаты, **поиск по @нику**, блокировки пользователей, блокировки email, админ-реестр (права, удаление, статусы тикетов), события зала (новый участник / check-in / тренер).

## Architecture

```
Browser → nginx (TLS + Basic Auth) → static SPA (dist/)
                              └─ /api → Hono on 127.0.0.1:3001 → Postgres (Docker)
```

JWT is sent as `X-Spotter-Token` (not `Authorization`), so it does not collide with nginx Basic Auth.

Do **not** rely on GitHub Pages alone for a friends beta — there is no shared database.

## 1. Secrets checklist

| Secret | Where | Notes |
|--------|--------|------|
| `POSTGRES_PASSWORD` | `.env.prod` | Long random |
| `JWT_SECRET` | `.env.prod` | ≥ 32 chars; API refuses weak defaults in prod |
| `MASTER_ADMIN_EMAIL` | `.env.prod` | Only `tkdan@ya.ru` — that account is the sole admin; other registrations never get admin |
| nginx `htpasswd` | `/etc/nginx/spotter.htpasswd` | Real friends gate |
| `VITE_SITE_LOCK_*` | frontend build env | Soft UX gate only — password is in the JS bundle |

```bash
cp .env.prod.example .env.prod
# edit .env.prod
```

## 2. Start API + Postgres

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
curl -s http://127.0.0.1:3001/health
```

## 3. Build frontend (same origin `/api`)

```bash
npm ci
VITE_API_URL= \
VITE_SITE_LOCK_ENABLED=true \
VITE_SITE_LOCK_USER='your-soft-user' \
VITE_SITE_LOCK_PASSWORD='your-soft-password' \
npm run build

sudo mkdir -p /var/www/spottergym
sudo rsync -a --delete dist/ /var/www/spottergym/dist/
```

Empty `VITE_API_URL` means the SPA calls `/api` on the same host (nginx proxies it).

## 4. nginx friends gate + proxy

```bash
sudo apt install -y nginx apache2-utils
sudo htpasswd -c /etc/nginx/spotter.htpasswd friends   # choose a strong password
sudo cp deploy/nginx.conf /etc/nginx/sites-available/spotter
sudo ln -sf /etc/nginx/sites-available/spotter /etc/nginx/sites-enabled/spotter
sudo nginx -t && sudo systemctl reload nginx
```

Then TLS:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d spottergym.ru -d www.spottergym.ru
```

Point DNS A/AAAA to the VPS (pause GitHub Pages custom domain first).

## 5. Open / close the soft site lock (optional)

Client gate (not security): edit `public/site-lock.json` before build, or rebuild with `VITE_SITE_LOCK_ENABLED=false` for open public launch later.

To open the **real** gate for public launch: remove `auth_basic` lines from nginx and reload.

## 6. Cloudflare (recommended)

Put the domain behind Cloudflare (orange cloud) for basic DDoS cushion. Keep TLS full/strict to origin.

## 7. Backups

Nightly dump example:

```bash
# crontab -e
15 3 * * * docker compose -f /path/to/spotter/docker-compose.prod.yml --env-file /path/to/spotter/.env.prod exec -T postgres pg_dump -U spotter spotter | gzip > /var/backups/spotter-$(date +\%F).sql.gz
```

Keep off-server copies.

## 8. Admin bootstrap

1. Open the site (nginx password → optional soft lock → register).
2. Register with `MASTER_ADMIN_EMAIL` and a strong password (≥ 8 chars).
3. That account gets master admin flags.

## 9. Acceptance checks

- [ ] Two phones, two accounts, same gym → both appear in **Мой зал**
- [ ] `curl` `/api/gyms/<id>/people` without session → `401`
- [ ] People JSON has **no** `email` / admin fields
- [ ] Auth flood returns `429` after many attempts
- [ ] API with weak `JWT_SECRET` refuses to start (`NODE_ENV=production`)
- [ ] Postgres port not open on `0.0.0.0`
- [ ] Stop API → production UI does not invent local accounts

## Known limits

- Блокировки email / реестр в админке частично localStorage
- Фото как data URL в Postgres (нормально для десятков пользователей)
- Единственный админ: `MASTER_ADMIN_EMAIL` = `tkdan@ya.ru`
- Чаты: polling ~3–5 с (не WebSocket) — для friends-beta достаточно
