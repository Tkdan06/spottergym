# Spotter product context

## Purpose

Spotter is a social service for people who train in real sports clubs. Its central promise is: **«Увидел в зале — написал в Spotter»**. It is neither a generic dating app nor a generic fitness tracker.

## Core loops

```text
Gym → people → profile → like/request → acceptance → chat → real-world meeting → return

Workout → exercises → sets (weight + reps) → history → progress → AI insight → next workout

Gym/check-in → social interaction → workout/progress/AI → return
```

## Audience and product boundaries

Spotter serves gym members looking for training partners, social connection, coaches, and an easy way to record personal training progress. It must not drift into a Tinder clone, unrestricted social network, calorie tracker, Strava clone, bodybuilding forum, or corporate wellness system.

## Product decisions that are intentional

- The user may skip gym selection and add/change a gym later.
- The user may browse gyms they are not attached to.
- `Я в зале` records presence/activity; it does not create a workout.
- A manual workout can exist without a check-in.
- Full chat requires acceptance of a request.
- AI analysis is available to all users, works from recorded data, and must be cautious when data is insufficient.

These rules are expanded in [`DOMAIN_RULES.md`](DOMAIN_RULES.md).

## Product priorities

Spotter is feature-complete enough to measure. Prefer reliability, instrumentation, retention understanding, useful product iteration, qualitative feedback, and validated problems over speculative feature growth.

For meaningful feature work, formulate:

```text
Hypothesis → metric → implementation/experiment → result → decision
```

## Analytics intent

The product should explain acquisition, registration, activation, meaningful action, engagement, social/training/AI use, retention, referral quality and gym network density. Do not make causal claims from correlations or assert a density threshold before data supports one.

Existing event names and the actual analytics implementation take priority over conceptual naming. Read `docs/analytics/` and the relevant API route/lib before modifying instrumentation.
