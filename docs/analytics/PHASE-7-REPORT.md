# Spotter Analytics — Phase 7 Report

Дата: 2026-08-30  
Статус: **User Timeline** и **Event Debugger** добавлены. Остальная админка на месте.

---

## Что появилось

- `GET /admin/timeline/search?q=`
- `GET /admin/timeline?userId=&preset=&from=&to=&domain=&event=&source=&cursor=&limit=`
- `GET /admin/events/debug?preset=&from=&to=&name=&userId=`
- UI: `/app/admin/timeline` (вкладки Timeline / Debugger)
- Карточка **Таймлайн** на хабе
- Ссылка из карточки пользователя в Players

Новых permission keys нет.

---

## 1. User search

Ищем только по уже разрешённым идентификаторам:

```
id · username · name · email
```

Email уже есть в `GET /admin/users`. Не добавляли IP, город, пароль, токены. Лимит 20. Soft-deleted видны с флагом `deleted` — для диагностики.

Пустой запрос → 400. Несуществующий q → пустой список, не 500.

---

## 2. Product timeline

Хронология продуктовых шагов, не дамп таблиц:

```
Registration → Gym → People → Profile → Like → Request → Chat → Workout → Activity → Progress → AI
```

Источники:

| Шаг | Событие `LandingEvent` | Факт (без сырого payload) |
|---|---|---|
| Registration | `registration_completed` / landing register_* | `User.registeredAt` |
| Gym | `gym_selected`, `gym_skipped`, `first_checkin` | — |
| People | `people_list_viewed` | — |
| Profile | `profile_viewed`, `profile_completed` | — |
| Like | `like_sent` | `Like` (без пары целиком в UI) |
| Request | `chat_request_sent` | `Conversation` initiator |
| Chat | accept / `first_message_sent` | первое сообщение диалога, **без текста** |
| Workout | started / exercise / saved | `WorkoutSession`, **без упражнений и весов** |
| Activity | `activity_opened` | `CheckIn` (gymId только) |
| Progress | `progress_opened` | — |
| AI | ai_* | `WorkoutAiInsight.kind`, **без input/output JSON** |

Рядом стоящие событие и факт с одним ключом (≤ 2 с) схлопываются. Это product timeline, не два ряда об одном шаге.

---

## 3. Event details

Раскрытие:

```
Event · Timestamp · User · Domain · Metadata · Event ID
```

Metadata — только allowlist: `source`, `range`, `reason`, `surface`, `path`, `placement`, `gymId`.  
Секреты вырезаются даже если попали в placement JSON.

---

## 4. Filters

Серверные:

- **date** — те же MSK presets, что Overview
- **domain** — 12 продуктовых доменов + landing
- **event** — ключ каталога
- **source** — meta `source`, иначе `utmSource`, иначе `direct`; факты = `fact`

---

## 5. Event debugger

Отдельный режим. Считает по `LandingEvent` в периоде:

| Проверка | Правило |
|---|---|
| event count | все строки окна |
| duplicates | то же `userId + name + секунда`, выборка последних 400 |
| missing userId | `userId IS NULL` (часто лендинг до входа) |
| invalid timestamp | `createdAt` в будущем (&gt; now+1ч) или &lt; 2020-01-01 |
| invalid references | `userId` задан, строки в `User` нет |

Сэмплы без IP, UA, тел сообщений, JSON модели.

---

## 6. Permissions

Ключ тот же: **`viewUsers`**. `requirePerm`, как у Overview / Залы.

Обычный admin без `viewUsers` (только tickets / messageUsers) **не** получает таймлайн. Новой sensitive capability нет.

Фронт: `canViewUsers`, иначе редирект на хаб.

---

## 7. Performance

- страница 40 (max 80)
- keyset cursor `ISO|id`
- каждый источник: `ORDER BY at DESC LIMIT page+1`
- фильтры и сортировка на сервере
- полная история пользователя не загружается

---

## 8. Security

Никогда не отдаём:

- password / passwordHash
- auth tokens / tokenVersion
- API keys
- GigaChat credentials
- inputJson / outputJson AI
- тексты чатов
- веса / notes тренировки
- IP / User-Agent в timeline и debugger

Поиск не ходит в эти поля.

---

## 9. Testing

`api/src/lib/adminTimeline.test.ts`:

- admin без `viewUsers` / не-admin → отказ
- search: пустой q; только id/username/name/email
- product labels / domains
- collapse fact+event
- sanitize secrets
- 500 событий → страница 40 + cursor, не весь список
- duplicates / future / too-old timestamps

Unauthorized на роуте = 403 от `requirePerm` (тот же gate, что analytics).

---

## Ограничения

- Debugger duplicates — по последним 400 событиям окна, не полный GROUP BY секунд на всём архиве.
- `people_list_viewed` surface=gym по-прежнему без gymId.
- Source на app-событиях почти не пишется (кроме onboarding).
- Склейка visitor без userId в timeline пользователя не попадает.

---

## STOP

Phase 7 закончена. Следующая фаза не начиналась.
