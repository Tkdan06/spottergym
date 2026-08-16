-- Per-user "delete for me" (Telegram-style). Null = visible in inbox.
ALTER TABLE "Conversation" ADD COLUMN "hiddenLowAt" TIMESTAMP(3);
ALTER TABLE "Conversation" ADD COLUMN "hiddenHighAt" TIMESTAMP(3);
