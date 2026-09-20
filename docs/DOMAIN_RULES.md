# Spotter domain rules

These are intentional product behaviors, not accidental gaps. Preserve them unless a task explicitly changes the product requirement.

## Activity and workout are separate

- **Activity** is created from a user check-in (`Я в зале`) and measures real-gym presence/duration.
- **Workout** is a manually recorded journal session with exercises, sets, weight and reps.
- A workout without check-in and a check-in without workout are both valid.
- Do not merge, infer, or use one as a substitute for the other in UI, AI, analytics, or retention metrics.

## Gyms and presence

- Gym selection is optional during onboarding and later. An account without a gym is valid.
- A user can browse any gym, including one they have not joined. Keep `viewed gym` distinct from the user's home/current gym in product analytics.
- Live `activeNow` is derived from active check-ins, not catalog seed values. Catalog counts are fallback/demo metadata only.
- Check-ins have an expiry and bounded extensions. Preserve auto-expiry behavior.
- A workout reminder sent before a scheduled visit must not be sent when the user already has an active check-in; an expired check-in does not suppress the reminder.
- A user's last gym visit is derived only from their latest check-in in the **currently viewed gym**. It is exact date/time, opt-in (`lastGymVisitVisible`, default off), hidden while the user is currently in the gym or on a break, and always redacted for anonymous profiles.
- The same catalog is stored in `src/data/gyms.json` and `api/prisma/data/gyms.json`; change both, then update `cities.json` totals when applicable.

## Social and privacy

- The social path is profile → request → accept → chat. Do not expose unrestricted unsolicited DMs.
- Blocks must consistently hide users from discovery, likes, and chats.
- Anonymous profiles redact identity, username, photos, gym graph, city, schedule and precise presence data. Never weaken serializer behavior casually.
- Soft-deleted accounts remain represented safely enough for chat history, not as a live profile.

## Workouts and AI

- Preserve exercise identity across sessions through existing `trackKey`/normalization behavior. A copied exercise whose normalized visible name changes is a replacement, not a continuation: it must start a separate history and never inherit deltas from the prior card.
- A workout and each exercise may have an optional personal note. Exercise notes are session-local and must not be copied by the `Повторить` flow or exposed through analytics.
- While logging a workout, `Сохранить и продолжить` persists the current data but keeps the user in the editor. Only `Завершить тренировку` exits to the read-only result and asks for optional workout feedback.
- A workout share card is created locally only after an explicit user action. It includes the branded workout summary and `spottergym.ru`, but must not publish or upload the workout automatically.
- Strength progression (best working-set weight/reps) and workload progression (number of working sets) are separate signals. More or fewer sets must be shown as a workload change, not mislabelled as strength gained or lost.
- User workout feedback (`easy`, `normal`, `hard`) is an optional signal and must stay low-friction.
- AI must distinguish insufficient/missing data from a negative conclusion about progress.
- AI may discuss training load or a cautious recovery recommendation but must never diagnose, prescribe treatment, or make medical claims.
- Do not introduce a paywall or artificial rollout gate for AI without an explicit product decision.
- The monthly AI recap is a final report for the latest **completed** Moscow calendar month, compared with the complete month before it. Never label a rolling or partial period as a completed month, and do not lock a mid-month snapshot as that month's result. Current-period signals belong in the weekly recap and progress views.

## Analytics and administration

- Retention, cohorts, funnels and product analytics are server-side and based on real events/data.
- Prefer the existing event names; map legacy names rather than renaming historical data without a migration plan.
- Analytics and event-debug payloads must not contain passwords, tokens, API keys, message text, IP addresses, weight details, or GigaChat credentials unless an endpoint's existing access contract specifically allows the data.
- A correlation in Aha/growth analytics is not causal proof. Keep low-sample results marked as insufficient/unreliable.
- Admin access always goes through existing permission checks; do not use admin analytics to bypass user privacy boundaries.
