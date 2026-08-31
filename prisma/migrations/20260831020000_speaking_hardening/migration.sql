-- Persist active-time pauses for Speaking Practice participants.
-- Existing participants start with no finalized pause duration.
ALTER TABLE "SpeakingParticipant"
  ADD COLUMN IF NOT EXISTS "pausedDurationMs" INTEGER NOT NULL DEFAULT 0;
