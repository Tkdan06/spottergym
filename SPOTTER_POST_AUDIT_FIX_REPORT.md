# SPOTTER POST-AUDIT FIX REPORT

Дата: 2026-08-29  
База аудита: `SPOTTER_AUDIT.md` (2026-08-28)  
Ветка: `main` (пост-аудит правки)

Продуктовые решения, которые **не откатывались**:

- любой залогиненный может смотреть людей в любом зале;
- зал в онбординге необязателен;
- AI-разбор недели/месяца открыт всем (`WORKOUT_RECAP_ADMIN_ONLY = false`);
- синонимы упражнений не сливаются («Жим лёжа» ≠ «Жим штанги лёжа»).

---

## 1. Fixed

| Problem | Root cause | Fix | Files |
| ------- | ---------- | --- | ----- |
| После сохранения тренировки нет следующего шага | Экран view не вёл в прогресс | Состояние «Тренировка сохранена» + один CTA «Смотреть прогресс» | `src/pages/WorkoutEditorPage.tsx` |
| Пустой прогресс без действия | Empty copy не вёл записать сессию | Empty kit + «Записать тренировку»; recap скрыт при 0 сессий | `src/pages/WorkoutsProgressPage.tsx` |
| Прогресс считал 0/мусор как рабочие подходы | `weightKg`/`reps` без жёстких границ; `bestSet` брал ≤0 | Zod min weight 1 / reps 1; `isWorkingSet` пропускает невалид | `api/src/routes/meWorkouts.ts`, `api/src/lib/workouts.ts` |
| `trackKey` ломал историю или сливал разные имена | Клиентский UUID всегда новый; имя не канон | Если ключ уже в истории — оставить; иначе reuse по нормализованному имени; разные имена не мержить | `api/src/lib/workouts.ts`, `api/src/lib/workoutFeedback.test.ts` |
| Пустой пол «Мой зал» без следующего шага | Только «загляни позже» | True empty: пригласить + тихие Мой круг / другой зал; filtered empty: сброс фильтров | `src/pages/HomePage.tsx` |
| Нет зала = тупик сохранения профиля | Settings требовал gym | Copy «Ты ещё не выбрал зал» + Выбрать зал; settings без блокировки | `src/pages/HomePage.tsx`, `src/components/CheckInControl.tsx`, `src/pages/SettingsPage.tsx` |
| Удалённый профиль как 404/техошибка | Нет dedicated empty | «Профиль недоступен» + CTA в чаты | `src/pages/UserProfilePage.tsx` |
| `history.back()` на ключевых экранах | Непредсказуемый выход | Явные parent routes (`appNav`) | `src/lib/appNav.ts`, Chat / Activity / Gym / Install / Profile |
| Новые empty не как Spotter | Смесь muted/h2/inline styles | `.empty-copy` + title/lead + один primary | Home, Progress, Profile, Workouts, Chat, Activity |
| Нет in-app аналитики | Только LP `LandingEvent` | `POST /analytics/app`, allowlist meta, без тренировочных payload | `api/src/lib/appAnalytics.ts`, `src/lib/appTrack.ts`, call sites |
| Список людей зала — весь JSON | `GET /gyms/:id/people` без limit | Server-side `limit` (80, max 240) + `offset` + `hasMore` | `api/src/routes/gyms.ts`, `src/hooks/useGymPeople.ts` |
| Админка в основном бандле | Статические import всех страниц | Route-level `lazy` + `Suspense` для Admin / Feedback / Invite / UiKit / Coach / password | `src/App.tsx` |
| SEO обещал AI не всем | Текст «разбор доступен не всем» | Copy: разбор всем, у кого хватает записей; цепочка дневник → прогресс → плато → анализ | `src/content/workoutsGuide.ts` |
| Пользователю светились 500 / AxiosError / fetch failed | Сырой `err.message` + Hono default | Sanitize на клиенте; `onError` логирует, отдаёт человеческую фразу | `src/lib/userError.ts`, `src/lib/apiClient.ts`, `api/src/index.ts` |
| Бесконечный spinner / прыжок UI | Loader сразу, список обнулялся | Delayed `SoftLoader`, retry, не чистить данные на refresh error | Progress / Activity / Profile / Chat / people |
| Двойной submit дорогих действий | Нет in-flight на check-in/chat/register | Locks + Promise reuse; check-in идемпотентен в том же зале; chat `P2002`; like/AI уже были | `AppContext`, Register, Onboarding, `conversations.ts`, `me.ts` |
| Frontend-only validation | Zod дыры: age не int, workout id любой string | Age int 18–80; gym/user/workout/conversation id length; веса/reps/даты | `me.ts`, `meWorkouts.ts`, `conversations.ts` |
| Anonymous API отдавал скрытые поля | `serializePublicUser` оставлял `checkedInGymId`; нотификации брали настоящее имя | Явный redacted payload; `publicActorName` в like/chat/push | `api/src/lib/serialize.ts`, likes, conversations, me |
| GigaChat `rejectUnauthorized: false` | Обход НУЦ Минцифры | TLS verify on + optional Russian Trusted Root CA | `api/src/lib/gigachat.ts`, `api/src/env.ts`, `api/Dockerfile` |

---

## 2. Security

| Risk | Status | Fix |
| ---- | ------ | --- |
| GigaChat TLS отключён | Fixed | `rejectUnauthorized: true`; CA bundle (`GIGACHAT_CA_FILE` / `api/certs/…`) |
| Техтекст 500 в JSON пользователю | Fixed | Hono `onError` → «Не получилось выполнить запрос»; stack в server log |
| Anonymous: имя/зал/фото в публичном JSON | Fixed | Redact без spread полного профиля; зал в списке people только gym-scoped |
| Anonymous имя в like/chat notify/push | Fixed | `publicActorName` |
| Email / admin / passwordHash в public serializers | Already OK | Не входят в `serializePublicUser` / `serializePublicCard` |
| People list без членства в зале | Accepted (product) | Не закрывали: любой logged-in видит людей любого зала |
| Каталог `GET /gyms` без auth | Open | Каталог по-прежнему публичный (имя, адрес, счётчики) |
| `GET /media/:userId/:file` без auth | Open | Кто знает URL — читает файл; имена не угадываются легко |
| Rate limit in-memory на одном процессе | Open | Не шарится между инстансами Node |

---

## 3. AI Abuse Protection

| Protection | Status |
| ---------- | ------ |
| Authentication | Есть. Generate recap только с сессией; `userCanUseWorkoutRecap` (сейчас все залогиненные). |
| Ownership | Есть. Инсайт/прогресс/тренировки читаются только по `userId` сессии. Чужой recap не отдаётся. |
| Rate limiting | Есть. Generate week/month/coach: 1/мин по IP **и** по user. In-memory (см. Security). |
| Duplicate requests | Есть. Unique `(userId, kind, periodStart)`; `claimInsightPeriod` → `busy` / `exists`; P2002. Клиент `generatingRef`. |
| Payload limits | Есть. HTTP body 8 MB. В модель уходит sanitised facts, не сырой дневник со всеми полями профиля. |
| Result caching | Есть. Строка в Postgres на период; повторный generate не вызывает GigaChat, если письмо уже есть. |
| Concurrency | Есть. Claim + pending stale; клиент не шлёт второй generate, пока идёт первый. |

---

## 4. Data Integrity

**Activity / Workout separation**  
Check-in → `CheckIn`. Дневник → `WorkoutSession`. Пустой activity: «Пока без посещений», не «без тренировок». AI-факты по-прежнему могут включать activity minutes отдельно от объёма тренировок — это разные ряды, не одна метрика.

**Progress calculations**  
Подходы с весом &lt; 1, reps &lt; 1, NaN/∞ не рабочие. Периоды 7/30/90/180/365. PR и плато считают только working sets. Покрыто unit-тестами `workoutAnalytics` / insight / monthly.

**Exercise tracking**  
`trackKey`: сохранить клиентский ключ, если он уже в истории; иначе ключ той же нормализованной строки; разные имена не сливать. Legacy без ключа матчится по имени, не форсится новый UUID.

**Validation**  
Backend: age 18–80 int; gym/user/workout/conversation id 1–64; weight 1–300; reps 1–1000 int; имя упражнения 1–60; `performedAt` datetime; check-in timestamp только серверный `now`.

---

## 5. UX

**Empty states**  
Мой зал (нет людей / фильтр / нет зала), прогресс, дневник, активность, удалённый профиль, AI recap — `.empty-copy` + один primary.

**Dead ends**  
После save → прогресс. Пустой прогресс → записать. Нет зала → каталог. Удалённый профиль → чаты. Нет бесконечного `history.back()`.

**Navigation**  
`appNav`: chat → messages; activity/notifications → `/app`; gym `from=home|settings`; install `replace`.

**Error states**  
Человеческий текст + «Повторить» на людях, тренировках, прогрессе, активности, чате, AI. Не 500/AxiosError.

**Loading states**  
`SoftLoader` с задержкой в слоте контента; шапка не прыгает. Список людей/активность не обнуляются на тихий refresh.

---

## 6. Performance

**Bundle**  
Admin, Feedback, Invite, UiKit, Coach, forgot/reset password — `React.lazy`. Основные пользовательские экраны (зал, чаты, тренировки, прогресс) по-прежнему в initial chunk. Замер gzip initial **не снимался**.

**API**  
People: pagination, не полный зал. People+likes+referral — batch, не N+1 профилей. Профиль грузится при открытии. Progress/activity — агрегаты, не GET на каждую сессию.

**Images**  
Карточки: `SmartImage size="avatar"`. Серверного resize нет — браузер может всё ещё качать полный `/media/` файл.

**People list**  
limit 80 / max 240 / offset / «Показать ещё». Poll не перезапрашивает весь каталог сверх загруженного окна.

**Duplicate requests**  
`useGymPeople` держит текущую страницу. Check-in/like/chat/AI/save — in-flight. Тихий poll people не должен дублировать полный dump.

---

## 7. SEO

**Metadata**  
`src/seo/pages.json` + `SeoHead`. Статья анализа больше не противоречит открытому AI.

**Canonical**  
Prerender выставляет canonical; `/guide/partner-po-trenirovkam` → `/guide/workouts` (noindex+canonical).

**Sitemap / robots**  
`public/robots.txt` Disallow `/app`; sitemap из prerender indexable pages.

**Internal linking**  
Дневник ↔ прогресс ↔ плато ↔ анализ в body + `related`. Проверено headless на `/guide/workouts/training-analysis` (2026-08-29): «доступен не всем» нет, «доступен каждому» есть.

**Structured data**  
JSON-LD Article на guide-страницах с `schemaType` в prerender.

Ограничение: тело статьи в HTML для бота зависит от prerender/CSR; meta/canonical пишутся в build.

---

## 8. Analytics

События пишутся в `LandingEvent` с meta только `source | range | reason | surface`. Нет весов, повторов, имён упражнений, текстов сообщений.

| Event | Где |
| ----- | --- |
| `registration_completed` | Register success (клиент); once per user на API |
| `gym_selected` / `gym_skipped` | Onboarding finish |
| `profile_completed` | Onboarding finish |
| `first_checkin` | API check-in, если priorCount = 0 |
| `people_list_viewed` | Home / Gym detail (once per surface за сессию) |
| `profile_viewed` | Чужой профиль |
| `like_sent` | API like create |
| `chat_request_sent` | API create conversation |
| `chat_request_accepted` | API accept |
| `first_message_sent` | API first chat message (dedup per user) |
| `workout_started` | Новая тренировка |
| `exercise_added` | Кнопка «Упражнение» |
| `workout_saved` | Успешный save |
| `progress_opened` / `activity_opened` | Mount страницы |
| `ai_analysis_opened` | Week (range=7) / month (range=30) |
| `ai_analysis_requested` / `_completed` / `_failed` | Generate recap |
| `ai_recommendation_viewed` | Клик рекомендации месяца |

LP-воронка админки фильтрует только landing-имена, product events её не засоряют.

---

## 9. Regression Test Results

**Метод.** `npx tsc -b --noEmit` + `tsc -p api` — OK. `npm run test --prefix api` — **66/66**. Публичная `/guide/workouts/training-analysis` — headless dump. **Залогиненный проход в браузере не выполнялся** (нет сессии). PASS ниже = код + автотесты без известного слома, не E2E sign-off.

| Flow | Result |
| ---- | ------ |
| Registration | PASS |
| Login | PASS |
| Gym selection | PASS |
| Gym skip | PASS |
| Мой зал | PASS |
| Залы | PASS |
| People | PASS |
| Profile | PASS |
| Likes | PASS |
| Chat | PASS |
| Workout | PASS |
| Activity | PASS |
| Progress | PASS |
| AI | PASS |
| Privacy | PASS |
| SEO | PASS |

Privacy: unit `serialize.privacy.test.ts`. Workout/progress/AI: существующие analytics/insight/monthly/trackKey тесты. SEO: live dump статьи.

---

## 10. Remaining Issues

### Logged-in browser QA не прогонялся

**Problem.** Чеклист §9 не кликался под аккаунтом (регистрация → зал → люди → чат → тренировка → AI).  
**Why not fixed.** В сессии фикса не было логина на dev.  
**Risk.** Регрессии вёрстки/навигации могли пройти мимо tsc.  
**Recommended next step.** Один ручной проход по таблице §9 на staging.

### `GET /gyms` публичный без auth

**Problem.** Каталог залов (имя, адрес, membersCount, activeNow) доступен без сессии.  
**Why not fixed.** Не входило в post-audit scope; ломает лендинг/онбординг-поиск, если закрыть вслепую.  
**Risk.** Скрейпинг сети клубов и загрузки зала.  
**Recommended next step.** Auth на полный список; публично оставить короткий search для онбординга.

### Медиа без auth

**Problem.** `GET /media/:userId/:file` отдаёт файл по URL. Anonymous-фото в API пустые, но старый URL живёт.  
**Why not fixed.** Нужны signed URL или cookie на media; это отдельный деплой/nginx.  
**Risk.** Утечка фото при утечке URL.  
**Recommended next step.** Signed URLs или проверка сессии + не светить media-path анонимам (уже так в JSON).

### Rate limit только in-memory

**Problem.** Лимиты AI/auth не общие на несколько процессов.  
**Why not fixed.** Нет Redis в текущем деплое.  
**Risk.** При нескольких Node AI-квота 1/мин ослабевает.  
**Recommended next step.** Shared store или один процесс generate + nginx `limit_req`.

### Серверного resize картинок нет

**Problem.** `size="avatar"` — клиентский hint; файл на диске полный.  
**Why not fixed.** Нет image pipeline.  
**Risk.** Тяжёлый пол при большом зале.  
**Recommended next step.** Вариант avatar при upload или CDN transform.

### Синонимы упражнений

**Problem.** «Жим лёжа» и «Жим штанги лёжа» — разные ряды прогресса.  
**Why not fixed.** Явное продуктовое правило не сливать.  
**Risk.** Дробление PR.  
**Recommended next step.** Ручной alias в редакторе, не автомерж.

### People без членства в зале

**Problem.** Любой logged-in читает `GET /gyms/:id/people` (теперь страницами).  
**Why not fixed.** Продуктовое решение оставить.  
**Risk.** Перебор залов и сбор карточек (instagram у open-профилей в карточке).  
**Recommended next step.** Если политика сменится — membership или более тонкий public card (без instagram на полу).

### Два каталога залов

**Problem.** `src/data/gyms.json` и API seed могут разъехаться.  
**Why not fixed.** Вне scope этой волны.  
**Risk.** Карточка в UI ≠ запись в API.  
**Recommended next step.** Клиент только API; JSON только seed.

### Тренировки всё ещё не в нижней навигации

**Problem.** Аудит: core loop тренировок спрятан на два клика.  
**Why not fixed.** IA не входила в post-audit fix list.  
**Risk.** Низкая активация дневника.  
**Recommended next step.** Отдельное решение по таббару.

### GigaChat CA в git

**Problem.** `api/certs/russian_trusted_root_ca.pem` в working tree как untracked; Docker `COPY certs`.  
**Why not fixed.** Нужно решить: коммитить PEM или класть секретом на сервер.  
**Risk.** Прод без файла → AI падает на TLS.  
**Recommended next step.** Проверить прод `GIGACHAT_CA_FILE` / наличие certs в образе.

### Initial bundle не измерен после lazy

**Problem.** Lazy админки есть, цифры до/после нет.  
**Why not fixed.** Не гоняли `vite build --analyze`.  
**Risk.** Выигрыш меньше ожидания: Home/Workouts/Chat всё ещё eager.  
**Recommended next step.** Снять gzip initial на CI.
