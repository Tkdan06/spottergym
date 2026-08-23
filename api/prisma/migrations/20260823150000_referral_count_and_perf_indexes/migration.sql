-- AlterTable
ALTER TABLE "User" ADD COLUMN "referralCreditedCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "User_lastSeenAt_idx" ON "User"("lastSeenAt");

-- CreateIndex
CREATE INDEX "CheckIn_checkedInAt_idx" ON "CheckIn"("checkedInAt");

-- Backfill cached circle counts
UPDATE "User" AS u
SET "referralCreditedCount" = (
  SELECT COUNT(*)::int
  FROM "Invite" AS i
  INNER JOIN "User" AS e ON e.id = i."inviteeId"
  WHERE i."inviterId" = u.id
    AND e."deletedAt" IS NULL
    AND e."onboardingDone" = true
);
