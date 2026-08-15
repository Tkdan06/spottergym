-- AlterTable
ALTER TABLE "User" ADD COLUMN "signupIp" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "User_signupIp_idx" ON "User"("signupIp");
