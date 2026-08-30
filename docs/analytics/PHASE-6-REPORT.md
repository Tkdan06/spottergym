# Spotter Analytics — Phase 6 Report

Дата: 2026-08-30  
Статус: раздел **Залы** добавлен. География (`/app/admin/geography`) и остальные админ-экраны на месте.

---

## Что появилось

- `GET /admin/gyms?preset=&from=&to=&sort=activeUsers|retention|social|growth`
- UI: `/app/admin/gyms`
- Карточка **Залы** на хабе

Не трогали каталог `Gym`, `User.homeGymId`, `UserGym`, чекины, просмотр любого зала, онбординг без зала.

---

## Цель

Понять, в каких клубах Spotter уже создаёт социальную ценность, а где людей пока мало. Пустой / low-density клуб — product opportunity, не ошибка данных.

---

## Атрибуция

| Метрика | Источник | Куда относится |
|---|---|---|
| Total / Active / Today / WAU / MAU / R7 / R30 / Growth | `User` (`deletedAt` IS NULL) | **Current gym** = `homeGymId` сейчас |
| People available | `UserGym` | клуб членства (карточка зала) |
| Social actions / actors / chats | Like, Conversation, ChatMessage в периоде | **home gym актёра** |
| Workouts | `WorkoutSession.performedAt` | home gym пользователя |
| Check-ins / viewed users | `CheckIn.gymId` | **viewed gym** |
| People list home / gym card | `people_list_viewed` | surface only; **без gymId** |

Like / Conversation / ChatMessage / Workout **не имеют gymId**. Честное правило (аудит): не приписывать действие «залу карточки». Актёр → его current gym.

Истории смены зала нет. R7/R30 и current gym — снимок `homeGymId` на момент отчёта.

DAU / WAU / MAU — lastSeen в окне периода, те же clipped windows, что Overview (`>= from`, `< to`).

Retention — exact calendar day D+N по `lastSeenAt`, МСК. Thin, если eligible &lt; 8.

---

## 1. Gym overview

На каждый клуб каталога + служебные ряды:

```
Total users
Active users
Active today
WAU
MAU
R7
R30
Social actions (и unique actors)
Chats
Workouts
Check-ins
People (UserGym)
Growth (регистрации в периоде с этим home gym)
```

Служебные ряды:

- **Без зала** — `homeGymId` пустой. Не выкидываются.
- **Нет в каталоге** — `homeGymId` есть, строки в `Gym` нет (stale / «удалённый» клуб). У `Gym` нет `deletedAt`.

---

## 2. Social density

Сначала фактическое распределение по каталогу (включая пустые):

```
Users per gym
Active users per gym
People available
Social interactions (unique actors)
```

Корзины: 0 / 1 / 2–3 / 4–9 / 10–24 / 25+.  
Перцентили p50 / p90 — nearest-rank, не продуктовый порог.

Порогов «здоровой плотности» нет.

---

## 3. Gym ranking

Сортировка (переключается в UI и `sort=`):

- active users
- retention (R7, затем eligible)
- social (actors, затем actions)
- growth

Каталог сверху; без зала / нет в каталоге — ниже.

---

## 4. Network effect signal

По клубам с ≥1 home user:

```
active users  vs  social rate (actors / active)  vs  R7
```

Pearson r. В UI: «корреляция, не причина». Thin при n &lt; 8 или нет дисперсии (`r = null`).

Это исследование, не доказательство network effect.

---

## 5. Current gym

Отдельный блок: сумма по каталогу (users, active, social, R7/R30) + счётчики без зала и stale gym.

---

## 6. Empty / low density

Не ошибка.

- **Empty** — 0 домашних пользователей. Каталог всё равно в таблице.
- **Low density** — есть домашние пользователи и active ≤ 1. Это описание левого хвоста наблюдаемого распределения, не SLA и не придуманный health-threshold.

---

## 7. Current vs viewed

Смотреть любой зал — сознательная механика.

| Сигнал | Current | Viewed |
|---|---|---|
| homeGymId | да | нет |
| Check-in в этом клубе | нет | да |
| Check-in при другом home | нет | **viewed other** |
| `people_list_viewed` surface=home | да (есть зал) | нет |
| `people_list_viewed` surface=gym | нельзя разложить | unique users, **без gymId** |

Не строили per-gym people-view из session-deduped события. В отчёте один глобальный счётчик «открыл карточку зала».

---

## 8. Testing

`api/src/lib/adminGyms.test.ts`:

- users without gym → ряд «Без зала», не drop
- gyms without users → empty, в списке, low density = false
- user viewing other gym → viewed/check-ins на чужом клубе, social остаётся на home
- deleted / missing catalog gym → ряд «Нет в каталоге»
- duplicated likes / messages / check-ins → unique actors / viewed users, counts сохраняются
- sort keys
- Pearson thin / no causation
- R7 = exact D+7, не окно 7 дней

---

## Ограничения

- Нет gymId на like / chat / workout — social и тренировки не являются «активностью в этом зале».
- Нет gymId на `people_list_viewed` surface=gym — нельзя честно сказать, какой клуб смотрели.
- Нет истории `homeGymId` — смена зала сдвигает всю прошлую атрибуцию.
- Soft-deleted users исключены; Gym cascade удаляет UserGym, но stale `homeGymId` остаётся возможным.
- Сумма social actors по клубам не равна уникальным людям сети, если когда-нибудь появится двойная атрибуция (сейчас один home).

---

## STOP

Phase 6 закончена. Phase 7 не начиналась.
