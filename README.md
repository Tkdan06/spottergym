# SPOTTER

Веб-приложение для знакомств и поиска тренировочных партнёров **в конкретных спортзалах**.

Mobile-first от **360px**, резиновая вёрстка до десктопа.

## Быстрый старт

```bash
npm install
npm run dev
```

Открой локальный URL Vite. Демо-вход: любой email/пароль на экране «Вход».

## Что уже есть

- Регистрация / вход / онбординг (город → зал → профиль → расписание → приватность)
- «Этаж зала»: кто в твоём клубе, кто сейчас на тренировке
- Каталог залов города и участники любого зала
- Профили: намерение (знакомства / партнёр / оба), интересы, слоты посещения
- Анонимный режим и статус «открыт к общению»
- Чаты с моделью request → accept
- Локальное сохранение сессии и переписки в `localStorage`

## Стек

React + TypeScript + Vite + React Router + Lucide

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

Это soft-gate для друзей (пароль в бандле SPA). Не путать с регистрацией пользователей внутри Spotter.

## Деплой

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

### 4) Свой VPS (Nginx)

```bash
npm ci && npm run build
# залей папку dist на сервер, пример конфига: deploy/nginx.conf
```
