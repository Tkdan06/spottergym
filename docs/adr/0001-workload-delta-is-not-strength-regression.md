# 0001 — Workload delta is not strength regression

Date: 2026-09-20
Status: accepted

## Context

The workout journal stores every working set, but the progress view originally classified an exercise only by the best set's weight and repetitions. Copying a workout and adding or removing a set therefore left no exercise-level signal in the UI.

## Decision

Calculate the change in working-set count between the first and latest matching exercise in the selected progress period. Show it as workload (`+1 подход` or `−1 подход`) alongside strength progress. Do not convert a lower set count into a statement that the user became weaker.

The saved workout detail also compares its set count with the preceding workout of the same title, so the copied-workout flow gives immediate feedback.

## Consequences

Users can see volume-program changes even when weight and repetitions stay equal. The signal is intentionally neutral: a reduction can be a deload or a plan adjustment rather than a regression. Existing strength charts and strength trend semantics remain unchanged.

## References

- `api/src/lib/workoutAnalytics.ts`
- `api/src/lib/workouts.ts`
- `src/lib/progressInsight.ts`
- `api/src/lib/workoutAnalytics.test.ts`
