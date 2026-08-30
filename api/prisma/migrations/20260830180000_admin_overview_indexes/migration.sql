-- Additive indexes for admin Overview aggregations (date-range scans, no raw-event download).

CREATE INDEX "User_deletedAt_registeredAt_idx" ON "User"("deletedAt", "registeredAt");

CREATE INDEX "LandingEvent_userId_name_createdAt_idx" ON "LandingEvent"("userId", "name", "createdAt");

CREATE INDEX "Like_createdAt_idx" ON "Like"("createdAt");

CREATE INDEX "Conversation_createdAt_idx" ON "Conversation"("createdAt");

CREATE INDEX "Conversation_initiatedById_createdAt_idx" ON "Conversation"("initiatedById", "createdAt");

CREATE INDEX "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");

CREATE INDEX "WorkoutSession_performedAt_idx" ON "WorkoutSession"("performedAt");

CREATE INDEX "WorkoutAiInsight_createdAt_idx" ON "WorkoutAiInsight"("createdAt");
