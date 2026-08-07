-- Per-user chat pins (Telegram-style); each participant has their own pin state
ALTER TABLE "Conversation" ADD COLUMN "pinnedLowAt" TIMESTAMP(3);
ALTER TABLE "Conversation" ADD COLUMN "pinnedHighAt" TIMESTAMP(3);
