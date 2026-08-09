# Spotter — production deploy (открытый доступ)

На сервере: профили, залы, check-in, лайки, уведомления, тикеты, чаты, поиск по @нику, блокировки, админка.

## Architecture

```
Browser → nginx (TLS) → static SPA (dist/)
                    └─ /api → Hono on 127.0.0.1:3001 → Postgres (Docker)
```

JWT уходит заголовком `X-Spotter-Token`.

## 1. Secrets (только сервер, не в git)

| Secret | Where | Notes |
|--------|--------|------|
| `POSTGRES_PASSWORD` | `.env.prod` | Длинный случайный |
| `JWT_SECRET` | `.env.prod` | ≥ 32 символов |
| `MASTER_ADMIN_EMAIL` | `.env.prod` | Только на сервере, не в клиенте |

Сайт **без** nginx Basic Auth и без soft site-lock. Пользователи регистрируются сами.

```bash
cp .env.prod.example .env.prod
# сгенерируй пароли (см. ниже) — не коммить .env.prod
```

## 2. API + Postgres

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
curl -s http://127.0.0.1:3001/health
```

## 3. Frontend (открытый прод)

```bash
npm ci
VITE_API_URL= VITE_SITE_LOCK_ENABLED=false npm run build
mkdir -p /var/www/spottergym
rsync -a --delete dist/ /var/www/spottergym/dist/
```

## 4. nginx + TLS

```bash
apt install -y nginx
cp deploy/nginx.conf /etc/nginx/sites-available/spotter
ln -sf /etc/nginx/sites-available/spotter /etc/nginx/sites-enabled/spotter
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

apt install -y certbot python3-certbot-nginx
certbot --nginx -d spottergym.ru -d www.spottergym.ru
```

DNS A/AAAA → IP VPS. Если раньше был GitHub Pages — отключи для домена.

## 5. Admin

1. Открой `https://spottergym.ru`
2. Зарегистрируйся на email из `MASTER_ADMIN_EMAIL` (из `.env.prod`) с сильным паролем (≥ 8)
3. Этот аккаунт — главный админ

## 6. Updates

```bash
cd ~/spottergym
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
npm ci && VITE_API_URL= VITE_SITE_LOCK_ENABLED=false npm run build
rsync -a --delete dist/ /var/www/spottergym/dist/
```
