-- AlterTable
ALTER TABLE "CheckIn" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "CheckIn" ADD COLUMN "extendCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill open sessions: expire 3 hours after check-in
UPDATE "CheckIn"
SET "expiresAt" = "checkedInAt" + INTERVAL '3 hours'
WHERE "checkedOutAt" IS NULL AND "expiresAt" IS NULL;

-- CreateIndex
CREATE INDEX "CheckIn_expiresAt_checkedOutAt_idx" ON "CheckIn"("expiresAt", "checkedOutAt");
