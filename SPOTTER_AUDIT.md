# SPOTTER PRODUCT AUDIT

Дата аудита: 2026-08-28  
Репозиторий: `/Users/bogdantkac/Desktop/spotter`  
Правило этапа: **код не изменялся**. Ниже — карта системы и приоритизация.  
Если факт нельзя подтвердить из кода: `UNKNOWN / требует проверки`.

---

## 1. Executive Summary

1. **Spotter — два продукта в одном приложении:** социальный «зал + знакомства» и дневник тренировок. Нижняя навигация обслуживает только социальный продукт (`Мой зал / Залы / Чаты / Профиль`). Тренировки, активность, прогресс и AI спрятаны на два клика внутрь «Мой зал».

2. **Core loop знакомств работоспособен в коде:** зал → люди → профиль → лайк / запрос → принятие → чат. Главный продуктовый риск — холодный старт: после онбординга пол часто пустой, CTA «загляни позже / поделись ссылкой», без следующего социального шага.

3. **Core loop тренировок тоже собран:** запись → история → копирование → прогресс (7/30/90/180/365) → детерминированный инсайт. Петля обрывается: после сохранения нет обязательного пути в прогресс/следующую тренировку; AI-разбор **закрыт флагом `WORKOUT_RECAP_ADMIN_ONLY = true`**.

4. **Публичный журнал `/guide` обещает «анализ тренировок», а LLM-разбор недоступен обычным пользователям.** Это разрыв между SEO-обещанием и продуктом.

5. **Activity ≠ Workout в данных, но смешиваются в копирайте и в AI-промпте.** Чекин «Я в зале» пишет `CheckIn`. Дневник пишет `WorkoutSession`. На экране активности пустое число сессий подписано «Пока без тренировок». В GigaChat weekly insight в JSON кладётся `activity.visits / totalMinutes` из чекинов.

6. **Упражнения не канонизируются.** Идентичность = `trackKey` (UUID на карточке) или нормализованная строка имени (`trim + lower + ё→е`). «Жим лёжа» и «Жим штанги на горизонтальной скамье» — разные упражнения. Прогресс и PR по синонимам разъезжаются.

7. **AI-экономика сейчас почти не бьёт по пользователям** (admin-only), но контур опасный: GigaChat вызывается с `rejectUnauthorized: false`, генерация лимитируется in-memory по IP (1/мин) + unique per period, стоимости в рублях в коде нет.

8. **Самый сильный security-зазор для продукта:** любой залогиненный пользователь может запросить `GET /gyms/:gymId/people` **без членства в зале** и получить карточки всех участников (фото, bio, intent, lookingToMeet, Instagram-поля в сериализации карточки). Каталог залов ещё и публичный (без auth).

9. **Продуктовая аналитика почти только лендинг.** `LandingEvent` закрывает `/lp` + регистрацию. In-app события (чекин, первая тренировка, лайк, запрос, принятие, AI) не пишутся. Админка считает DAU/MAU/retention по `lastSeenAt`, не по ценности.

10. **Frontend — один большой CSR-бандл.** `App.tsx` статически импортирует все страницы, включая админку. `React.lazy` нет. SEO-страницы получают prerender meta/JSON-LD, тело статей — после JS.

11. **Онбординг позволяет пропустить зал.** Тогда «Мой зал» — empty state «Выбрать зал». First value moment (люди рядом / чекин) откладывается.

12. **Дубли каталога залов:** `src/data/gyms.json` в клиенте + `api/prisma/data/gyms.json` / seed. Риск рассинхрона карточек и поиска.

13. **Rate limit — in-memory Map на одном процессе Node.** Не шарится между инстансами; при нескольких воркерах лимиты AI/auth ослабевают. `UNKNOWN / требует проверки`, сколько процессов в проде.

14. **Медиа публичны по URL** (`GET /media/:userId/:file` без auth). Имена файлов `uuid8_sha256-16`, полный перебор маловероятен, но URL из профиля читается кем угодно.

15. **UI-kit существует и живой** (`/app/admin/ui`, токены в `global.css`). На пользовательских экранах всё равно есть локальные дубли (кнопки чекина, strip прогресса, empty copy).

16. **Доступность ключевых действий частичная:** есть `aria-label` у колокольчика, навигации, копирования тренировки, sheet чекина. Часть CTA — иконки без видимого текста. Контраст lime-on-dark `UNKNOWN / требует проверки` инструментально.

17. **Метрики retention в админке измеримы, activation funnel — нет.** Можно посчитать D1/D7/D30 по `lastSeenAt` и отдельно first check-in / first workout SQL-ом. Нельзя из кода узнать, дошёл ли пользователь «зал → люди → запрос» без ручных запросов к таблицам.

18. **20% проблем с 80% эффекта:** (1) вынести тренировки в IA, (2) закрыть cold-start зала, (3) связать workout→progress→next, (4) не смешивать Activity и Workout, (5) либо открыть AI с квотой, либо убрать обещание из SEO, (6) членство на `/people`, (7) in-app события, (8) lazy-бандл, (9) канон упражнений, (10) TLS GigaChat.

---

## 2. Current Architecture

### 2.1 Стек (из кода, не из догадок)

| Слой | Факт |
| ---- | ---- |
| Frontend framework | React 19 + Vite 8 |
| Routing | react-router-dom 7, `BrowserRouter`, CSR |
| State | `AppProvider` / `AppContext` (нет Redux/Zustand) |
| UI kit | CSS-токены + классы `.btn`, `.surface`, sheets; living kit `/app/admin/ui`; lucide-react |
| Styling | `src/styles/global.css`, `color-themes.css`, `sheets.css`, per-page CSS |
| Backend | Hono 4 + `@hono/node-server` (не Express) |
| API architecture | REST JSON под префиксом `/api/` (nginx `proxy_pass` срезает `/api`) |
| Database | PostgreSQL (`DATABASE_URL`) |
| ORM | Prisma 6 |
| Auth | JWT HS256 (`jose`), cookie `spotter_session` httpOnly + SameSite Lax + Bearer/`X-Spotter-Token`; `tokenVersion` инвалидирует сессии |
| Authorization | `requireAuth`; админка `resolveAdminFlags` + granular `adminPermissions`; AI recap — `userCanUseWorkoutRecap` |
| SEO | `src/seo/pages.json` + `SeoHead` + `scripts/prerender-seo.mjs` после `vite build` |
| Analytics | Свой `/analytics/lp` → `LandingEvent`; админские агрегаты; **нет** GA/Metrika/Mixpanel/Posthog в зависимостях |
| Storage | Фото на диск `api/data/media` (`MEDIA_ROOT`); пути `/api/media/:userId/:file` |
| Images | data-URL → файл; magic-byte sniff; SmartImage на клиенте |
| Caching | Cache-Control media 7d immutable; insight/coach rows в Postgres; in-memory GigaChat OAuth token; prerender HTML |
| Background jobs | `startWorkoutReminderLoop`, `startBroadcastLoop`; expire check-ins на authenticated запросах |
| Rate limiting | In-memory middleware + nginx `limit_req_zone` (auth 20r/m, api 120r/m, analytics 60r/m) |
| Error handling | Hono `onError` → 500 JSON; `OpsFault` для админ-борда; клиентские `feedback-error` / SoftLoader |
| External services | GigaChat (Sber), Sendsay (email reset), Web Push VAPID |
| AI | GigaChat chat completions; три продукта: coach letter, weekly insight, monthly insight |
| Deploy | nginx `deploy/nginx.conf` → static `dist` + API `127.0.0.1:3001`; Docker API `UNKNOWN / требует проверки` по compose в проде |
| Env | `api/src/env.ts`: `JWT_SECRET`, `DATABASE_URL`, `MASTER_ADMIN_EMAIL`, `CORS_ORIGIN`, VAPID, Sendsay, GigaChat |

### 2.2 Карта маршрутов

**Публичные**

| Route | Страница | Назначение |
| ----- | -------- | ---------- |
| `/` | WelcomePage | Гостевой вход в продукт |
| `/login` | LoginPage | Вход |
| `/register` | RegisterPage | Регистрация |
| `/forgot-password` | ForgotPasswordPage | Запрос сброса |
| `/reset-password` | ResetPasswordPage | Сброс по token query |
| `/lp` | LandingPage | Рекламный лендинг знакомств |
| `/lp-coaches` | LandingCoachesPage | Лендинг для тренеров |
| `/guide` | GuideIndexPage | Журнал (хаб) |
| `/guide/workouts` | WorkoutsGuideHubPage | Хаб «Тренировки» |
| `/guide/workouts/:article` | WorkoutsGuideArticlePage | Статьи дневника/прогресса/плато/активности/партнёра/анализа |
| `/guide/partner-po-trenirovkam` | Navigate → `/guide/workouts` | Старый URL |
| `/guide/:slug` | GuideArticlePage | Статья знакомств (`znakomstva-v-zale`) |
| `/terms` | TermsPage | Соглашение |
| `/onboarding` | OnboardingPage | 5 шагов после регистрации (не GuestOnly, не /app) |

**Приложение `/app` (ProtectedRoute: нужен user + `onboardingDone`)**

| Route | Страница | Назначение |
| ----- | -------- | ---------- |
| `/app` | HomePage | Мой зал: чекин, люди, вход в тренировки/активность |
| `/app/discover` | DiscoverPage | Каталог залов |
| `/app/gym/:gymId` | GymDetailPage | Карточка зала, вступить/дом, люди |
| `/app/user/:userId` | UserProfilePage | Чужой/свой профиль, лайк, запрос |
| `/app/messages` | MessagesPage | Инбокс + входящие запросы |
| `/app/messages/:conversationId` | ChatPage | Переписка |
| `/app/profile` | ProfilePage | Свой профиль |
| `/app/invite` | InviteCirclePage | Мой круг / рефералы |
| `/app/activity` | ActivityPage | График чекинов |
| `/app/workouts` | WorkoutsPage | Дневник |
| `/app/workouts/new` | WorkoutEditorPage | Новая запись |
| `/app/workouts/:id` | WorkoutEditorPage | Просмотр/редактирование |
| `/app/workouts/:id/edit` | WorkoutEditorPage | То же |
| `/app/workouts/progress` | WorkoutsProgressPage | Прогресс + recap (admin) |
| `/app/workouts/coach` | WorkoutsCoachPage | Redirect → progress `#week-recap` |
| `/app/likes` | LikedPage received | Кому я нравлюсь |
| `/app/likes/sent` | LikedPage sent | Кого я лайкнул |
| `/app/feedback` | FeedbackPage | Поддержка |
| `/app/feedback/:ticketId` | FeedbackPage | Тикет |
| `/app/notifications` | NotificationsPage | Уведомления |
| `/app/install` | InstallGuidePage | PWA / на домашний экран |
| `/app/settings` | SettingsPage | Настройки, залы, приватность, расписание |
| `/app/admin/*` | Admin* | Операционка (права) |
| `/app/admin/ui` | UiKitPage | Living UI kit |
| `*` внутри /app | NotFoundPage | 404 клиентский |

**Нижняя навигация (только 4 пункта):** Мой зал → Залы → Чаты → Профиль.

### 2.3 API surface (монтирование)

`/health`, `/admin/emergency-recover`  
`/analytics`, `/media`, `/auth`, `/me` (+ workouts), `/users`, `/gyms`, `/likes`, `/notifications`, `/push`, `/tickets`, `/conversations`, `/blocks`, `/admin`

---

## 3. Feature Inventory

### Social

| Функция | Статус | Entry |
| ------- | ------ | ----- |
| Мой зал | Есть | Bottom nav `/app` |
| Я в зале (check-in) | Есть | `CheckInControl` на полу; 3ч + 2×1ч extend; membership required |
| В зале (presence) | Есть | `isActive` / `expiresAt`; пол + карточки |
| Люди из зала | Есть | Home + GymDetail `useGymPeople` → `GET /gyms/:id/people` |
| Открыт к знакомству | Есть | `lookingToMeet`; UI профиль; API блокирует новый чат если false (кроме админа) |
| Лайки | Есть | toggle `POST /likes/:userId/toggle`; список received/sent |
| Кого я лайкнул | Есть | `/app/likes/sent` с профиля |
| Chat requests | Есть | pending Conversation; accept на `/conversations` |
| Чаты | Есть | `/app/messages`; pin/hide; unread badge |
| Профили | Есть | `/app/user/:id`; фото, bio, sports, coach, schedule, gyms |
| Расписание | Есть | `visitSlots` JSON; онбординг + settings + schedule sheet |
| Анонимный режим | Есть | `privacy = anonymous`; имя скрыто; поиск по @username остаётся |
| Перерыв / отпуск | Есть | `breakUntil`; чекин сбрасывает; стикер на карточке |
| Мой круг | Есть | `/app/invite`; Invite + `referralCreditedCount` |
| Блок | Есть | SafetyActions → `/blocks` |
| Поиск людей | Есть | username search `/users/search` (discover? settings? Messages search — инбокс) |
| Instagram | Есть | опциональный handle в профиле |

### Gyms

| Функция | Статус |
| ------- | ------ |
| Поиск залов | Discover + onboarding; клиентский `gymSearch` + API `q`/`city`/`elsewhere` |
| Выбор / несколько залов | `UserGym` M2M; homeGymId |
| Добавление зала в каталог | Пользователь не создаёт Gym; CTA «запросить» → feedback `?topic=gym` |
| Текущий / домашний | `homeGymId`; чекин ставит home на этот зал |
| Сети / города | Каталог JSON + Postgres Gym |

### Training

| Функция | Статус |
| ------- | ------ |
| Запись тренировки | `/app/workouts/new`; 1–10 упражнений, 1–6 сетов, вес 1–300, reps 0–1000 |
| История | список + cursor pagination; cap **600** сессий |
| Копирование | navigate new + `copyFromId` |
| Прогресс / графики / периоды | `/app/workouts/progress`; 7/30/90/180/365 |
| Личные рекорды | `insights.prs` в progress payload |
| Feedback «как прошло» | easy/normal/hard на сессии |
| Body weight | опционально на сессии |
| Детерминированный инсайт | `deriveProgressInsight` на клиенте, без LLM |

### Activity

| Функция | Статус |
| ------- | ------ |
| Check-in / время в зале | CheckIn + expiresAt |
| История / неделя / месяц | `/app/activity` через `GET /me/activity?range=` |
| Сброс дня / всей активности | API `me-activity-reset`, `me-activity-day` |
| Heartbeat lastSeen | `POST /me/heartbeat` |

### AI

| Функция | Статус |
| ------- | ------ |
| Weekly GigaChat insight | `/me/workouts/insight/generate` — **admin-only** |
| Monthly insight | `/me/workouts/monthly/generate` — **admin-only** |
| Coach letter | `/me/workouts/coach/generate` — **admin-only** |
| Кэш результата | `WorkoutAiInsight` unique (user, kind, periodStart); `WorkoutCoachReport` unique (user, periodStart) |
| Viewed / rec click | patch viewedAt, recommendationClickedAt |
| Стоимость ₽ | **нет в коде** — только prompt/completion tokens |
| Пользовательский «анализ» без LLM | progress insight copy |

### Profile / settings / other

Фото (до лимита PHOTO_MAX), bio, sports, coach flag, privacy, lookingToMeet, notifications prefs, push, install PWA, feedback tickets, demo@demo.ru локальный режим, emergency shutdown.

### SEO

Журнал `/guide` + workouts hub (6 статей), sitemap, robots, canonical, OG, Article/CollectionPage schema, prerender, 301 старого partner URL.

---

## 4. User Journeys

### Journey A — новый пользователь

```
Welcome `/` или `/lp` или `/guide`
→ Register
→ Onboarding (Город → Зал [можно пропустить] → О себе → Расписание → Приватность)
→ `/app` Мой зал
→ Я в зале
→ Люди → UserProfile → Request
```

| Шаг | Friction / gap |
| --- | -------------- |
| Welcome vs /lp vs /guide | Три входа с разным обещанием (знакомства / зал / дневник). Трекинг только landing events на `/lp`, `/guide` CTA register, register_view/success. Welcome `UNKNOWN` полный набор trackLanding. |
| Register | Email+пароль; 409 раскрывает существование email. Indexed в sitemap. |
| Onboarding skip gym | Законный путь без зала → empty floor. First value не случился. |
| Мой зал empty people | «Пока никого по этому фильтру» + шаринг инвайта. Нет CTA «заполни профиль / отметься». Фильтры видны на пустом списке. |
| Я в зале | Нужен зал в профиле; GPS нет (honor system). После чекина список людей не refetch сразу (merge local) — ок. Если в зале 0 других — тупик. |
| Request | Нужен `lookingToMeet` у цели. Greeting default. Pending: инициатор не пишет второе сообщение. |

**Missing:** явный success «ты в зале, вот кто рядом»; онбординг не требует фото; нет события activation.

### Journey B — тренировки

```
Мой зал → Тренировки (`entry-link`, не tab)
→ Записать
→ Exercise / sets / save
→ History
→ Progress (strip только если есть highlight)
→ AI analysis (для обычного пользователя отсутствует)
```

| Шаг | Friction / gap |
| --- | -------------- |
| Вход | 2 клика с таба «Мой зал»; нет пункта в bottom nav |
| Empty history | CTA «Записать» сверху есть; empty copy говорит про прогресс, не ведёт на guide |
| Save | haptic; возврат в список. Нет «открыть прогресс» / «повторить» как следующего экрана |
| Progress | тяжёлый экран графиков; recap скрыт |
| AI | `/workouts/coach` редирект; generate 403 для non-admin |
| Exercise names | свободный ввод, нет каталога/алиасов |

### Journey C — знакомства

```
Мой зал → Люди → Profile → Like / Request → Acceptance → Chat
```

Путь в коде цельный. Разрывы: пустой пол; like не создаёт запрос (два разных действия); incoming request живёт в Чатах (badge), легко пропустить если не открывать таб; аноним + закрытый lookingToMeet = карточка без чата.

### Journey D — возвращение

```
Login → Мой зал → Activity и/или Training → Progress → AI
```

Login GuestOnly если уже onboarded → `/app`. Нет «resume last workout» / «ты был в зале вчера». Activity и Workouts — соседние ссылки на полу, но визуально похожие графики с разной семантикой. AI снова мёртв.

---

## 5. UX Problems

1. **Тренировочный продукт невидим в IA.** Пользователь мышления «дневник» не находит таб.
2. **Cold-start зала:** empty people без сильного следующего шага кроме инвайта.
3. **Онбординг skip gym** откладывает ценность.
4. **Терминология «тренировка»** на экране активности (чекины).
5. **После save workout** нет мостика в прогресс, если highlight strip не появился (первая запись).
6. **Лайк vs запрос** — два социальных действия без объяснения, зачем лайк, если чат = request.
7. **Фильтры пола/возраста/уровня на пустом зале** выглядят как «никого нет из‑за фильтра», хотя никого нет вообще.
8. **AI в SEO и в progress UI (admin)** создаёт ожидание, которого нет.
9. **Welcome / LP / Guide** дублируют value prop без единой activation story.
10. **Check-in disabled «Сначала выбери зал»** без кнопки на discover (на самом CheckInControl).
11. **Мой круг / инвайт** слабо связан с пустым полом (есть кнопка, нет объяснения «без людей зал мёртвый»).
12. **600 workout cap** показан баннером — сюрприз для power user, нет экспорта.
13. **Demo account** отдельная вселенная (mock people) — риск QA vs prod.
14. **Notifications и Settings** спрятаны иконками на профиле/зале — ок, но install PWA ещё глубже.

---

## 6. IA Problems

```
Bottom nav:  Мой зал | Залы | Чаты | Профиль
Hidden:      Тренировки, Активность, Прогресс, AI, Лайки, Круг, Саппорт
```

- **Дублирование «зал»:** таб «Залы» = каталог; «Мой зал» = floor. Имена близкие, роли разные.
- **Связанные функции разбросаны:** чекин (зал) vs время (Активность) vs упражнения (Тренировки) vs графики (Прогресс).
- **Глубина:** first workout = Мой зал → Тренировки → Записать (3 экрана). First chat = Мой зал → карточка → профиль → запрос (3–4).
- **Профиль** — и социальная витрина, и хаб настроек/лайков/круга.
- **Админка** висит в том же `/app` дереве — нормально за флагом, но раздувает бандл.

Соответствие пользовательскому мышлению: «Я в зале» совпадает. «Активность» легко читается как тренировки. «Прогресс» ожидаемо про веса, но вход неочевиден.

---

## 7. Data Problems

### 7.1 Сущности

**User** — Postgres `User`. Создаёт: register. Изменяет: `/me` PATCH, check-in (homeGym, breakUntil), admin. Читают: self, public serializers, gym people, chat. Unique: email, username. Nullable: homeGymId, breakUntil, deletedAt, adminPermissions. FK: gyms via UserGym.

**Gym** — id string (не cuid), seed из JSON. Пользователь не создаёт. Unique id.

**UserGym** — PK (userId, gymId). Несколько залов ок.

**CheckIn** — user+gym; open row `checkedOutAt null`; expiresAt; extendCount. Нет уникального «один открытый на пользователя» в схеме (обеспечивается транзакцией checkout-all + create).

**WorkoutSession** — userId, title, performedAt, bodyWeightKg?, notes, feedback?. Index (userId, performedAt desc).

**WorkoutExercise** — name + trackKey default "". Нет FK на справочник упражнений. **Нет unique (session, name).**

**WorkoutSet** — weightKg Decimal, reps Int.

**WorkoutAiInsight / WorkoutCoachReport** — кэш LLM; unique period.

**Like** — unique (from, to). Нет match-entity; чат ортогонален.

**Conversation** — pair (userLow, userHigh) unique; status pending/accepted.

**ChatMessage** — text; status sent/delivered/read.

**LandingEvent** — анонимная воронка.

**Invite** — inviteeId unique.

**Notification / Prefs / Push / Tickets / Blocks / PasswordReset / OpsFault / AdminBroadcast / BlockedEmail / BlockedIp / SystemSetting.**

**Activity** — не отдельная таблица; агрегация CheckIn.

**Progress** — не таблица; считается из WorkoutSession (+ опционально activity stats).

### 7.2 Консистентность

- `referralCreditedCount` кэшируется, должен синкаться attach/onboard/delete.
- `homeGymId` может не входить в UserGym при гонке `UNKNOWN / требует проверки` (check-in требует membership; leave gym логика в me-gym-leave).
- Чекин без GPS — данные «присутствия» не верифицированы.
- Мягкое удаление: чаты сохраняются, профиль анонимизируется.
- Два каталога gyms.json.
- `trackKey` пустой на легаси → fallback имени; переименование упражнения с тем же trackKey сохраняет ряд; новое имя без ключа = новый ряд.
- Progress/AI могут смешать check-in минуты с силовым прогрессом в одной букве.

### 7.3 Идентичность упражнения (п.10 брифа)

Текущее правило (`api/src/lib/workouts.ts`):

- `normalizeExerciseName`: trim, lower, `ё→е`, схлопнуть пробелы.
- `exerciseIdentity`: если есть `trackKey` → `k:{key}`, иначе `n:{normalizedName}`.
- Клиент выдаёт новый UUID trackKey на каждую новую карточку в редакторе.

Система **не понимает**, что «Жим лёжа», «Жим штанги лёжа» и «Жим штанги на горизонтальной скамье» — одно движение, **кроме случая**, когда пользователь копирует тренировку и тот же `trackKey` переносится. Синонимы, введённые вручную, дробят PR, графики и инсайты.

---

## 8. AI Problems

### Endpoints (все под `/me`, `requireAuth` на me routes)

| Method | Path | Кто | Лимит |
| ------ | ---- | --- | ----- |
| GET | `/workouts/coach` | recap-admin | 60/мин IP |
| POST | `/workouts/coach/generate` | recap-admin | **1/мин IP** |
| GET/POST | `/workouts/insight`, `.../generate` | recap-admin | 60 / **1** |
| PATCH | `insight/viewed` | recap-admin | 20 |
| GET/POST | `/workouts/monthly`, generate | recap-admin | 60 / **1** |
| PATCH | monthly viewed / rec-click | recap-admin | 20 |

Флаг: `WORKOUT_RECAP_ADMIN_ONLY = true` в **двух местах** (client + `workoutRecapAccess.ts`). Сервер отклоняет 403.

Ownership: userId из сессии. Чужие workout id в generate не передаются — модель видит только свои сессии. Прямой вызов API с украденной сессией = свои данные.

Квота периода: unique `(userId, kind, periodStart)` / `(userId, periodStart)` для coach. Повтор generate в том же окне: cached / exists / busy. Parallel: `claimInsightPeriod` pending row, P2002 → busy.

Cooldown: `nextAt` = конец периода (календарное окно, не секунды). IP 1/min дополнительно.

Стоимость: токены пишутся в строку; **рубли/USD UNKNOWN** (зависит от тарифа GigaChat PERS). Нет budget cap, нет per-user spend.

Кэш: да, повторное чтение GET без LLM. Hash входа `inputHash`; смена фактов в том же period — поведение зависит от exists vs regenerate `UNKNOWN` детально для «данные изменились внутри недели» (exists блокирует повтор, пока period тот же).

Demo email: отдельные ветки `demo@demo.ru`.

**Abuse, если флаг снять:** любой авторизованный с 2+ тренировками и «сигналом» может дергать GigaChat. Защита: 1/min/IP (NAT зала = коллизия), unique period, eligibility, in-memory limiter, admin flag. Нет очереди, нет глобального $ cap, нет per-user daily cap кроме period unique.

**Смешение Activity:** `insightsForModel` добавляет `activity: { visits, totalMinutes }` из check-in статистики в промпт weekly insight.

**TLS:** `gigachat.ts` `rejectUnauthorized: false` — MITM к OAuth и chat (credentials + workout JSON).

**Прямой вызов:** да, если есть JWT и isAdmin (сейчас). CSRF: cookie SameSite Lax, API same-origin через nginx; классический cross-site POST с cookie ограничен Lax.

---

## 9. Security Problems

Формат finding как в брифе.

---

**Severity:** High  
**Location:** `api/src/routes/gyms.ts` `GET /:gymId/people`  
**Attack scenario:** Залогиненный пользователь (в т.ч. только что зарегистрированный, без членства) перебирает gymId и выгружает всех участников зала: фото-URL, bio, intent, lookingToMeet, sports, check-in presence.  
**Impact:** Скрейпинг базы знакомств, stalking, обход продуктовой модели «видишь людей своего зала».  
**Recommended fix:** Требовать UserGym membership (или хотя бы тот же city + явное product-решение); пагинация; rate limit жёстче; не отдавать полный список.

---

**Severity:** High  
**Location:** `api/src/lib/gigachat.ts` `rejectUnauthorized: false`  
**Attack scenario:** MITM между API и Sber (корпоративный прокси, ложный DNS). Кража `GIGACHAT_CREDENTIALS`, чтение промптов с тренировками пользователей.  
**Impact:** Утечка PII + компрометация ключа провайдера, финансовый расход.  
**Recommended fix:** Включить проверку TLS; pin/CA; не отключать verify в проде.

---

**Severity:** Medium  
**Location:** `GET /media/:userId/:file` без auth  
**Attack scenario:** URL из профиля или утечка; CDN/referrer. Перебор имён сложен (uuid+hash).  
**Impact:** Фото доступны без сессии (часто ок для «публичного профиля», но нет hotlink policy).  
**Recommended fix:** Подписанные URL или auth для anonymous-режима; отдельная политика для anonymous users.

---

**Severity:** Medium  
**Location:** `persistAvatar` принимает любой `isMediaPath` без проверки владельца  
**Attack scenario:** PATCH `/me` `avatar: /api/media/<victim>/<file>` — чужое фото как аватар.  
**Impact:** Подмена аватара, путаница/репутация; не чтение чужого диска сверх уже публичного URL.  
**Recommended fix:** Тот же owner prefix, что в `persistPhotoList` (список фото уже режет чужой prefix).

---

**Severity:** Medium  
**Location:** `POST /auth/logout` не вызывает `bumpTokenVersion`  
**Attack scenario:** Украденная cookie остаётся валидной до 30 дней после «выхода». Смена пароля / reset bump делают.  
**Impact:** Logout не отзыв сессии.  
**Recommended fix:** Инкремент `tokenVersion` на logout или server-side session denylist.

---

**Severity:** Medium  
**Location:** `POST /analytics/lp` принимает клиентский `userId` без сверки с сессией  
**Attack scenario:** Подмена атрибуции лендинга на чужой user id.  
**Impact:** Искажение админ-воронки, не чтение чужих данных.  
**Recommended fix:** Игнорировать клиентский userId или брать только из JWT.

---

**Severity:** Low (если включён как «дверь для своих») / High если считать защитой  
**Location:** `VITE_SITE_LOCK_USER` / `VITE_SITE_LOCK_PASSWORD` в JS-бандле (`src/config/siteLock.ts`)  
**Attack scenario:** Любой, кто скачал бандл, знает логин/пароль soft-gate. Код сам помечает это.  
**Impact:** Обход site lock; API за ним не защищён этим gate.  
**Recommended fix:** Не использовать как auth; в проде держать `enabled: false`.

---

**Severity:** Medium  
**Location:** `GET /gyms` без `requireAuth`  
**Attack scenario:** Анонимный скрейпинг каталога залов (id, координаты, адреса).  
**Impact:** Низкий для каталога; усиливает перебор people, если gym ids публичны (они в клиентском JSON и так).  
**Recommended fix:** Оставить публичным сознательно или auth+cache.

---

**Severity:** Medium  
**Location:** Register 409 «аккаунт уже есть»; login rate 20/min/IP  
**Attack scenario:** Email enumeration; credential stuffing с разных IP.  
**Impact:** Privacy email; brute force ослаблен nginx 20r/m + API 20/min.  
**Recommended fix:** Унифицировать ответы register; аккаунт lockout `UNKNOWN`; 2FA нет.

---

**Severity:** Medium  
**Location:** In-memory `rateLimit`  
**Attack scenario:** Несколько Node-процессов / рестарт сбрасывает вёдра; AI generate 1/min не глобален.  
**Impact:** Обход квот при горизонтальном масштабе.  
**Recommended fix:** Redis/Postgres limiter.

---

**Severity:** Low–Medium  
**Location:** JWT 30d в cookie; XSS → кража если когда-либо окажется не httpOnly (сейчас httpOnly true). Token также принимается из `Authorization` / `X-Spotter-Token`.  
**Attack scenario:** XSS в будущем = session. Сейчас `dangerouslySetInnerHTML` не найден.  
**Impact:** Захват аккаунта.  
**Recommended fix:** CSP уже в nginx; держать httpOnly; не возвращать JWT в localStorage (сейчас SESSION_FLAG без сырого token — хорошо).

---

**Severity:** Low  
**Location:** CSRF  
**Attack scenario:** Cross-site POST с cookie. SameSite Lax блокирует большинство.  
**Impact:** Ограничен.  
**Recommended fix:** Origin check на state-changing; CSRF token если появятся cookie-only формы.

---

**Severity:** Low (при текущем Prisma)  
**Location:** `$queryRaw` в admin analytics / referral / softDelete  
**Attack scenario:** SQLi если когда-нибудь интерполируют user input. Сейчас шаблоны выглядят статичными.  
**Impact:** DB compromise.  
**Recommended fix:** Только Prisma tagged templates / параметризация.

---

**Severity:** Info / process  
**Location:** `MASTER_ADMIN_EMAIL`, JWT, GigaChat, VAPID, Sendsay в env  
**Attack scenario:** Утечка `.env` / логи.  
**Impact:** Full compromise.  
**Recommended fix:** Secrets manager; не логировать credentials. Прод-проверка значений: `UNKNOWN / требует проверки`.

---

**IDOR workouts/chats:** get/patch/delete session и messages проверяют userId/participant — выглядит корректно.

**Privilege escalation:** обычный register не ставит isAdmin; master только по env email. PATCH admin flags через `/admin/users/:id/admin` с permission.

**XSS:** React escape + sanitizeChatText. Markdown HTML нет.

**SQL injection:** Prisma ORM на основных путях.

**Файлы:** magic bytes, size cap ~3.5MB, userId sanitized in path.

---

## 10. SEO Problems

| Тема | Факт |
| ---- | ---- |
| Sitemap | `public/sitemap.xml` — home, lp, lp-coaches, guide + workouts articles, register, terms. Login нет (хорошо). |
| robots.txt | Allow `/`, `/lp`, `/guide`, `/register`, **Allow `/login`**; Disallow `/app`, onboarding, forgot/reset. **Конфликт:** pages.json login `index: false`, robots Allow. |
| Canonical | SeoHead + prerender; без trailing slash. www→apex 301. |
| Title/description | Заданы в pages.json, уникальны для journal. |
| H1 | Public pages: h1 в контенте + prerender. App pages noindex via robots Disallow /app. |
| Breadcrumbs | Journal workouts + dating article; schema BreadcrumbList через prerender `UNKNOWN` полнота для всех URL — pages имеют schemaType Article/CollectionPage. |
| Internal links | In-text в workouts articles (после недавней работы). Dating journal относительно тонкий. |
| Orphan | `/lp-coaches` в sitemap; внутренние ссылки с guide `UNKNOWN` полнота. |
| Duplicate | `/` vs `/lp` близкие value prop. `/guide/partner-po-trenirovkam` 301. |
| Query params | Clean-param utm/from/invite. |
| Indexability | CSR: crawler без JS видит prerender shell, не обязательно полный article DOM как в React. |
| noindex | login index:false; /app disallow. Soft 404: nginx `try_files ... /index.html` → **HTTP 200** + клиентский NotFound. |
| Redirects | partner 301; www 301. HTTP→HTTPS: закомментировано «after certbot» — **прод UNKNOWN**. |
| OG | og images для workouts; `og:type` article на journal. |
| Structured data | Article/CollectionPage; FAQ JSON-LD снимается с non-home prerender (по прошлому знанию кода). |
| Image alt | Guide OG и контент частично; залы — зависит от GymCard. |
| SSR/SSG/CSR | **CSR + prerender meta.** Не полноценный SSR статей. |
| Робот vs обещание | Статьи про «анализ тренировок» описывают продукт, LLM которого нет у пользователя. |

---

## 11. Performance Problems

1. **Нет code splitting:** все pages в одном graph `App.tsx`. Админка, guide, workouts editor грузятся всем.
2. **Мой зал:** `GET /gyms/:id/people` отдаёт **всех** членов зала одним куском (N пользователей × поля фото). Крупный зал = тяжёлый JSON. Poll 45s.
3. **Boot AppContext:** Promise.all likes + notifications + prefs + tickets + blocks + conversations — лишние tickets на каждом визите. Затем повтор inbox ~800 ms (`hydrateSocial` + `refreshInbox`). Пока приложение открыто: inbox **каждые 12 с**, likes **45 с**, heartbeat **60 с**.
3b. **`getWorkoutProgress`:** до **600 сессий** с nested exercises/sets на каждый запрос прогресса.
4. **Workouts hub:** параллельно list + progress(30).
5. **N+1:** people endpoint groupBy likes + referral map — относительно ок; list conversations потом users by ids — ок. Admin users list может быть тяжёлым `UNKNOWN` без пагинации на всех админ-ручках.
6. **Индексы:** CheckIn, WorkoutSession (user, performedAt), Conversation pair — есть. User search `contains` username/name — seq scan на росте.
7. **Картинки залов:** крупные jpg в `public/images/gyms` (git status) без обязательного lazy на всех поверхностях — SmartImage есть, но вес файлов `UNKNOWN` без замера.
8. **Шрифты:** три @fontsource семейства.
9. **Rate limit map** до 20k ключей в процессе.
10. **GigaChat** синхронно на request; блокирует worker на время LLM.
11. **gyms.json в бандле клиента** дублирует API каталог.
12. **Rerenders:** широкий AppContext — любой likes/conversations update перерисовывает дерево. Не мемоизирован селекторами.

Мой зал / Тренировки / Прогресс — самые тяжёлые пользовательские поверхности: people dump, progress analytics на сервере по всем сессиям периода, progress UI большой.

---

## 12. UI Kit Problems

Есть канон: `--accent #c8f542`, `--radius 16/10/24`, Unbounded/Syne/Onest, `.btn` / `.btn-primary` / `.btn-soft` / `.btn-sm`, chips, sheets, SoftLoader, SoftFlash, SectionTitle, SubpageHeader.

Дубли и drift:

- `shortGymName` скопирован HomePage + CheckInControl.
- Кнопки чекина vs `.btn-primary` лендинга vs `entry-link` (карточки-ссылки как кнопки).
- Progress strip vs entry-tools vs UserCard CTA.
- Empty states: разные `.empty-copy` vs `.workouts-empty` vs `.activity-empty` vs `.home-empty-floor`.
- Period tabs общие `PERIOD_TABS`, но графики Activity и Progress визуально родственны при разной семантике — путаница.
- Иконки lucide vs кастом Instagram.
- Welcome и LP почти один паттерн hero+CTA.

Inconsistent spacing/radius: kit задаёт токены; локальные `calc(var(--radius) + 4px)` на лендинге. Не критично vs IA.

---

## 13. Analytics Gaps

**Что есть**

- Landing: `view`, `scroll_50/90`, `cta_register`, `cta_login`, `register_view`, `register_success` + UTM/search attribution в `LandingEvent`.
- Admin: users, onboarded, photos, DAU/MAU (`lastSeenAt`), checkedInToday, activeNow, retention D1/3/7/14/30/60 по lastSeen, geography, tickets, ops, password resets, landing dashboard, referrals.
- AI: viewedAt, recommendationClickedAt (почти никто не юзает).
- Workout feedback/felt timestamps.

**Чего нет (критично)**

| Событие | Gap |
| ------- | --- |
| registration (кроме landing success) | нет product event bus |
| gym selection / onboarding complete | только флаг `onboardingDone` |
| profile completion (фото/bio) | нет |
| first check-in | таблица CheckIn, нет event |
| profile view | нет |
| like / unlike | нет |
| request / accept | нет |
| first message | нет |
| first workout / exercise added | нет |
| progress viewed | нет |
| AI requested/viewed (user) | только admin rows |
| return / session | heartbeat lastSeen, нет |

Третьи пиксели не подключены.

### Product metrics measurability

| Метрика | Можно сейчас? |
| ------- | ------------- |
| Activation | Частично: register count, onboarded %, homeGym not null SQL |
| D1/D7/D30 | Да, но по lastSeen, не по ценности |
| First value moment | Не определён продуктом; SQL first CheckIn vs first Workout vs first Conversation |
| Gym selection conversion | Онбординг skip не логируется |
| First check-in / workout / social / chat | SQL по таблицам, нет воронки в продукте |
| Training retention | WorkoutSession dates |
| AI adoption | ~0 из-за admin-only |
| Feature adoption | Угадывание по наличию строк |

---

## 14. Dead Ends

| Место | Что происходит | Почему тупик | Связать с |
| ----- | -------------- | ------------ | --------- |
| Мой зал без людей | Чекин + пустой список | Некого лайкать, не с кем чат | Инвайт, расписание «кто обычно здесь», guide, заполнить фото |
| Мой зал без зала | Empty floor | Нет чекина/людей | Discover (уже есть CTA) — ок; skip onboarding усиливает |
| Workout saved | Возврат в историю | Нет «что дальше» | Progress, copy next, recap |
| Workouts empty | Copy про прогресс | Progress недоступен без данных; strip скрыт | Оставить CTA записывать (уже есть сверху) |
| Progress empty | «Пока пусто», **нет кнопки** на `/app/workouts/new` | Нарушает правило UI kit «empty = один CTA» | Записать тренировку |
| Профиль удалённого | Текст «открой в чатах» без Link | Надо угадать Чаты | `/app/messages` |
| Progress без AI | Графики | Пользователь долистал и вышел | Next workout CTA, детерминированный инсайт крупнее |
| `/workouts/coach` | Redirect | Старый вход в никуда нового | Убрать из ментальной модели |
| Activity с данными | График чекинов | Нет моста к дневнику или к людям «в эти дни» | Workout log, floor |
| Activity copy «без тренировок» | Путаница | Пользователь идёт писать упражнения или наоборот | Развести термины |
| Like sent/received | Списки | Message CTA есть; like сам по себе не матч | Request |
| Profile lookingToMeet off | Другие не могут написать | Пользователь не понимает, почему тихо | Settings explainer |
| Feedback sent | Тикет | Ждать ответа админа | Нет |
| Guide article (залогинен) | Читать | Слабый deep-link в конкретный экран приложения | Register/CTA уже; in-app deep links ограничены |
| Recap admin | Письмо LLM | Обычный пользователь не увидит | Открыть или не обещать |

---

## 15. Orphan Features

| Feature | Entry point | Discoverability | Problem |
| ------- | ----------- | --------------- | ------- |
| LLM recap / coach / monthly | Progress `#week-recap` если admin | Нулевой для 99% | Код+SEO+промпты живут без пользователей |
| WorkoutsCoachPage | URL `/app/workouts/coach` | Только старые ссылки | Redirect-orphan |
| UiKit | `/app/admin/ui` | Админы | Ок как internal |
| `/lp-coaches` | Ads / sitemap | Слабо из основного журнала | Отдельный продукт |
| Demo seed people | demo@demo.ru | QA | Путает оценку «зал живой» |
| Activity reset/delete day | меню на Activity | Скрыто в ⋮ | Ок как power |
| Username search | `UNKNOWN` полный UI path; API `/users/search` | Messages/settings частично | Люди вне своего зала |
| Install PWA | `/app/install` | Глубоко | Retention native-like |
| Partner guide old slug | 301 | Ок | — |
| Workout felt | после сессии | Легко пропустить | Сигнал для AI, который выключен |
| Referral circle | Profile / invite button | Средняя | Не в nav |

---

## 16. Feature Dependencies

```
Gym catalog → UserGym → Мой зал people
Check-in → Presence «в зале» → Social discovery + Activity charts
LookingToMeet + Profile → Chat request → Conversation → Chat
Like → ranking на полу (sortByLikes)  [не создаёт чат]
WorkoutSession → History → Progress metrics → (admin) GigaChat
CheckIn stats ──(смешение)──→ AI prompt activity field
Invite → referral count → badge on avatar
Onboarding gym skip ──×──→ Check-in / people
```

**Core:** аккаунт, зал, пол людей, чекин, запрос+чат, запись тренировки.  
**Secondary:** лайки, прогресс, активность-графики, инвайт, аноним, расписание.  
**Supporting:** push, tickets, PWA, admin, SEO journal.  
**Изолированы / почти не для пользователя:** LLM recap, monthly insight, coach letter, UI kit, demo seeds.

---

## 17. Recommended Improvements

Не делать всё. Ниже — направления, не патчи.

1. **IA:** тренировки в основную навигацию или явный dual-hub на «Мой зал» без потери социального CTA.
2. **Activation:** нельзя завершить онбординг без зала *или* жёсткий empty-floor wizard (каталог + инвайт + фото).
3. **После чекина:** если люди есть — скролл к списку / «N рядом»; если нет — инвайт + «запиши тренировку».
4. **После workout save:** лист с CTA прогресс и «повторить в следующий раз».
5. **Развести Activity и Workout** в копирайте, графиках, AI input, empty states.
6. **Упражнения:** не новая модель сейчас, но план канона/алиасов; пока — подсказки имён при вводе.
7. **AI:** либо квота для всех с экономикой, либо убрать из SEO/UI обещание LLM; оставить deterministic insight.
8. **Security:** membership на people; TLS GigaChat; owner check avatar.
9. **Analytics:** 10 in-app событий (см. §13) в тот же Postgres bus или аналог LandingEvent.
10. **Perf:** lazy routes; пагинация people; не грузить tickets на каждый boot.

---

## 18. Priority Matrix

| Priority | Problem | Area | Impact | Effort | Recommendation |
| -------- | ------- | ---- | ------ | ------ | -------------- |
| P0 | Тренировки/прогресс спрятаны | IA / retention | High | M | Поверхность в nav или хаб |
| P0 | Пустой зал после онбординга | Activation / social | High | M | Зал обязателен + empty playbook |
| P0 | `/gyms/:id/people` без членства | Security | High | S | Membership gate |
| P0 | GigaChat TLS off | Security / AI | High | S | Verify certificates |
| P1 | AI admin-only vs SEO «анализ» | Product / SEO / AI | High | M | Квота или честный copy |
| P1 | Activity названа тренировками | Data / UX | High | S | Копирайт + не слать activity в LLM как workout |
| P1 | Нет in-app analytics | Metrics | High | M | 8–12 событий |
| P1 | Нет моста workout → progress → next | Training engagement | High | S | CTA после save |
| P1 | Упражнения-синонимы | Data / AI | High | L | Каталог/алиасы (позже) |
| P1 | CSR journal + soft 404 200 | SEO | Med-High | M | Prerender body / real 404 |
| P2 | Один JS-бандл | Performance | Med | M | React.lazy |
| P2 | Dual gyms.json | Data | Med | M | Один источник |
| P2 | Like без объяснения vs request | Social | Med | S | Copy / unify |
| P2 | Avatar media IDOR | Security | Med | S | Owner prefix |
| P2 | Logout без отзыва JWT | Security | Med | S | bump tokenVersion |
| P2 | In-memory rate limit | Scale / AI abuse | Med | M | Shared limiter |
| P2 | People endpoint без пагинации | Performance / privacy | Med | M | Pages / caps |
| P3 | Login Allow в robots | SEO | Low | S | Disallow /login |
| P3 | UI drift empty/buttons | UI kit | Low | S | По мере экранов |
| P3 | A11y contrast/touch | A11y | Low-Med | M | Аудит контраста |
| P3 | 600 workout cap без экспорта | Data | Low | M | Export later |

---

## TOP 10 изменений (20% → 80%)

### 1. Сделать тренировочный контур видимым
**Problem:** Дневник/прогресс не в bottom nav.  
**Why it matters:** Второй продукт приложения не активируется.  
**Expected impact:** Training engagement, retention power users.  
**Complexity:** Medium (IA + привычки).  
**Priority:** P0

### 2. Закрыть cold-start «Мой зал»
**Problem:** Онбординг без зала / зал без людей = социальный продукт мёртв.  
**Why it matters:** First value = люди или хотя бы чекин в своём клубе.  
**Expected impact:** Activation, social interaction.  
**Complexity:** Medium.  
**Priority:** P0

### 3. Membership (или эквивалент) на список людей зала
**Problem:** Скрейпинг всех залов любым аккаунтом.  
**Why it matters:** Безопасность + честность «свой зал».  
**Expected impact:** Security, trust.  
**Complexity:** Small.  
**Priority:** P0

### 4. Включить проверку TLS для GigaChat
**Problem:** `rejectUnauthorized: false`.  
**Why it matters:** Ключ и данные тренировок.  
**Expected impact:** Security.  
**Complexity:** Small.  
**Priority:** P0

### 5. Мост после записи тренировки
**Problem:** Save → история → стоп.  
**Why it matters:** Прогресс и следующая сессия не входят в привычку.  
**Expected impact:** Training engagement, позже AI adoption.  
**Complexity:** Small.  
**Priority:** P1

### 6. Развести Activity и Workout везде
**Problem:** Одни слова, разные сущности; AI ест чекины как контекст «тренировок».  
**Why it matters:** Неверные данные и ожидания.  
**Expected impact:** UX clarity, data quality.  
**Complexity:** Small–medium.  
**Priority:** P1

### 7. Честная стратегия AI
**Problem:** Журнал и код LLM vs флаг admin-only.  
**Why it matters:** SEO trust + деньги на токенах при открытии без квот.  
**Expected impact:** AI usage или честный SEO; защита от abuse.  
**Complexity:** Medium.  
**Priority:** P1

### 8. In-app события activation/social/training
**Problem:** Нельзя управлять воронкой.  
**Why it matters:** Иначе TOP-изменения неизмеримы.  
**Expected impact:** Все продуктовые метрики.  
**Complexity:** Medium.  
**Priority:** P1

### 9. Code splitting + не отдавать весь зал одним JSON
**Problem:** Тяжёлый клиент и пол.  
**Why it matters:** TTI, мобильный зал.  
**Expected impact:** Performance, activation на слабых сетях.  
**Complexity:** Medium.  
**Priority:** P2 (делать рано, не в конце)  

### 10. Канон упражнений (не ломая текущие строки)
**Problem:** Синонимы дробят прогресс и будущий AI.  
**Why it matters:** Чем дольше пишут свободный текст, тем дороже миграция.  
**Expected impact:** Progress trust, AI quality, scalability.  
**Complexity:** Large — проектировать, не внедрять вслепую.  
**Priority:** P1 design / P2 ship

---

## Appendix A — Страницы: CTA / states (сжато)

| Страница | Главные CTA | Empty | Loading | Error |
| -------- | ----------- | ----- | ------- | ----- |
| Welcome | Регистрация, вход | — | — | форма |
| Login/Register | Submit | — | busy | alert |
| Onboarding | Далее / пропустить зал | нет залов в городе | gyms fetch | liveFailed |
| Мой зал | Чекин, Тренировки, Активность, Выбрать зал, инвайт | нет зала; нет людей | SoftLoader people | retry people |
| Discover | Карточка зала | нет совпадений / elsewhere | SoftLoader | liveFailed |
| Gym detail | Вступить / дом / чекин / люди | нет людей | loader | fetch gym |
| User profile | Лайк, написать, блок | 404 | loading | loadError, likeError |
| Messages | Открыть тред, поиск | пустой инбокс | — | — |
| Chat | Send, accept request | — | messages | send error |
| Profile | Лайки, инвайт, schedule, settings | нет фото stub | — | saveError |
| Workouts | Записать, copy, progress strip | «Пока пусто» | SoftLoader | alert |
| Editor | Save | нет упражнений нельзя save | — | validation |
| Progress | Period tabs, recap если admin | insufficient data insight | SoftLoader | fetch |
| Activity | Period, reset, «к отметке» | пусто → /app | SoftLoader | fetch |
| Liked | Message, unlike | empty + CTA зал | — | — |
| Settings | Много тогглов | — | — | save |
| Guide | CTA register | unknown article | — | — |
| Admin | операционные | empty tables | — | 403 redirect |

Откуда/куда: см. §2–4. Данные: AppContext user + профильные API.  

---

## Appendix B — Дубли (не объединять сейчас)

| Location | Что дублируется | Почему проблема | Риск | Что можно объединить |
| -------- | ---------------- | ---------------- | ---- | -------------------- |
| `src/data/gyms.json` vs `api/prisma/data/gyms.json` | Каталог залов | Рассинхрон имён/координат | Неверные залы на клиенте offline | Один JSON + API source of truth |
| `src/lib/gymSearch.ts` vs `api/src/lib/gymSearch.ts` | Поиск | Разное поведение suggest | Пользователь не находит зал | Shared package / копипаста тестов |
| `fieldLimits.ts` FE/API | Лимиты полей | Расхождение валидации | 400 vs UI | Генерация из одного файла |
| `periodRange` FE/API | 7/30/90/180/365 | Уже почти sync | Тихий drift | Комментарий «keep in sync» недостаточен |
| `WORKOUT_RECAP_ADMIN_ONLY` ×2 | Флаг AI | Клиент скрыл, сервер 403 — ок; забыть один | Утечка UI или дыра | Один env flag |
| `shortGymName` Home + CheckIn | Нормализация названия | Расхождение лейблов | Косметика | util |
| Welcome vs LP vs LP-coaches | Маркетинг | Разный трекинг | Несравнимые воронки | Общие блоки |
| Coach vs weekly vs monthly | Три LLM продукта | Никто из users не видит | Стоимость поддержки | Один recap |
| ProgressInsight vs GigaChat | Два «анализа» | Путаница | Обещание AI | Позиционировать deterministic как основной |
| Activity charts vs Progress charts | UI графиков | Смешение сущностей | Неверные выводы | Разный visual language |
| serialize types vs `src/types.ts` | User shape | Drift полей | Баги пола | codegen |

---

## Appendix C — Accessibility (ключевые действия)

| Действие | Наблюдение |
| -------- | ---------- |
| Я в зале | Button; sheet dialog aria-modal; error role=alert; disabled без зала без ссылки |
| Like | Иконка/кнопка на профиле; likeError alert; размер тача `UNKNOWN` |
| Request | Форма greeting; canStartChat gate |
| Chat | composer name attrs; send |
| Save workout | primary button; validation |
| AI analysis | скрыто; для admin — отдельный блок |
| Bottom nav | `aria-label="Основная навигация"` |
| Keyboard | sheets useSheetA11y; полный tab order `UNKNOWN` |
| Contrast | lime `#c8f542` на `#0a0d0c` вероятно ок; muted `#748179` — риск |
| Semantic | много `<button>`/`<Link>`; графики `role="img"` |

---

## Appendix D — Уточнения после полного обхода API / frontend / security

Код по-прежнему не менялся. Ниже — факты, которые уточняют §§8–11, 14.

- **IDOR workouts/chats/tickets/notifications:** запросы scoped по `userId` / `isParticipant` — дыр не найдено.
- **XSS / SQLi:** `dangerouslySetInnerHTML` нет; raw SQL — Prisma tagged templates.
- **Forgot-password:** anti-enumeration (одинаковый OK). Register 409 — наоборот, раскрывает email.
- **`requireAdminPermission` middleware** в `requireAdmin.ts` не используется; админка зовёт локальный `requirePerm`.
- **Админ GET** (users, analytics, landing) без отдельного rate limit — при угоне сессии админа проще выгрузить PII.
- **Coach eligibility:** ≥4 сессии за 21 день; weekly insight ≥2 + сигнал; monthly ≥4 + сигнал (всё равно за admin-only).
- **Фото в PATCH /me:** owner prefix проверяется; дыра только у `persistAvatar`.
- **Прогресс на клиенте** агрегирует по **имени**, не по `trackKey` (`pickedExercise` → query). `trackKey` живёт в редакторе и на сервере для deltas.
- **PWA:** SW + push только в standalone; haptic не работает в iOS Safari/PWA (задокументировано в `haptic.ts`).

*Конец отчёта. Следующий этап — только по приоритетам из §18 / TOP 10, без косметического рефакторинга «всего UI».*
