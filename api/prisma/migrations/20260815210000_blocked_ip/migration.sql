-- CreateTable
CREATE TABLE "BlockedIp" (
    "ip" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "blockedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedIp_pkey" PRIMARY KEY ("ip")
);
