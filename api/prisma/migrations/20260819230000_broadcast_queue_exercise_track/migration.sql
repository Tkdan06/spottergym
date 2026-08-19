-- D1: durable broadcast fan-out status
ALTER TABLE "AdminBroadcast" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'sent';
ALTER TABLE "AdminBroadcast" ADD COLUMN "deliveredCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AdminBroadcast" ADD COLUMN "failedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AdminBroadcast" ADD COLUMN "cursorOffset" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AdminBroadcast" ADD COLUMN "lastError" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AdminBroadcast" ADD COLUMN "finishedAt" TIMESTAMP(3);

UPDATE "AdminBroadcast"
SET
  "status" = 'sent',
  "deliveredCount" = "recipientCount",
  "cursorOffset" = "recipientCount",
  "finishedAt" = "createdAt";

CREATE INDEX "AdminBroadcast_status_createdAt_idx" ON "AdminBroadcast"("status", "createdAt");

-- C4: stable exercise identity across renames
ALTER TABLE "WorkoutExercise" ADD COLUMN "trackKey" TEXT NOT NULL DEFAULT '';
