# Spotter Analytics — Phase 3 Report

Дата: 2026-08-30  
Статус: раздел **Продукт** добавлен. Существующая админка не удалялась.

`docs/analytics/EVENTS.md` и `PHASE-1-REPORT.md` в репозитории нет. Опирались на `ANALYTICS-AUDIT.md`, Phase 2 Overview и живые факты/события.

---

## Что появилось

Аддитивно:

- `GET /admin/product?view=&preset=&from=&to=&gym=&source=&referral=`
- UI: `/app/admin/product/:section`
- Карточка **Продукт** на хабе
- Навигация: Воронки · Core Loop · Знакомства · Чаты · Тренировки · Активность · Прогресс · AI-тренер

Не трогали: хаб KPI, Overview, Retention, Players, landing, referrals, ops, tickets, broadcasts.

Агрегации только на сервере. В браузер уходят counts / воронки / распределения, не raw events.

---

## Фильтры

Один набор на все экраны Продукта:

| Фильтр | Как применяется |
|---|---|
| Дата | Те же пресеты Overview: сегодня / 7д / 30д / 90д / 12м / custom. Окно МСК, `to` exclusive. |
| Зал | `User.homeGymId` **или** `UserGym`. Пусто = все, **включая пользователей без зала**. |
| Источник | `LandingEvent.utmSource` при `userId`. `direct` = нет ни одного непустого UTM. |
| Реферал | `Invite.inviteeId`: все / да / нет. |

Acquisition→user по-прежнему без Phase 1 snapshot: источник = «есть событие с этим UTM», не first-touch склад.

---

## Определения

Окно везде: выбранный период, календарь **Europe/Moscow**.

`users` в воронках — **закрытая последовательность** (шаг N только если first(N) ≥ first(N−1)).  
`events` — все факты/события шага в окне (открытый счёт). Дубликаты не раздувают `users` (`MIN(ts)`).

### Social / Знакомства

| Step | Event | Numerator (users) | Denominator |
|---|---|---|---|
| People viewed | `people_list_viewed` | distinct userId | — |
| Profile viewed | `profile_viewed` | после people | people users |
| Like sent | `Like.createdAt` | после profile | profile users |
| Request sent | `Conversation.createdAt` | после like | like users |
| Request accepted | `chat_request_accepted` | после request | request users |
| Chat started | first `ChatMessage` / conv with message | после accept | accept users |
| Message sent | `ChatMessage` | после chat started | chat users |

Зал не обязателен. Home `people_list_viewed` по-прежнему не стреляет без зала (дырка коллектора, не фильтра).

### Чаты

KPI (открытые counts за период): requests / accepted / chats / messages.  
Воронка — те же **users**, что social с шага Request sent.

### Training / Тренировки

| Step | Event | Notes |
|---|---|---|
| Workout opened | `workout_started` | новая форма, не copy |
| Workout created | `WorkoutSession.performedAt` | факт, **не** CheckIn |
| Workout completed/saved | `workout_saved` ∪ session | отдельного completed нет |
| Workout repeated | session #2+ | первая может быть до окна |
| Progress viewed | `progress_opened` | session-once |

Check-in / «Я в зале» в эту воронку не входят.

### Activity

| Metric | Numerator | Denominator | Event |
|---|---|---|---|
| check-ins | rows | — | `CheckIn.checkedInAt` |
| active users | distinct userId с чекином | — | то же; **не** lastSeen, **не** workout |
| training days | distinct user × MSK day чекина | — | то же; **не** WorkoutSession |
| avg duration | mean seconds | check-ins | checkout / expiry / now, cap 8ч |
| distribution | hour-of-day МСК; buckets &lt;30м…3ч+ | — | то же |

Workout без чекина здесь не виден. Чекин без workout — виден.

### Progress

| Metric | Event | Numerator |
|---|---|---|
| opens | `progress_opened` | events |
| users | то же | distinct userId |
| period selections | **нет события** | всегда 0 |
| return | то же | users с ≥2 opens (разные сессии из-за session dedupe) |

### AI

| Step / KPI | Event | Numerator | Denominator |
|---|---|---|---|
| screen opened | `ai_analysis_opened` | users | — |
| requested | `ai_analysis_requested` | users / events | opened users / — |
| generated | `WorkoutAiInsight.createdAt` | users / rows | requested users / requested events |
| recommendation viewed | `ai_recommendation_viewed` | users | generated users |
| success rate | generated events / requested events | не value |
| failed | `ai_analysis_failed` | отдельно, не в generated |

Week recap не шлёт `ai_recommendation_viewed` — viewed занижен.

### Core Loop

Когорта: `User.registeredAt` в окне.

| Step | Event | Notes |
|---|---|---|
| Registration | `registeredAt` | cohort |
| Gym context | `gym_selected` ∪ `gym_skipped` ∪ homeGym ∪ UserGym | skip = прошёл шаг |
| People | `people_list_viewed` | после gym context |
| Profile | `profile_viewed` | |
| Social action | Like ∪ Conversation | |
| Chat | ChatMessage | |
| Return | lastSeen MSK day > reg day | после chat |

Median — медиана секунд между first(step) и first(prev) у тех, кто дошёл.

---

## Тесты

`api/src/lib/adminProduct.test.ts`:

- zero data
- duplicated events → 1 user, N events
- missing later event → drop-off
- out-of-order later step ignored
- timezone MSK
- user without gym included unless gym filter
- workout without check-in still training
- repeat = second session
- referral / source predicates
- activity duration + buckets
- progress return ≥2
- AI fail ≠ generated; success = generated/requested
- chats slice keeps social user counts

---

## Ограничения

- Нет Phase 1 identity/UTM snapshot — source filter грубый.
- `lastSeen` для Return не восстанавливает исторический DAU.
- Accept без `acceptedAt` — опираемся на `chat_request_accepted`.
- Progress period change не логируется.
- Social closed funnel требует people→… ; прямой like без people в окне не попадает в users (events всё равно видны).
- Индексы Phase 2 (`LandingEvent(userId,name,createdAt)` и др.) используются; новых таблиц нет.

---

## STOP

Phase 3 закончена. Phase 4 (Aha / гибкие когорты) не начиналась.
