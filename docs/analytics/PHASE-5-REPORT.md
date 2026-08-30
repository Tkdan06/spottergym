# Spotter Analytics — Phase 5 Report

Дата: 2026-08-30  
Статус: раздел **Рост** добавлен. `LandingEvent` не перестраивался. Старые экраны «Трафик и поиск» и «Рефералы» на месте.

---

## Что появилось

- `GET /admin/growth?view=acquisition|landing|seo|referral&preset=&from=&to=`
- UI: `/app/admin/growth/:section`
- Карточка **Рост** на хабе

Не трогали коллекторы `POST /analytics/lp` и `/analytics/app`, схему `LandingEvent`, `/admin/landing`, `/admin/referrals`.

---

## Атрибуция

1. **Visitor** — unique `visitorId` с landing `view` в выбранном окне (MSK range, как Overview).
2. **First touch в окне** — самый ранний `view` этого visitor (UTM/referrer/search с события, first-touch уже пишет клиент на каждое событие).
3. **User** — самый ранний `LandingEvent.userId` у того же `visitorId`.
4. **Registration** считается, только если `registeredAt >= firstView` (возврат позже и регистрация — да; уже существующий аккаунт до визита — нет).

Нет `acquisitionVisitorId` на User (Phase 1 не вышел). Склейка только через совпавший visitorId.

### Канал

| Правило | Channel / source |
|---|---|
| непустой `utmSource` | utm / это значение |
| `searchEngine` + paid | paid_search / engine |
| `searchEngine` organic | seo / engine |
| `utmMedium=organic` без source | organic |
| invitee или `fromParam` | referral |
| иначе (пустой UTM, пробелы) | **direct** |

---

## Воронка Acquisition

```
Landing visitor → Registration → Activation → Meaningful action → R7 → R30
```

- Activation = то же, что Overview «вход»: lastSeen > register + 2 мин **или** meaningful. Зал не обязателен.
- Meaningful = Like / Conversation / ChatMessage / WorkoutSession / CheckIn / people|profile viewed.
- R7/R30 = exact calendar day D+N по lastSeen (МСК). В таблице источников «—», если eligible &lt; 8.

Цель: видеть, какой трафик даёт пользователей, не только визиты.

---

## Landing

Views, unique visitors, CTA, `register_success` за тот же период. Разрезы только по **непустым** utm_campaign / content / term / referrer. Дубли `view` на visitor схлопываются (`DISTINCT ON`).

Старый экран 24/7/30 + recent log: `/app/admin/landing`.

---

## SEO

Визиты с непустым `searchEngine`. Registrations / activation / R7 / R30 среди склеенных users.

Ключи: только `searchKeyword <> ''`. Пустой ключ — счётчик «без ключа», не фейковая семантика. Google часто не отдаёт q — это ожидаемо.

---

## Referral

Текущий круг/лидеры не удалялись (`/app/admin/referrals`).

Воронка:

```
Invite sent → Invite opened → Registration → Activation → R7 → R30
```

**Invite opened нет в данных** (нет `invite.opened`). Шаг = 0, в UI явно «события нет». Не выдумывали opens из регистраций.

`Invite` создаётся в момент регистрации по коду — sent ≈ registration. Главная метрика качества:

```
invited users → activated → retained R7/R30
```

не число ссылок.

---

## Cross

На Acquisition: топ-20 ячеек Source × домашний зал (или «без зала») с regs / activation / R7. Не универсальный куб.

---

## Тесты

`api/src/lib/adminGrowth.test.ts`:

- missing / blank UTM → direct
- malformed whitespace
- organic, SEO vs paid
- referral vs UTM priority
- duplicate visitorIds
- late registration attributed; earlier account not
- activation without gym
- zero visitors → null rates

---

## Ограничения

- Visitor без later `userId` на событиях не попадёт в registrations.
- Один view на сессию на все SEO-пути (аудит) — визиты `/guide` после `/` недосчитаны.
- Invite open по-прежнему дырка.

---

## STOP

Phase 5 закончена. Phase 6 (gym density) не начиналась.
