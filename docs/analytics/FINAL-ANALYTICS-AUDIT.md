# Spotter — Final Analytics Audit

Дата: 2026-08-30  
Скоуп: Product Analytics Phases 2–7 + коллекторы + существующий хаб.  
Новых фич не добавлялось. Мелкие правки — в конце § Fixes applied.

Production-like dataset в этой сессии недоступен. Perf — по коду и индексам, не по EXPLAIN на проде.

---

## Executive Summary

Слой аналитики **аддитивный**: факты продукта (User, Like, Conversation, CheckIn, WorkoutSession, Invite) не мигрировались и не перезаписывались. Дашборды читают агрегаты на сервере. Админ-API закрыт `requireAuth` + `viewUsers`.

Система **пригодна для решений**, если смотреть один экран и его подпись. Она **не готова** как единый словарь метрик: одно и то же имя (R7, Activation, MAU, AI user) считается по-разному. Social-воронка после Request измеряет не того человека.

Главный риск для продукта — не потеря данных, а **ложные выводы** (сравнить R7 хаба с когортами; «accept rate» в Продукте).

---

## Critical Issues

### C1. R7 — разные формулы под одним именем

| Место | Формула | Кого считает |
|---|---|---|
| Хаб | невзвешенное среднее дневных когорт, окно 28 дней, все живые users | `adminAnalytics.ts` `computeDayNRetention` |
| Обзор | то же среднее, но регистрации **в выбранном периоде** | `adminOverview.ts` `averageCohortRates` |
| Когорты / Рост / Залы | **pooled** `retained / eligible` | `adminCohortsMath.ts` `pooledDayN` |

Пример: день 2/2 (100%) + день 10/100 (10%) → хаб/обзор **55%**, когорты **11.8%**. Подпись `retained/cohortUsers` на хабе **не** знаменатель ставки.

**Impact:** нельзя сравнивать вкладки.  
**Fix:** выбрать одно правило (рекомендуется pooled + thin n&lt;8) и подписать второе явно, либо убрать R7 с хаба/обзора.  
**Risk of fix:** сломает сравнение с уже накопленными цифрами хаба (аудит KEEP).

### C2. Обзор по умолчанию 7д → R7 всегда пустой

D+7 наблюдается только если день регистрации ≤ today−8. Preset `7d` = today−6…today. Eligible когорт нет.

**Location:** `AdminOverviewPage.tsx` default `7d`; `retentionBuckets` в `adminOverview.ts`.  
**Impact:** карточка R7 на главном экране аналитики пустая.  
**Fix:** default 30d / 90d или не показывать R7 на окнах короче D+7.  
**Risk:** низкий. В этой сессии добавлена подсказка «окно короче D+7».

### C3. «Activation» — три смысла

- Обзор KPI **Activation Rate** = meaningful / registered (2 минуты не входят).
- Рост **Activation** = lastSeen &gt; register+2мин **или** meaningful (= шаг `entered` Обзора).
- Продукт core loop: шаг gym context (skip считается). Когорты `gym_selected` **не** считают skip.

**Impact:** «активация 40%» на Обзоре и Росте — разные люди.  
**Fix:** в UI писать «Meaningful / regs» и «Entered (2мин ∪ action)»; не использовать слово Activation в двух местах.  
**Risk:** только копирайт / переименование полей API.

### C4. Social funnel: accept привязан к акцептору в воронке инициатора

Сервер пишет `chat_request_accepted` с `userId` = кто принял (`conversations.ts` ~448).  
Закрытая воронка требует того же userId на шаге Request (`initiatedById`).  
Accept / Chat / Message в Продукте ≈ «отправил запрос **и** принял чужой», не «мой запрос приняли».

Дополнительно `chat_started` и `message_sent` делят один `firstAt` (`adminProduct.ts` ~315) — users после close всегда равны.

**Impact:** конверсия Request→Chat вводит в заблуждение.  
**Fix:** шаг accept = `Conversation.status=accepted` по `initiatedById` (нужен `acceptedAt` или `updatedAt` с оговоркой). Убрать дубль message или оставить только events.  
**Risk:** средний; меняет цифры social.

---

## High Issues

### H1. Growth meaningful — lifetime, не окно периода

`loadMeaningful` в `adminGrowth.ts` (~126) без `from`/`to`. Лайк в феврале активирует январскую когорту. Обзор режет `[registeredAt, to)`.

**Fix:** те же границы, что Overview.  
**Risk:** цифры Growth Activation/Meaningful упадут на исторических пресетах.

### H2. Client может слать любые `APP_EVENT_NAMES`

`POST /analytics/app` принимает allowlist, `userId` только из сессии (это правильно). Нет доказательства действия.

Spoof двигает: `people_list_viewed`, `profile_viewed`, `chat_request_accepted`, AI request/view, `workout_started`.  
**Не** двигает факты: Like, Conversation, WorkoutSession, CheckIn — social like / training created / Overview meaningful (частично) живут в таблицах.

Серверные имена (`like_sent`, `first_checkin`, …) всё ещё в allowlist.

**Fix:** убрать серверные имена из публичного `/app`; для view-событий — sampled + tighter rate limit.  
**Risk:** низкий для фактов; средний для event-воронок.

### H3. Frontend раздувает права vs API

`normalizeAdminPermissions` стартует с `SUPPORT_PERMISSIONS` (`src/lib/adminPermissions.ts` ~113). Сервер `resolveAdminFlags` для отсутствующих ключей → `false`.

Админ с частичным JSON видит карточки Обзор/Таймлайн, API отвечает 403.

**Fix:** база = `EMPTY_PERMISSIONS`, как сервер.  
**Risk:** локальные демо-админы без явного JSON потеряют пункты меню (API и так закрыт).

### H4. Soft-delete убивает факты и bump'ает lastSeen

`softDeleteUser.ts`: стирает Like, CheckIn, Invite; workouts и `LandingEvent` остаются; `lastSeenAt = now()` на tombstone; `deletedAt` выставляет.

Воронки с `deletedAt IS NULL` ок. Открытые counts `LandingEvent` без join User (Обзор `profilesViewed`, `acceptedRequests`, `analysesRequested`) **включают** события удалённых. Рефералка сжимается (Invite deleted).

**Fix:** везде join `deletedAt`; не трогать `lastSeenAt` при delete; Invite soft-archive.  
**Risk:** medium (история рефералов).

### H5. `people_list_viewed` без gymId, один fire на все чужие залы

Не баг продукта (смотреть любой зал — механика). Аналитика **не может** честно разложить viewed gym. Залы это документируют. Discover не пишет people event.

---

## Medium Issues

### M1. MAU / DAU / WAU не совпадают

- Хаб DAU: lastSeen ≥ сегодня МСК (без верхней границы). MAU: **30×24ч от now**, не календарь МСК. WAU нет.
- Обзор/Залы: DAU = lastSeen в последний день **диапазона**; WAU/MAU = 7/30×24ч **обрезаны периодом**. На default 7д MAU = active users.
- Продукт Activity «active users» = unique CheckIn, не lastSeen.

### M2. AI user

Обзор/Когорты: requested ∪ completed ∪ insight.  
Продукт: opened ∪ requested ∪ generated.  
Open-only и completed-only меняются местами.

### M3. Workout clock: `performedAt` vs `createdAt`

`workoutFirsts` фильтрует `performedAt`, в воронку кладёт `MIN(createdAt)`. Repeat — `performedAt`. Бэкдейт ломает порядок шагов.

### M4. Copy workout без `workout_started`

`WorkoutEditorPage` при копировании не трекает start → выпадает из закрытой training-воронки (save всё равно факт).

### M5. Week recap без `ai_recommendation_viewed`

Только month. Шаг Recommendation занижен.

### M6. Invite opened = 0

Нет события. UI честно пишет. Invite row создаётся при **claim на регистрации**, не при шаринге. Sent ≈ Registration.

### M7. Хаб `checkedInToday` / `activeNow` без `deletedAt`

### M8. Admin GET без rate limit

`/admin/gyms`, `/admin/cohorts`, `/admin/overview` — тяжёлые запросы, лимит только на broadcast/emergency. Украденная сессия админа может грузить БД.

### M9. Залы R7 игнорирует date picker

Retention — все текущие `homeGymId` за всё время. Social/check-in — в периоде. Подпись не равна реализации.

### M10. `first_message_sent` — ложь в имени

Логится на запрос с текстом и на каждое исходящее; once-per-user. Данные = «когда-либо писал». Воронки чата берут факт ChatMessage.

---

## Low Issues

- Default presets разные: Обзор 7д, Рост/Залы 30д, Когорты 90д.
- Timeline `options.sources` с текущей страницы, не за весь период.
- Debugger duplicates — выборка last 400, не полный GROUP BY.
- `progress` periodSelections = 0 (нет коллектора).
- Нет rejected request (статуса reject нет — hide ≠ reject).
- Нет AI retry event (повтор = ещё один requested).
- Landing `view` once per session на все SEO-пути (аудит CHANGE).
- Широкая таблица Залы на мобилке — только horizontal scroll (как остальные admin tables).
- Ссылка-иконка таймлайна в Players наследует `.admin-action-icon` (ok).

---

## Security Issues

| Тема | Статус |
|---|---|
| Admin auth | `requireAuth` на `/admin/*` |
| Authorization | `requirePerm(viewUsers)` на всю аналитику |
| Роли | 6 ключей; master email = full; PATCH admin — master-only на сервере |
| IDOR timeline | любой `userId` при `viewUsers` — **задумано** (как Players) |
| Event access | агрегаты + sanitized timeline; нет сырых IP/UA/текстов в Phase 7 |
| Secrets | meta allowlist; AI JSON не отдаётся; пароли/GigaChat не в events |
| Landing `userId` в body | **было** spoof; в этой сессии игнорируется, берётся сессия |
| `/analytics/app` injection | остаётся (H2) |
| Frontend vs API perms | H3 |
| CORS | allowlist + credentials |
| Rate limit analytics | 60/min lp, 80/min app, in-memory, single-node |

Не найдено: утечки passwordHash в admin JSON (обнуляется в serialize), открытых admin routes без сессии.

`GET /admin/users` и timeline search отдают **email** при `viewUsers` — как Players, не новая дыра.

---

## Data Quality Issues

- Две таблицы смысла: факты vs `LandingEvent` в одной куче с лендингом.
- Нет FK `LandingEvent.userId` → orphans возможны; debugger их ловит.
- Soft-delete orphans/events остаются; likes/check-ins/invites исчезают.
- Session dedup client-side обходится (другой браузер / очистка sessionStorage).
- Once-per-user серверный дедуп без уникального индекса — гонка двух запросов.
- Home people не стреляет без зала; skippers выпадают из social до gym card.
- Growth registrations ≠ Overview registrations (нужен landing `view` + склейка visitor).
- `lastSeenAt` — снимок: повторный заход **стирает** exact-day R7.

---

## Performance Issues

Индексы Phase 2 (`20260830180000_admin_overview_indexes`) закрывают Overview scans по дате + `LandingEvent (userId, name, createdAt)`.

Узкие места на росте данных:

| Запрос | Проблема |
|---|---|
| `GET /admin/gyms` | `findMany` **всех** живых User + likes/messages/workouts/check-ins **всего периода** в память |
| `GET /admin/cohorts` (90д) | все regs окна + first-of каждого action |
| `GET /admin/users` | до 300 строк, без пагинации; Players ещё и клиентский фильтр |
| Gyms/timeline ChatMessage | индекс `senderId`, нет `(senderId, createdAt)` |
| Like | `fromUserId` и `createdAt` отдельно, нет `(fromUserId, createdAt)` |
| Admin analytics GET | без rate limit (M8) |

N+1 на дашбордах не видно: сырые SQL / parallel findMany. Сырые events в браузер не льются (кроме timeline page≤40 и debugger samples).

Продовый EXPLAIN не гонялся.

---

## UX Issues

Используется существующий тёмный admin kit (фильтры, `admin-stat-card`, таблицы). Нового visual language нет.

| Ок | Дыры |
|---|---|
| Иерархия хаба: Обзор → Продукт → Когорты → Рост → Залы → Таймлайн | Нет единого glossary R7/Activation |
| Loading «обновляем…», error `admin-inline-error` | Часть экранов рисует пустые KPI «0» до ответа |
| Empty: Обзор «нет данных»; таймлайн «нет событий» | Когорты/Залы при нуле всё равно рисуют каркас |
| Фильтры в URL | Разные default периоды |
| Refresh icon | Нет skeleton |
| Таблицы overflow | Залы на узком экране тяжело читать |

Копирайт местами честный (зал не обязателен; корреляция ≠ причина; invite opened нет). Местами врёт (хаб MAU «30 дней МСК» — исправлено в этой сессии).

---

## Metric Definition Issues

Требование «одна метрика = одно определение» **не выполнено**.

| Метрика | Согласовано? |
|---|---|
| Day-N = exact MSK lastSeen | да (везде) |
| lastSeen = snapshot, не лог | да |
| Workout ≠ CheckIn как сущности | да в Продукте; нет в «meaningful» |
| DAU | нет (хаб today vs обзор end-of-range) |
| WAU | нет на хабе; на обзоре clipped 7×24ч |
| MAU | нет (rolling 30×24ч vs clipped range) |
| Active user | lastSeen-in-range vs check-in users vs home-gym |
| Activation | нет (C3) |
| R1/R7/R30 | день один, **агрегация и популяция разные** (C1, C2) |
| AI user | нет (M2) |
| Registrations | Overview/Product ≠ Growth attributed |
| Social actions | Overview mix ≠ Gyms like+conv+messages |

---

## Regression Issues

Аналитика **не ломает** регистрацию, логин, зал, профиль, лайки, чат, чекин, тренировки, AI, рефералы, SEO: `trackApp` / `logAppEvent` fire-and-forget + try/catch.

Сохранено:

- пользователи, тренировки, чекины, инвайты, старые `LandingEvent`;
- экраны География, Landing, Рефералы, Players, Ops, хаб retention;
- миграция аналитики — только `CREATE INDEX`.

Существующие падения тестов (не аналитика, **existing**):

`serialize.privacy.test.ts` — 3 fail: аноним `isActive` / `gym_other` на публичной карточке. К Phase 2–7 не относятся.

---

## Recommended Fixes

Порядок, не делать всё сразу:

1. **Словарь метрик** (док + UI labels): R7 pooled vs mean; Activation = entered vs meaningful; MAU rolling vs range. Не менять формулу хаба без решения «ломаем историю».
2. **Обзор default 30d** или скрыть R7 на коротких окнах.
3. **Social accept** от факта Conversation для инициатора; убрать дубль chat/message users.
4. **`loadMeaningful` в окно периода.**
5. **Права фронта = сервер** (EMPTY base).
6. Выкинуть серверные имена из `POST /analytics/app`.
7. Rate limit на admin GET; SQL агрегации для Залов вместо load-all.
8. Индексы `(senderId, createdAt)`, `(fromUserId, createdAt)` при росте чата/лайков.
9. Soft-delete: не bump lastSeen; не удалять Invite без архива.

---

## Edge cases (checklist)

| Кейс | Поведение | Вердикт |
|---|---|---|
| User without gym | Обзор/Рост ок; Home people=0; Залы ряд «Без зала» | ok / documented |
| User with gym | homeGymId + UserGym | ok |
| Viewing another gym | чекин → viewed other; people gym без gymId | partial |
| No check-in | тренировка всё равно считается | ok (намеренно) |
| Check-in without workout | Activity ≠ Training | ok |
| Multiple / copied workout | copy без start event | M4 |
| AI fail / retry | fail не generated; retry = ещё request | ok / M5 |
| Request «rejected» | статуса нет | n/a |
| Return after long gap | lastSeen snapshot стирает старый D+N | limitation |
| Deleted user | вычтен из воронок; events/invites side effects | H4 |
| Deleted/stale gym | Залы «Нет в каталоге» | ok |

---

## Abuse

| Вектор | Итог |
|---|---|
| Repeated clicks | session/once-user на части событий; likes unique pair |
| API replay | rate limit; факты идемпотентны где unique |
| Duplicate request | Conversation unique pair |
| Refresh spam | landing view once/session |
| Malformed | zod 400 |
| Event injection | **да** на `/analytics/app` allowlist (H2) |
| Подставить userId на lp | **закрыто** в этой сессии (сессия only) |

Пользователь **не** должен иметь возможность создавать произвольные product facts. События просмотра — да.

---

## Timezone

- Метрики объявлены `Europe/Moscow` (UTC+3, без DST — верно для Москвы).
- `parseOverviewRange`: inclusive MSK days, `to` exclusive (завтра 00:00 или now).
- Тесты: суббота UTC → воскресенье МСК; 23:59 vs 00:00; custom future clamp; week = Monday.
- Хаб MAU **не** календарный МСК (M1).
- 7д/30д/90д — скользящие календарные дни от today, не ISO week.

---

## Build

| Шаг | Результат | Классификация |
|---|---|---|
| `tsc` api + frontend | pass | — |
| `oxlint` | pass, warnings | existing: hooks/regex/fast-refresh. **Был new:** unused `emptyRetention` — удалён. |
| `npm test` (api) | 139 pass / 3 fail | **existing** `serialize.privacy.test.ts` |
| `npm run build` (web) | pass | — |
| `npm run build` (api) | pass | — |

Блокирующих warning сборки нет. Три падающих теста — старый privacy serialize, не аналитика.

---

## Fixes applied (мелкие)

1. `POST /analytics/lp` — `userId` только из сессии, не из body (`api/src/routes/analytics.ts`).
2. Хаб: подпись MAU «30×24ч от сейчас», не «30 дней МСК».
3. Обзор: если R7 пустой на today/7д — «окно короче D+7».
4. Удалён неиспользуемый `emptyRetention`.

Не трогали: формулы R7/Activation, social accept, loadMeaningful, права фронта, коллекторы воронок.

---

## Analytics system status

```text
READY WITH WARNINGS
```

**Почему не READY:** контракт «одна метрика = одно определение» нарушен (R7, Activation, MAU, AI user). Social accept считает не тот userId. Growth meaningful смотрит lifetime.

**Почему не NOT READY:** факты продукта целы; админ закрыт authz; основные воронки Обзора и тренировок читаемы; инъекция не создаёт лайки/чекины/тренировки; билд зелёный; продукт не регрессировал.

Пользоваться можно: Обзор (воронка + факты), Продукт/тренировки, Рост visitors, Залы density, Таймлайн.  
Нельзя без оговорки: сравнивать R7 между вкладками; принимать social Request→Chat; принимать Activation Обзора как Activation Роста.
