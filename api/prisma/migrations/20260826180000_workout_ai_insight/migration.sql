-- Cached weekly GigaChat insight
CREATE TABLE "WorkoutAiInsight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'weekly',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "inputJson" JSONB NOT NULL,
    "inputHash" TEXT NOT NULL,
    "outputJson" JSONB NOT NULL,
    "model" TEXT NOT NULL DEFAULT '',
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "viewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkoutAiInsight_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkoutAiInsight_userId_kind_periodStart_key" ON "WorkoutAiInsight"("userId", "kind", "periodStart");
CREATE INDEX "WorkoutAiInsight_userId_createdAt_idx" ON "WorkoutAiInsight"("userId", "createdAt");

ALTER TABLE "WorkoutAiInsight" ADD CONSTRAINT "WorkoutAiInsight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
