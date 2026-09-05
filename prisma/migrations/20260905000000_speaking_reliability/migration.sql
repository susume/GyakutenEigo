-- Speaking Practice reliability: immutable scenario resources, lifecycle
-- revisions/heartbeat data, idempotent joins, and durable evaluation jobs.

ALTER TABLE "SpeakingActivity"
  ADD COLUMN IF NOT EXISTS "scenarioResourcesJson" JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "SpeakingSession"
  ADD COLUMN IF NOT EXISTS "revision" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "SpeakingParticipant"
  ADD COLUMN IF NOT EXISTS "joinRequestId" TEXT,
  ADD COLUMN IF NOT EXISTS "readyAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "SpeakingParticipant_sessionId_joinRequestId_key"
  ON "SpeakingParticipant"("sessionId", "joinRequestId");

DO $$ BEGIN
  CREATE TYPE "SpeakingEvaluationJobStatus" AS ENUM ('queued', 'running', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "SpeakingEvaluationJob" (
  "id" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "status" "SpeakingEvaluationJobStatus" NOT NULL DEFAULT 'queued',
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "leaseUntil" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SpeakingEvaluationJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SpeakingEvaluationJob_participantId_key"
  ON "SpeakingEvaluationJob"("participantId");
CREATE INDEX IF NOT EXISTS "SpeakingEvaluationJob_status_updatedAt_idx"
  ON "SpeakingEvaluationJob"("status", "updatedAt");

DO $$ BEGIN
  ALTER TABLE "SpeakingEvaluationJob"
    ADD CONSTRAINT "SpeakingEvaluationJob_participantId_fkey"
    FOREIGN KEY ("participantId") REFERENCES "SpeakingParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
