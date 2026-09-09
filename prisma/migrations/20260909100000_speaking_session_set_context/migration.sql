-- Existing runs remain unassigned: current membership cannot establish history.
ALTER TABLE "SpeakingSession" ADD COLUMN "speakingSetId" TEXT,
ADD COLUMN "speakingSetNameSnapshot" TEXT;
CREATE INDEX "SpeakingSession_speakingSetId_status_idx" ON "SpeakingSession"("speakingSetId", "status");
