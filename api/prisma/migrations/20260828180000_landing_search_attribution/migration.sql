-- Search-engine attribution on landing funnel events (Google / Yandex / keyword).
ALTER TABLE "LandingEvent" ADD COLUMN "referrer" TEXT NOT NULL DEFAULT '';
ALTER TABLE "LandingEvent" ADD COLUMN "searchEngine" TEXT NOT NULL DEFAULT '';
ALTER TABLE "LandingEvent" ADD COLUMN "searchKeyword" TEXT NOT NULL DEFAULT '';
ALTER TABLE "LandingEvent" ADD COLUMN "clickId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "LandingEvent" ADD COLUMN "searchPaid" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "LandingEvent_searchEngine_createdAt_idx" ON "LandingEvent"("searchEngine", "createdAt");
