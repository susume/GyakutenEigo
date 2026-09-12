-- Speaking evaluation resilience: bounded retry state and durable evaluator metadata.

ALTER TYPE "SpeakingEvaluationJobStatus" ADD VALUE IF NOT EXISTS 'retrying';

ALTER TABLE "SpeakingEvaluation"
  ADD COLUMN IF NOT EXISTS "metadataJson" JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "SpeakingEvaluationJob"
  ADD COLUMN IF NOT EXISTS "retryable" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "nextRetryAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "SpeakingEvaluationJob_status_nextRetryAt_idx"
  ON "SpeakingEvaluationJob"("status", "nextRetryAt");
