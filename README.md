# SPOTTER

Веб-приложение для знакомств и поиска тренировочных партнёров **в конкретных спортзалах**.

Mobile-first от **360px**, резиновая вёрстка до десктопа.

## Быстрый старт

```bash
npm install
npm run dev
```

Открой локальный URL Vite.

### Postgres API (рекомендуется)

```bash
docker compose up -d postgres
cd api && npm install && npm run db:setup && npm run dev
```

В другом терминале: `npm run dev` (Vite проксирует `/api` → `:3001`).

Главный админ: зарегистрируй аккаунт с email из `MASTER_ADMIN_EMAIL` (по умолчанию **tkdan@ya.ru**). В production без API вход закрыт (fail closed). В dev без Docker — fallback на `localStorage`.

Подробнее: [api/README.md](api/README.md) · друзья на VPS: [DEPLOY.md](DEPLOY.md).

## Что уже есть

- Регистрация / вход / онбординг (город → зал → профиль → расписание → приватность)
- Вкладка «Зал»: кто в твоём клубе, кто сейчас на тренировке
- Каталог залов города и участники любого зала
- Профили: намерение (знакомства / партнёр / оба), интересы, слоты посещения
- Анонимный режим и статус «открыт к общению»
- Чаты с моделью request → accept
- Сервер: Postgres + Hono (auth Argon2/JWT, профили, залы, check-in); чаты/лайки пока в `localStorage`

## Стек

React + TypeScript + Vite + React Router + Lucide · API: Hono + Prisma + PostgreSQL

## Домен

Прод: **https://spottergym.ru**

## Закрытый доступ (логин / пароль перед сайтом)

Пока идёт тест, перед приложением показывается экран «Закрытый доступ».

**Выключить / включить в любой момент** — файл `public/site-lock.json`:

```json
{ "enabled": true, "hint": "…" }   // закрыто
{ "enabled": false, "hint": "…" }  // открыто всем
```

Закоммить и запушь — после деплоя флаг подхватится (без смены пароля).

**Логин / пароль по умолчанию** (можно сменить):

| | |
|---|---|
| Логин | `spotter` |
| Пароль | `floor-test-2026` |

Смена через `.env` / GitHub:

- `VITE_SITE_LOCK_USER` / `VITE_SITE_LOCK_PASSWORD`
- Repo **Variables:** `SITE_LOCK_USER`, `SITE_LOCK_ENABLED`
- Repo **Secrets:** `SITE_LOCK_PASSWORD`
- `VITE_SITE_LOCK_ENABLED=false` принудительно открывает сайт даже если JSON говорит `true`

Это soft-gate (пароль в бандле SPA). Для друзей на сервере нужен ещё **nginx Basic Auth** — см. [DEPLOY.md](DEPLOY.md). Не путать с регистрацией пользователей внутри Spotter.

## Деплой

**Friends beta (общий зал / профили):** VPS + Docker API + nginx — пошагово в [DEPLOY.md](DEPLOY.md).  
GitHub Pages ниже — только статический фронт без общей БД.

### 1) GitHub

Репозиторий пушится в GitHub; на каждый push в `main` GitHub Actions собирает сайт и выкладывает на **GitHub Pages**.

В репозитории:
1. **Settings → Pages → Build and deployment → Source:** GitHub Actions  
2. **Settings → Pages → Custom domain:** `spottergym.ru` (и `www.spottergym.ru` по желанию)  
3. Включи **Enforce HTTPS** когда сертификат появится  

### 2) DNS у регистратора домена

Записи (подставь свой GitHub-username):

| Тип | Имя | Значение |
|-----|-----|----------|
| `A` | `@` | `185.199.108.153` |
| `A` | `@` | `185.199.109.153` |
| `A` | `@` | `185.199.110.153` |
| `A` | `@` | `185.199.111.153` |
| `CNAME` | `www` | `tkdan06.github.io` |

Репозиторий: https://github.com/Tkdan06/spottergym  
Временный URL Pages: https://tkdan06.github.io/spottergym/ (после привязки домена редиректит на spottergym.ru)

### 3) Альтернатива: Vercel

Импорт репозитория на [vercel.com](https://vercel.com) → Custom Domain `spottergym.ru`. Уже лежит `vercel.json` для React Router.

### 4) Свой VPS (Nginx + API)

См. полный чеклист: [DEPLOY.md](DEPLOY.md). Кратко:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
npm ci && npm run build
# dist → /var/www/spottergym/dist, nginx: deploy/nginx.conf
```
