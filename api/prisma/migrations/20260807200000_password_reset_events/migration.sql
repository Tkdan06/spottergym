-- CreateTable
CREATE TABLE "PasswordResetEvent" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "ip" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PasswordResetEvent_createdAt_idx" ON "PasswordResetEvent"("createdAt");

-- CreateIndex
CREATE INDEX "PasswordResetEvent_email_idx" ON "PasswordResetEvent"("email");

-- CreateIndex
CREATE INDEX "PasswordResetEvent_status_idx" ON "PasswordResetEvent"("status");

-- CreateIndex
CREATE INDEX "PasswordResetEvent_userId_idx" ON "PasswordResetEvent"("userId");
