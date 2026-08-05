-- AlterTable
ALTER TABLE "User" ADD COLUMN "username" TEXT;

-- Backfill unique usernames for existing rows
UPDATE "User"
SET "username" = 'u' || substr(md5(random()::text || "id"), 1, 10)
WHERE "username" IS NULL OR "username" = '';

-- Enforce NOT NULL + unique
ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE INDEX "User_username_idx" ON "User"("username");
