-- CreateTable
CREATE TABLE "LandingEvent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL DEFAULT '',
    "placement" TEXT NOT NULL DEFAULT '',
    "path" TEXT NOT NULL DEFAULT '/lp',
    "utmSource" TEXT NOT NULL DEFAULT '',
    "utmMedium" TEXT NOT NULL DEFAULT '',
    "utmCampaign" TEXT NOT NULL DEFAULT '',
    "utmContent" TEXT NOT NULL DEFAULT '',
    "utmTerm" TEXT NOT NULL DEFAULT '',
    "fromParam" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "ip" TEXT NOT NULL DEFAULT '',
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LandingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LandingEvent_createdAt_idx" ON "LandingEvent"("createdAt");

-- CreateIndex
CREATE INDEX "LandingEvent_name_createdAt_idx" ON "LandingEvent"("name", "createdAt");

-- CreateIndex
CREATE INDEX "LandingEvent_visitorId_name_createdAt_idx" ON "LandingEvent"("visitorId", "name", "createdAt");

-- CreateIndex
CREATE INDEX "LandingEvent_utmCampaign_createdAt_idx" ON "LandingEvent"("utmCampaign", "createdAt");

-- CreateIndex
CREATE INDEX "LandingEvent_sessionId_name_idx" ON "LandingEvent"("sessionId", "name");
