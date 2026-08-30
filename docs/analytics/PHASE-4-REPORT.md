# Spotter Analytics — Phase 4 Report

Дата: 2026-08-30  
Статус: когорты и Aha добавлены. Существующая админка не удалялась. Формула Day-N хаба не менялась.

---

## Что появилось

- `GET /admin/cohorts` — таблица когорт
- `GET /admin/aha` — сравнение действия и ranking кандидатов
- UI: `/app/admin/cohorts` (вкладки Когорты / Aha)
- Карточка на хабе; ссылка с Обзора «Когорты»

Старый `/app/admin/analytics` (R1–R60, unweighted daily mean) остаётся как есть.

Агрегации только на сервере.

---

## Retention

Та же семантика, что на хабе:

- `lastSeenAt` ровно в календарный день **D+N** (МСК)
- не «хотя бы раз за N дней»
- D+N должен наступить (`target day < сегодня`)

Отличие таблицы когорт: **pooled** по неделе/месяцу (retained / eligible), не среднее дневных ставок за 28 дней. Подпись в UI это говорит.

---

## Когорты

| | |
|---|---|
| Ось | неделя регистрации (пн МСК) или месяц `YYYY-MM` |
| Метрики | R1, R3, R7, R14, R30, R60 |
| Окно | пресеты Overview (по умолчанию 90 дней) |

### Dimensions (без segment builder)

**Acquisition** (first-touch `LandingEvent` с `userId`, иначе пусто):

- source / medium / campaign
- referral = есть `Invite`
- SEO = `searchEngine` и не paid
- organic = SEO **или** `utmMedium=organic`

**Product** (после регистрации, когда-либо):

- gym selected = `homeGymId` или событие `gym_selected` (skip не считается)
- social = Like или Conversation
- workout = WorkoutSession
- AI = insight или `ai_analysis_*`

---

## Aha

Выбор действия → Performed vs Did not.

Действие засчитывается только в **первые 7 календарных дней** после регистрации. Иначе те, кто вернулся, успевают «догнать» действие и сравнение врёт.

Сравниваем: R1, R7, R14, R30, средние active days / workouts / check-ins.

Active days = различные дни МСК с чекином, тренировкой, лайком или сообщением. Не heartbeat `lastSeen`.

### Тексты

- «Пользователи, совершившие действие X, имеют retention выше/ниже, чем пользователи, которые его не совершали.»
- «Корреляция, не причинно-следственная связь.»
- Нет формулировок «действие увеличивает retention».

Если выборка &lt; 8 с любой стороны — caption «недостаточно данных», в ячейках «мало».

---

## Ranking

```
score = (R7_with − R7_without) × √min(n_with, n_without)
```

`n` — eligible для R7 (окно уже наступило).  
Тонкие строки (n &lt; 8 с любой стороны) внизу, без score.  
3 человека с 100% не становятся главным Aha.

---

## Тесты

`api/src/lib/adminCohorts.test.ts`:

- границы недели/месяца МСК
- exact-day D+N и unobserved users
- действие после D+7 не считается
- нет действия → without
- SEO / organic / referral / gym_selected ≠ skip
- tiny 100% не выигрывает ranking
- caption без «увеличивает»

---

## Ограничения

- UTM first-touch только если на событии уже есть `userId` (Phase 1 snapshot нет).
- `lastSeen` по-прежнему не восстанавливает историю визитов.
- Week recap почти не шлёт `ai_recommendation_viewed`; для Aha AI = request/insight.

---

## STOP

Phase 4 закончена. Phase 5 (Growth / source→R7 warehouse) не начиналась.
