# 0002 — Monthly recap uses completed calendar months

Date: 2026-09-20
Status: accepted

## Context

The original monthly AI recap calculated a rolling 30-day window, while its UI displayed the current Moscow calendar month. Generating it during a month therefore saved a partial snapshot under that month's database key and prevented the user from receiving a true month-end report.

## Decision

The monthly recap uses the latest completed Moscow calendar month and compares it with the complete preceding month. It is generated and cached under the completed month's start date with a new `monthly-calendar` insight kind, so the stored result is a stable final report.

The weekly recap and progress views remain the places for current, changing signals. The monthly report does not infer check-in activity from workouts and currently omits activity data rather than displaying a mismatched rolling activity window.

## Consequences

On September 7, the report covers August 1–31 and compares it with July. September workouts cannot alter the August report; September's report becomes available after September closes.

Existing stored rolling-month records are retained, but new reads use the completed-period key and create correct reports going forward.

## References

- `api/src/lib/workoutMonthly.ts`
- `api/src/lib/workoutAnalytics.ts`
- `src/components/WorkoutMonthRecap.tsx`
- `api/src/lib/workoutMonthly.test.ts`
