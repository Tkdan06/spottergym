ALTER TABLE "User" ADD COLUMN "lastGymVisitVisible" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "CheckIn_userId_gymId_checkedInAt_idx"
  ON "CheckIn"("userId", "gymId", "checkedInAt" DESC);
