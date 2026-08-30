# Spotter Analytics Audit

Дата: 2026-08-30  
Статус: только исследование. Код не менялся. Implementation не начинать, пока этот отчёт не принят.

Продукт: Spotter (`spottergym.ru`) — знакомства в зале + дневник тренировок. Админка: `/app/admin`.

---

## KEEP / CHANGE / ADD / DO NOT TOUCH

### KEEP

- Вся текущая админка и её API (`/admin/analytics`, landing, ops, referrals, password-resets, users, broadcasts, tickets, blocks, emergency shutdown).
- Существующие модели: `User`, `CheckIn`, `Like`, `Conversation`, `ChatMessage`, `Invite`, `WorkoutSession`, `WorkoutAiInsight`, `WorkoutCoachReport`, `LandingEvent`, `PasswordResetEvent`, `OpsFault`, `FeedbackTicket`, `AdminBroadcast`.
- Текущая формула retention R1–R60 (day-N по `lastSeenAt` ровно в день D+N, МСК, окно когорт 28 дней). Не переписывать без отдельного решения — это сломает сравнение с уже накопленными цифрами.
- Landing-воронка и search attribution (UTM, referrer, yclid/gclid).
- Referral: `Invite` + кредит после `onboardingDone`.
- Серверные `logAppEvent` на like / chat request / accept / first message / first check-in.
- Privacy allowlist метаданных app-событий: только `source`, `range`, `reason`, `surface`. Без текстов чатов, весов, названий упражнений.
- `WORKOUT_RECAP_ADMIN_ONLY = false` — AI открыт всем.
- Онбординг без обязательного зала (`gym_skipped` валиден).
- Просмотр людей в любом зале — продуктовая механика, не баг.

### CHANGE

- Смешение landing + in-app событий в одной таблице `LandingEvent` без разделения домена и без индекса по `userId`.
- `view` лендинга: один раз на сессию на все SEO-пути (`onceKey: 'view'`) — теряется путь и повторные визиты `/guide`.
- `people_list_viewed` с `surface: gym` — один раз на сессию на все карточки залов; нельзя отличить «свой зал» от «чужой».
- `first_message_sent` вызывается на каждое исходящее сообщение, дедуп только once-per-user — имя врёт, данные «первое сообщение» ок.
- Retention на хабе показывает только R1/R7; `byGender` / `avgAge` / `coaches` считаются, но почти не рисуются; gender/age groupBy без фильтра `deletedAt`.
- Нет единого date range и нет серверных агрегаций in-app воронок (события пишутся, дашборда нет).
- App-события с клиента можно послать без доказательства действия (кроме тех, что дублирует сервер).

### ADD

- Product Analytics Layer поверх существующих фактов + недостающие события (список в §4).
- Overview / воронки / core loop / Aha / gym density / user timeline / event debugger / data quality — поэтапно, additively.
- Связка acquisition (`visitorId` / UTM на регистрации) → userId → activation → R7.
- WAU, stickiness, date selector, composable filters — после фундамента.

### DO NOT TOUCH

- AI-тренер открыт всем. Не возвращать admin-only / paywall.
- Регистрация и использование без выбранного зала.
- Просмотр людей в любом зале.
- Не склеивать упражнения-синонимы (`trackKey` / identity).
- Не логировать пароли, токены, секреты GigaChat, тексты сообщений, payload тренировок в analytics.
- Не считать check-in и workout одной сущностью.
- Не считать `gym selected` обязательным activation step.
- Не делать causal-выводы в UI («лайк увеличивает retention»).

---

## 1. Current architecture

Два независимых коллектора пишут в **одну** таблицу `LandingEvent`.

```text
Public pages (/ , /lp, /guide, /register…)
  → trackLanding() → POST /analytics/lp → logLandingEvent()
  → LandingEvent (UTM, referrer, searchEngine, path)

Logged-in /app
  → trackApp()     → POST /analytics/app → logAppEvent()
  → LandingEvent (path='/app', UTM пустые, meta в поле placement)

Серверные действия
  → logAppEvent() напрямую из likes / conversations / me check-in
  → та же LandingEvent
```

Параллельно «факты продукта» живут в нормальных таблицах и уже кормят админку:

| Факт | Модель | Кто читает |
|---|---|---|
| Регистрация, lastSeen, онбординг, зал, тренер | `User` | `buildAdminAnalytics` |
| Чекин | `CheckIn` | хаб DAU-чекины, `activeNow` |
| Лайк | `Like` | нет админ-агрегации |
| Запрос / чат | `Conversation`, `ChatMessage` | нет админ-агрегации |
| Инвайт | `Invite` | `buildReferralAnalytics` |
| Тренировка | `WorkoutSession` + exercises/sets | прогресс/AI, не админ-дашборд |
| AI-письма | `WorkoutAiInsight`, `WorkoutCoachReport` | продукт, не админ-дашборд |
| Сброс пароля | `PasswordResetEvent` | `/admin/password-resets` |
| Ошибки API | `OpsFault` | `/admin/ops` |
| Тикеты | `FeedbackTicket` | хаб + `/admin/tickets` |
| Рассылка | `AdminBroadcast` + `Notification` | `/admin/broadcasts` |

Идентичность:

- Landing: `visitorId` (localStorage `spotter_lp_vid`), `sessionId` (sessionStorage).
- App: те же id + optional `userId` из cookie JWT на `/analytics/app`.
- Серверные app-события: `visitorId = u:{userId}`.
- DAU/retention: `User.lastSeenAt` (heartbeat раз в 60с, логин, чекин) — **не** события.

Часовой пояс метрик хаба: **Europe/Moscow**, константа `MSK_OFFSET_MS`. `LandingEvent.createdAt` — UTC Prisma `now()`. Смешение окон: landing-воронка режется «сейчас минус 24ч/7д/30д» (rolling UTC), retention — календарные дни МСК.

Нет отдельного analytics warehouse, feature flag, очереди, экспорта CSV, графиков, глобального date picker.

---

## 2. Existing data sources

### 2.1 Prisma (главное)

`api/prisma/schema.prisma`

- `LandingEvent` — единственный event store. Индексы: `createdAt`, `(name, createdAt)`, `(visitorId, name, createdAt)`, `(utmCampaign, createdAt)`, `(sessionId, name)`, `(searchEngine, createdAt)`. **Нет индекса `userId`.**
- `User.lastSeenAt` — DAU/MAU/R-N. Индекс есть.
- `User.registeredAt`, `onboardingDone`, `homeGymId`, `isCoach`, `signupIp`.
- `UserGym` — членство в залах (не только домашний).
- `CheckIn` — `checkedInAt`, `checkedOutAt`, `expiresAt`, `extendCount`.
- `Like` — unique `(fromUserId, toUserId)`.
- `Conversation` — `pending` / `accepted`, `initiatedById`.
- `ChatMessage` — факт сообщения, не содержимое в analytics.
- `Invite` — одна связь invitee→inviter, `inviteeId` unique. Нет «ссылку открыли».
- `WorkoutSession.performedAt` — тренировка независима от чекина.
- `WorkoutAiInsight.viewedAt`, `recommendationClickedAt` — продуктовые поля просмотра AI (клиентский `ai_recommendation_viewed` дублирует смысл частично).

### 2.2 HTTP

Публичные (rate limit):

- `POST /analytics/lp` — 60/мин
- `POST /analytics/app` — 80/мин, userId только из своей сессии

Админ (`viewUsers` кроме отдельно помеченных):

- `GET /admin/analytics`
- `GET /admin/landing`
- `GET /admin/referrals`
- `GET /admin/password-resets`
- `GET /admin/ops`
- `GET /admin/users?q=&activity=`
- `GET/POST /admin/broadcasts` — `messageUsers`
- tickets — отдельные `/tickets*`

### 2.3 Клиент

- `src/lib/landingTrack.ts`, `src/lib/utm.ts`, `src/lib/searchAttribution.ts`
- `src/lib/appTrack.ts`
- `src/components/PublicTrafficCapture.tsx` — first-touch UTM + один `view` на сессию
- `src/context/AppContext.tsx` — `apiHeartbeat()` каждые 60с

### 2.4 Что не является analytics store

- `src/lib/adminDirectory.ts` / localStorage — кэш/легаси офлайн-админки, не источник правды.
- `src/lib/adminStats.collectAdminOverview` — легаси; хаб читает сервер.
- Яндекс Вебмастер / Метрика — снаружи, не в этом репозитории.

---

## 3. Existing events

### 3.1 Landing (`LANDING_EVENT_NAMES`)

| Event | Где создаётся | DB | API | userId | Timestamp | Можно в analytics | Проблемы |
|---|---|---|---|---|---|---|---|
| `view` | `PublicTrafficCapture` на SEO-путях | LandingEvent | POST /analytics/lp | нет (клиент не шлёт) | createdAt UTC | да, визиты | 1 раз на сессию на все пути; `/guide` после `/` не даёт второй view |
| `scroll_50` / `scroll_90` | только `/lp` и `/lp-coaches` | LandingEvent | lp | нет | UTC | да | нет на `/` и `/guide` |
| `cta_register` | Landing, coaches, guide CTA | LandingEvent | lp | нет | UTC | да | `placement` есть |
| `cta_login` | Landing / coaches | LandingEvent | lp | нет | UTC | слабо | мало где |
| `register_view` | `RegisterPage` mount | LandingEvent | lp | нет | UTC | да | session dedupe |
| `register_success` | `RegisterPage` после успеха | LandingEvent | lp | нет | UTC | да | не серверный факт; refresh после успеха не должен, но гонка возможна |

UTM/search поля пишутся на **каждое** landing-событие из first-touch (`loadMarketingParams` / `loadSearchTouch`).

### 3.2 App client (`APP_EVENT_NAMES` → тот же LandingEvent)

| Event | Где | userId | Dedupe | Проблемы |
|---|---|---|---|---|
| `registration_completed` | RegisterPage `trackApp` | если cookie уже есть — да | client session + server once/user | нет серверного лога в `auth.ts`; до сессии userId может быть пуст |
| `gym_selected` / `gym_skipped` | OnboardingPage финиш | да | нет (кроме profile once) | смена зала в Settings не трекается |
| `profile_completed` | OnboardingPage | да | once/user + session | онбординг = «профиль готов», не отдельный старт онбординга |
| `people_list_viewed` | Home (только если есть зал) + GymDetail | да | session per `surface` | Home без зала = 0; все чужие залы = один `gym` на сессию |
| `profile_viewed` | UserProfilePage | да | нет | нет id просматриваемого в meta (намеренно) |
| `workout_started` | WorkoutEditor new, не copy | да | нет | copy/edit не стартуют |
| `exercise_added` | кнопка добавить упражнение | да | нет | клик UI, не факт сохранения |
| `workout_saved` | успешный save | да | нет | нет completed / copied |
| `progress_opened` | WorkoutsProgressPage | да | session | нет смены периода как события |
| `activity_opened` | ActivityPage | да | session | Activity ≠ workout |
| `ai_analysis_opened` | week + month recap | да | session per range | |
| `ai_analysis_requested` / `_completed` / `_failed` | recap компоненты | да | нет | week recap не шлёт `ai_recommendation_viewed` |
| `ai_recommendation_viewed` | только WorkoutMonthRecap | да | нет | дыра на 7д |

Клиент **не вызывает** `like_sent`, `chat_request_*`, `first_message_sent`, `first_checkin` — их пишет сервер.

### 3.3 App server (`logAppEvent`)

| Event | Где | Dedupe | Надёжность |
|---|---|---|---|
| `like_sent` | `likes.ts` после create | нет | хорошо; unlike не логируется; повторный like после unlike = новое событие |
| `chat_request_sent` | новая conversation | нет | хорошо |
| `first_message_sent` | создание чата с текстом **и** каждый POST сообщения | once/user | имя = first; повторные вызовы no-op |
| `chat_request_accepted` | accept | нет | хорошо |
| `first_checkin` | `me.ts` если `priorCount === 0` | once/user | нет события обычного/повторного чекина и checkout |

### 3.4 Факты без event-имени (уже можно считать)

| Данные | Источник | Для какой воронки |
|---|---|---|
| Регистрация | `User.registeredAt` | acquisition → registration |
| Онбординг | `User.onboardingDone` | activation |
| Зал / пропуск | `homeGymId` + `UserGym` + события onboarding | gym optional |
| Чекин start/end/duration | `CheckIn` | activity loop |
| Лайк received | `Like.toUserId` | social |
| Чат / сообщения | Conversation / ChatMessage | social |
| Тренировки | WorkoutSession | training |
| AI generated | WorkoutAiInsight / CoachReport | AI |
| Инвайт создан / credited | Invite + onboarding invitee | referral |
| Last seen / DAU | `User.lastSeenAt` | retention |
| Источник трафика | LandingEvent UTM/search | growth (пока не склеен с user) |

---

## 4. Missing events

Нужны для роадмапа из master prompt. Не создавать, пока не утверждён Phase 1.

**Acquisition / referral**

- `invite.opened` / `invite.claimed` (сейчас только `Invite` row + `claim-invite`)
- `invite.sent` (шаринг ссылки не логируется)
- `landing.view` per path (сейчас один view/сессия)
- связка `register_success.userId` на сервере в `auth.ts`

**Onboarding / gym**

- `onboarding.started`
- `gym.changed` (Settings / join gym)
- `gym.viewed` отдельно от people list
- `gym.search` (Discover)
- `gym.people_viewed` с признаком home vs other + `gymId` (сейчас gymId в событии нет)

**Social**

- `like.received` (можно из `Like`, событие не нужно если считать из таблицы)
- `like.removed`
- `chat.opened` / последующие `chat.message_sent` (сейчас только first)
- `people_list_viewed` с домашней ленты без зала (сейчас не стреляет)

**Check-in**

- `checkin.started` (каждый, не только first)
- `checkin.ended` / expired / extended

**Training**

- `workout.copied`
- `workout.edited`
- `set.added` — скорее не нужно (шум); факт в БД
- различие saved vs «есть подходы»

**AI**

- `ai_recommendation_viewed` на 7-дневном рекапе
- использование `WorkoutAiInsight.viewedAt` в админке

**Retention / session**

- явного `session_started` нет; есть heartbeat
- WAU не считается

---

## 5. Duplicate / inconsistent events

| Тема | Суть |
|---|---|
| Два коллектора, одна таблица | `view` и `workout_saved` в одном `name` namespace. `GET /admin/landing` фильтрует `LANDING_EVENT_NAMES`, app-события там не видны. Обратной админки для app нет. |
| Регистрация | `register_success` (lp) + `registration_completed` (app). Разные name, один жест. Нет серверного канона. |
| First message | Вызов на каждое сообщение + once-per-user. Консистентно как «когда-либо написал», плохо как rate сообщений. |
| People viewed | `surface=home` требует зал; `surface=gym` — все залы одной сессией. Нельзя построить «свой vs чужой зал». |
| Workout started vs saved | started = открыл новую форму; saved = записал. Copy не стартует. Нет completed. |
| Exercise added | UI-клик, может не сохраниться. |
| AI recap | week vs month разные наборы событий. |
| Retention vs landing windows | МСК календарь vs rolling 24h UTC. |
| Gender/age | groupBy без `deletedAt` — расходится с `users` count. |
| Client spoof | `/analytics/app` принимает любое allowlisted имя от залогиненного (и даже без userId при валидном visitorId). Серверные дубли (like/chat/checkin) надёжнее. |
| Session dedupe vs refresh | `people_list_viewed` / `progress_opened` не растут внутри сессии — плохо для частоты, хорошо против шума. |
| `trackKey` | это identity упражнения, **не** analytics event. |

Канон (предложение, **не переименовывать в БД**):

```text
view                    → acquisition.page_view
cta_register            → acquisition.cta_register
register_view           → auth.registration_started
register_success        → auth.registration_completed   (landing)
registration_completed  → auth.registration_completed   (app, тот же смысл)
gym_selected            → onboarding.gym_selected
gym_skipped             → onboarding.gym_skipped
profile_completed       → onboarding.completed
people_list_viewed      → gym.people_viewed
profile_viewed          → social.profile_viewed
like_sent               → social.like_sent
chat_request_sent       → social.request_sent
chat_request_accepted   → social.request_accepted
first_message_sent      → chat.first_message_sent
first_checkin           → checkin.first_started
workout_started         → workout.editor_opened
workout_saved           → workout.saved
exercise_added          → workout.exercise_added_ui
progress_opened         → progress.viewed
activity_opened         → activity.viewed
ai_analysis_*           → ai.*
```

---

## 6. Existing admin functionality

Роуты `/app/admin/*`, права: `viewUsers`, `tickets`, `messageUsers`, `blockUsers`, `removeUsers`, `manageAdmins`. Master = полные права + kill-switch.

| Экран | Что есть | Чего нет из master prompt |
|---|---|---|
| Хаб | users, onboarded, activeNow, photos, block, DAU/MAU, checkedInToday, tickets, R1/R7, ops 24h, password-reset summary | WAU, activation rate, social/training/AI KPI, drop-off, date range |
| Players | поиск, фильтры seen/checkin/IP, карточка, блок, удаление, сообщение | product timeline, event debugger |
| Analytics | DAU/MAU, чекины, R1–R60 | heatmap, сегменты, source, gym |
| Geography | byCity, byGym (домашний зал, top 40) | DAU/R7/social per gym |
| Storage | фото bytes | — |
| Password resets | воронка статусов | — |
| Referrals | counts, leaders, recent 200 | invite opened, R7 приглашённых |
| Landing | funnel 24/7/30, SEO engines/keywords, campaigns 7д, recent 40 | склейка с activation/R7 |
| Ops | группы ошибок человеческим языком | — |
| Broadcasts / tickets / users / UI kit | операции | не analytics |

Нет экранов: Overview 2.0, Core Loop, Aha Moment, Cohorts besides current R-N, gym density, event debug, data quality, in-app funnel.

---

## 7. What can be reused

1. **`LandingEvent` + два POST** — фундамент event log. Расширять additively (новая таблица `AppEvent` или колонка `domain`), не сносить.
2. **`buildAdminAnalytics` / `buildLandingAnalytics` / `buildReferralAnalytics`** — паттерн «сервер считает, клиент рисует карточки».
3. **Факт-таблицы** Like / Conversation / CheckIn / WorkoutSession — точнее client events для воронок social / training / check-in. Считать из них, события — для timing и Aha.
4. **`visitorId` общий** landing↔app — ключ склейки acquisition→user, если регистрация с того же браузера.
5. **`User.lastSeenAt` + МСК helpers** — не изобретать второй clock для DAU.
6. **Права админки и UI kit** — новые экраны только за `viewUsers`, тот же visual language.
7. **AI tables** `viewedAt` / tokens — корреляция AI vs retention без новых событий.
8. **`Invite` + credited** — база referral funnel; не дублировать «кто кого».

---

## 8. What must be changed (когда начнём, не сейчас)

1. Разделить домены событий (колонка или таблица) и индекс `(userId, name, createdAt)`.
2. Писать `userId` на `register_success` / `registration_completed` с сервера.
3. Либо ослабить session-once на `view` (хотя бы path), либо писать page_view отдельно.
4. `people_list_viewed`: home без зала; gymId + home/other; не один fire на все залы.
5. Серверные события каждого чекина (не только first) — или считать только из `CheckIn`.
6. Починить gender/age `deletedAt`.
7. Не показывать в UI старый R-N как «классический returned within N days» — подписать формулу или добавить второй ряд позже, не заменяя тихий.
8. Админские агрегации app-событий и факт-таблиц — новые GET, старые URL оставить.

---

## 9. Database changes

Только additive, отдельными migrations, когда дойдёт фаза.

Рекомендуемый минимум Phase 1:

- `LandingEvent.domain` default `'landing'` (`landing` | `app`) **или** таблица `ProductEvent` с FK userId, name, occurredAt, meta, visitorId, sessionId.
- Индекс `LandingEvent(userId, name, createdAt)`.
- Опционально `User.acquisitionVisitorId` / snapshot UTM на регистрации — иначе historical join только через совпадение visitorId во времени.

Не удалять колонки LandingEvent. Не менять semantics `Invite.credited` (это не колонка — считается через onboarding).

Historical app rows: `path = '/app'` или `name` in `APP_EVENT_NAMES`.

---

## 10. API changes

Additive:

- `GET /admin/product-overview?from=&to=&gymId=&source=`
- `GET /admin/funnels/...`
- `GET /admin/users/:id/timeline`
- `GET /admin/events?userId=&name=`

Сохранить все текущие `/admin/*`.

`POST /analytics/app` — уже есть auth bind; не принимать чужой `userId` из body (сейчас body userId для app **игнорируется**, берётся из сессии — так и оставить).

---

## 11. UI changes

Пока нулевой. Когда дойдёт:

- Не ломать хаб: либо вкладки/секции, либо новые пути `/app/admin/overview` рядом со старым.
- UI kit, тёмная плотная вёрстка, без glass/purple.
- Один date range на analytics-экраны.
- Подпись retention: «вернулся в календарный день D+N (МСК), не “хотя бы раз за N дней”».
- Aha: «корреляция, не причинность».

---

## 12. Risks

| Риск | Почему |
|---|---|
| Тяжёлые scan `LandingEvent` | Нет userId index; app+landing в куче; groupBy visitor на больших окнах уже есть в landing. |
| Неверная склейка source→user | visitorId пропадает при другом устройстве / Safari ITP; UTM не копируется в app events. |
| Двойной счёт регистрации | lp + app names. |
| Искажение people/gym | session dedupe и «нет зала = нет home people event». |
| Смена формулы retention | разрыв с уже показанными R1/R7. |
| Privacy | Players уже показывает email/IP; timeline не должен тащить тексты чатов и веса. |
| Client spoof | воронки «открыл экран» мягче, чем Like/CheckIn. |
| Performance хаба | `buildAdminAnalytics` уже грузит всех users для retention в память. Рост базы убьёт хаб раньше новых воронок. |
| Scope | Master prompt = много фаз. Один PR «Admin 2.0» неоткатываем. |

---

## 13. Migration strategy

1. Audit (этот файл) — **сейчас, стоп**.
2. Phase 1: indexes + optional `domain` + mapping layer в коде, без UI. Dual-write если новая таблица.
3. Старые запросы landing фильтруют `name in LANDING_EVENT_NAMES` — не ломаются.
4. Новые дашборды читают новые endpoints; старый хаб живёт.
5. Feature flag или просто отдельные роуты до приёмки.
6. Rollback = выключить роут / не читать новую таблицу. Не down-migration с потерей events.

---

## 14. Recommended implementation order

Как в master prompt, с уточнением зависимости от данных:

0. **Принять этот аудит** (формула retention, считать social из таблиц vs events, отдельная таблица vs колонка).
1. **Phase 1 — Foundation:** index userId, domain, server `registration_completed`, mapping, не трогать UI.
2. **Phase 2 — Overview:** KPI из User + CheckIn + существующий R-N + простые counts Like/Conversation/Workout за период. Ещё без идеальных app events.
3. **Phase 3 — Funnels:** social/training из факт-таблиц; landing уже есть; app events как дополнение.
4. **Phase 6 — Gym** можно параллельно с 3: данные почти все в User/UserGym/CheckIn/Like (like без gymId — нужен join через homeGym или «зал просмотра», которого нет).
5. **Phase 5 — Growth:** после склейки visitor→user (Phase 1).
6. **Phase 4 — Aha/cohorts:** после стабильных user-level events.
7. **Phase 7 — Timeline/debugger**
8. **Phase 8 — Data quality**

Gym social density потребует правила: лайк «в каком зале» — сейчас у Like нет gymId. Честный вариант: home gym отправителя / получателя, не «зал карточки». Зафиксировать в Phase 6 plan, не угадывать.

---

## 15. Estimated complexity by phase

Оценка объёма (не календарь), при условии не переписывать retention.

| Phase | Сложность | Комментарий |
|---|---|---|
| 1 Foundation | M | Миграция + mapping + 2–3 серверных лога. Главный риск — выбор таблицы. |
| 2 Overview | M | Новые агрегаты, date range, не ломать хаб. |
| 3 Product funnels | L | Много UI + SQL; social/training лучше из фактов. |
| 4 Cohorts / Aha | L | Гибкое сравнение сегментов, аккуратная копия R-N. |
| 5 Growth | M–L | Склейка source; дыры first-touch. |
| 6 Gym | M | Like без gymId — продуктовое решение. |
| 7 Timeline | M | Сборка из 5+ таблиц, privacy. |
| 8 Quality | S–M | Правила на известных именах. |

Самый дорогой пробел не UI, а **identity + gym context на событиях**.

---

## 16. Ответы на обязательные проверки качества

### Identity

- Landing: anonymous visitor, userId обычно пуст.
- App POST: userId только из JWT; без сессии событие может записаться с visitorId.
- Серверные like/chat/checkin: userId всегда есть.
- Нет request id.

### Time

- Events: UTC `createdAt`.
- DAU/R-N: МСК день.
- Landing windows: rolling hours.
- Нет единого `from/to` query.

### Duplication

- Landing view/scroll/register_view: client + server session dedupe.
- App once-per-session: people/progress/activity/ai_open/registration/profile.
- App once-per-user: registration, profile_completed, first_checkin, first_message.
- Like: unique pair; event на каждый успешный create.
- Check-in first: priorCount + once/user.
- Heartbeat: не event, обновляет lastSeen (DAU не раздувается событиями).

### Consistency

- Check-in ≠ workout — в данных раздельно, в событиях чекин почти не покрыт.
- `workout_started` ≠ сохранённая тренировка.
- `activity_opened` ≠ «Я в зале».
- `gym_selected` только онбординг.

---

## 17. Воронки: что можно посчитать уже сегодня

| Воронка | Сейчас | Дыра |
|---|---|---|
| Landing → register | да, `/admin/landing` | view undercount по страницам |
| Register → onboard | `User.onboardingDone` / events | нет onboarding.started |
| Gym selected OR skipped | events + homeGymId | смена зала |
| Entered product | lastSeen / heartbeat | нет «первый заход в /app» |
| People / gym | people_list_viewed | свой/чужой, Discover |
| Social | Like + Conversation + events | нет admin UI; нет gymId на like |
| Chat depth | ChatMessage count | first_message только как флаг |
| Check-in | CheckIn rows | нет событий кроме first |
| Workout | WorkoutSession | нет admin UI; copy/edit |
| Activity vs workout | разные таблицы | не смешивать |
| AI | events + insight rows | week recommendation view |
| Retention | lastSeen day-N | не classic N-day; нет WAU |
| Referral | Invite + credit | нет open; нет R7 invitee |
| Source → R7 | почти нет | нет user-level UTM snapshot |

---

## 18. Permissions (повтор)

Новая аналитика — только `viewUsers` (и master). Timeline с email/IP — как Players. Агрегаты без PII. Не расширять доступ саппорту к сырым событиям без нужды.

---

## STOP

Implementation не начиналась. Следующий шаг — ревью этого отчёта и явное «начинай Phase 1» (или правки к формуле retention / выбору event store).
