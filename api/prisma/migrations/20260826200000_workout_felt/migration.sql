-- Subjective workout feel; existing rows stay NULL (not backfilled).
CREATE TYPE "WorkoutFelt" AS ENUM ('easy', 'normal', 'hard');

ALTER TABLE "WorkoutSession" ADD COLUMN "feedback" "WorkoutFelt";
ALTER TABLE "WorkoutSession" ADD COLUMN "feedbackPromptedAt" TIMESTAMP(3);
ALTER TABLE "WorkoutSession" ADD COLUMN "feedbackSetAt" TIMESTAMP(3);
