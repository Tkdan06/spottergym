-- Weekly GigaChat coach letter cache
CREATE TABLE "WorkoutCoachReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "factsJson" JSONB NOT NULL,
    "letterJson" JSONB NOT NULL,
    "model" TEXT NOT NULL DEFAULT '',
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkoutCoachReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkoutCoachReport_userId_periodStart_key" ON "WorkoutCoachReport"("userId", "periodStart");
CREATE INDEX "WorkoutCoachReport_userId_createdAt_idx" ON "WorkoutCoachReport"("userId", "createdAt");

ALTER TABLE "WorkoutCoachReport" ADD CONSTRAINT "WorkoutCoachReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
