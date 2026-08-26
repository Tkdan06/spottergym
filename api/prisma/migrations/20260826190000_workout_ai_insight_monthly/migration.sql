-- Monthly recap metadata on cached AI insights
ALTER TABLE "WorkoutAiInsight" ADD COLUMN "promptVersion" TEXT NOT NULL DEFAULT '';
ALTER TABLE "WorkoutAiInsight" ADD COLUMN "recommendationClickedAt" TIMESTAMP(3);
