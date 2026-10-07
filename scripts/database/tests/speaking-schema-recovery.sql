-- Run against a migrated disposable PostgreSQL database:
-- psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/database/tests/speaking-schema-recovery.sql
-- Temporary tables shadow application tables; all changes roll back.
BEGIN;

CREATE TEMP TABLE "SpeakingParticipant" (
  "id" TEXT PRIMARY KEY,
  "status" "SpeakingParticipantStatus" NOT NULL,
  "helpPending" BOOLEAN NOT NULL,
  "finishedAt" TIMESTAMP(3) NOT NULL
);
CREATE TEMP TABLE "SpeakingEvaluationJob" (
  LIKE public."SpeakingEvaluationJob" INCLUDING DEFAULTS
);
CREATE TEMP TABLE "SpeakingEvaluation" (
  "participantId" TEXT PRIMARY KEY,
  "scoresJson" JSONB NOT NULL
);
CREATE TEMP TABLE "SpeakingTurn" (
  "participantId" TEXT NOT NULL,
  "speaker" "SpeakingTurnSpeaker" NOT NULL,
  "text" TEXT NOT NULL
);

INSERT INTO "SpeakingParticipant" VALUES
  ('affected', 'error', true, '2026-10-07 21:15:00'),
  ('saved-result', 'completed', false, '2026-10-07 21:15:00'),
  ('completed-job', 'completed', false, '2026-10-07 21:15:00'),
  ('queued-job', 'evaluating', false, '2026-10-07 21:15:00'),
  ('running-job', 'evaluating', false, '2026-10-07 21:15:00'),
  ('retrying-job', 'evaluating', false, '2026-10-07 21:15:00'),
  ('authentication', 'error', true, '2026-10-07 21:15:00'),
  ('older-release', 'error', true, '2026-09-01 00:00:00'),
  ('empty-speech', 'error', true, '2026-10-07 21:15:00'),
  ('ai-only', 'error', true, '2026-10-07 21:15:00'),
  ('no-turns', 'error', true, '2026-10-07 21:15:00');

INSERT INTO "SpeakingEvaluationJob" (
  "id", "participantId", "status", "attempt", "queuedAt", "startedAt",
  "finishedAt", "leaseUntil", "lastErrorCode", "retryable", "nextRetryAt", "updatedAt"
)
SELECT 'job-' || "id", "id", 'failed', 1, "finishedAt", "finishedAt",
  "finishedAt", "finishedAt", 'bad_request', false, "finishedAt", "finishedAt"
FROM "SpeakingParticipant";

UPDATE "SpeakingEvaluationJob" SET "status" = 'completed' WHERE "participantId" = 'completed-job';
UPDATE "SpeakingEvaluationJob" SET "status" = 'queued' WHERE "participantId" = 'queued-job';
UPDATE "SpeakingEvaluationJob" SET "status" = 'running' WHERE "participantId" = 'running-job';
UPDATE "SpeakingEvaluationJob" SET "status" = 'retrying' WHERE "participantId" = 'retrying-job';
UPDATE "SpeakingEvaluationJob" SET "lastErrorCode" = 'authentication' WHERE "participantId" = 'authentication';

INSERT INTO "SpeakingEvaluation" VALUES ('saved-result', '{"communication": 3}');
INSERT INTO "SpeakingTurn"
SELECT "id", 'student', 'I would like the blue shirt, please.'
FROM "SpeakingParticipant" WHERE "id" NOT IN ('empty-speech', 'ai-only', 'no-turns');
INSERT INTO "SpeakingTurn" VALUES ('empty-speech', 'student', '   '), ('ai-only', 'ai', 'What would you like?');

CREATE TEMP TABLE participants_before AS SELECT * FROM "SpeakingParticipant";
CREATE TEMP TABLE jobs_before AS SELECT * FROM "SpeakingEvaluationJob";
CREATE TEMP TABLE turns_before AS SELECT * FROM "SpeakingTurn";
CREATE TEMP TABLE evaluations_before AS SELECT * FROM "SpeakingEvaluation";

\ir ../../../prisma/migrations/20261008000000_recover_speaking_schema_failures/migration.sql

DO $$ BEGIN
  ASSERT (SELECT "status" = 'failed' AND "attempt" = 1
    AND "lastErrorCode" = 'gemini_json_schema_recovery_pending' AND "retryable" = false
    AND "updatedAt" = CURRENT_TIMESTAMP::timestamp(3)
    FROM "SpeakingEvaluationJob" WHERE "participantId" = 'affected'),
    'Affected job must wait for a corrected worker to claim it';
  ASSERT (SELECT (to_jsonb(after) - 'lastErrorCode' - 'updatedAt') =
      (to_jsonb(before) - 'lastErrorCode' - 'updatedAt')
    FROM "SpeakingEvaluationJob" AS after JOIN jobs_before AS before USING ("participantId")
    WHERE after."participantId" = 'affected'),
    'Migration must preserve the original job until a corrected worker claims it';
  ASSERT (SELECT "status" = 'evaluating' AND NOT "helpPending"
    AND "finishedAt" = TIMESTAMP '2026-10-07 21:15:00'
    FROM "SpeakingParticipant" WHERE "id" = 'affected'),
    'Participant must resume evaluation without changing the original finish time';
  ASSERT NOT EXISTS (
    SELECT 1 FROM "SpeakingEvaluationJob" AS after
    JOIN jobs_before AS before USING ("participantId")
    WHERE after."participantId" <> 'affected' AND to_jsonb(after) <> to_jsonb(before)
  ), 'Recovery changed an unrelated job';
  ASSERT NOT EXISTS (
    SELECT 1 FROM "SpeakingParticipant" AS after
    JOIN participants_before AS before USING ("id")
    WHERE after."id" <> 'affected' AND to_jsonb(after) <> to_jsonb(before)
  ), 'Recovery changed an unrelated participant';
  ASSERT NOT EXISTS (
    (SELECT * FROM "SpeakingTurn" EXCEPT SELECT * FROM turns_before)
    UNION ALL (SELECT * FROM turns_before EXCEPT SELECT * FROM "SpeakingTurn")
  ), 'Recovery changed the saved transcript';
  ASSERT NOT EXISTS (
    (SELECT * FROM "SpeakingEvaluation" EXCEPT SELECT * FROM evaluations_before)
    UNION ALL (SELECT * FROM evaluations_before EXCEPT SELECT * FROM "SpeakingEvaluation")
  ), 'Recovery changed an existing evaluation';
END $$;

CREATE TEMP TABLE jobs_after AS SELECT * FROM "SpeakingEvaluationJob";
\ir ../../../prisma/migrations/20261008000000_recover_speaking_schema_failures/migration.sql
DO $$ BEGIN
  ASSERT NOT EXISTS (
    SELECT 1 FROM "SpeakingEvaluationJob" AS after
    JOIN jobs_after AS before USING ("participantId")
    WHERE to_jsonb(after) <> to_jsonb(before)
  ), 'Running recovery again must leave already marked jobs unchanged';
END $$;

ROLLBACK;
SELECT 'Speaking schema recovery regression passed' AS result;
