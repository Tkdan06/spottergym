-- Optional, session-local note for a single exercise. Existing workouts remain unchanged.
ALTER TABLE "WorkoutExercise" ADD COLUMN "note" TEXT NOT NULL DEFAULT '';
