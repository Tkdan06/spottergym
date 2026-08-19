-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "broadcastId" TEXT;

-- CreateTable
CREATE TABLE "AdminBroadcast" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminBroadcast_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminBroadcast_createdAt_idx" ON "AdminBroadcast"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_broadcastId_read_idx" ON "Notification"("broadcastId", "read");

-- AddForeignKey
ALTER TABLE "AdminBroadcast" ADD CONSTRAINT "AdminBroadcast_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "AdminBroadcast"("id") ON DELETE SET NULL ON UPDATE CASCADE;
