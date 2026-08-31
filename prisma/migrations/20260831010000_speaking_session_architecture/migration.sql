-- Follow-up to 20260831000000_add_speaking_practice.
-- The original migration may already be deployed, so keep this corrective
-- migration additive and scoped only to Speaking Practice tables.

ALTER TYPE "SpeakingActivityStatus" ADD VALUE IF NOT EXISTS 'archived';
ALTER TYPE "SpeakingSessionStatus" ADD VALUE IF NOT EXISTS 'paused';
ALTER TYPE "SpeakingSessionStatus" ADD VALUE IF NOT EXISTS 'ended';

DROP INDEX IF EXISTS "SpeakingActivity_joinCode_key";
ALTER TABLE "SpeakingActivity" DROP COLUMN IF EXISTS "joinCode";

ALTER TABLE "SpeakingSession"
  ADD COLUMN IF NOT EXISTS "joinCode" TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "pausedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "activitySnapshotJson" JSONB;

-- Backfill legacy rows before tightening the new classroom-run columns.
UPDATE "SpeakingSession"
SET "joinCode" = UPPER(SUBSTRING(MD5("id") FROM 1 FOR 6))
WHERE "joinCode" IS NULL;

UPDATE "SpeakingSession" AS s
SET "expiresAt" = COALESCE(s."startedAt", s."createdAt") + INTERVAL '8 hours'
WHERE s."expiresAt" IS NULL;

UPDATE "SpeakingSession" AS s
SET "activitySnapshotJson" = jsonb_build_object(
  'title', a."title",
  'scenario', a."scenario",
  'aiRole', a."aiRole",
  'studentRole', a."studentRole",
  'level', a."level",
  'difficulty', a."difficulty",
  'nativeLanguage', a."nativeLanguage",
  'durationSeconds', a."durationSeconds",
  'identifierMode', a."identifierMode",
  'targetExpressions', a."targetExpressionsJson",
  'rubric', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', r."criterionId",
      'name', r."name",
      'description', r."description",
      'enabled', r."enabled"
    ) ORDER BY r."position", r."id")
    FROM "SpeakingRubric" AS r
    WHERE r."activityId" = a."id"
  ), '[]'::jsonb)
)
FROM "SpeakingActivity" AS a
WHERE a."id" = s."activityId"
  AND s."activitySnapshotJson" IS NULL;

UPDATE "SpeakingSession"
SET "activitySnapshotJson" = '{}'::jsonb
WHERE "activitySnapshotJson" IS NULL;

ALTER TABLE "SpeakingSession"
  ALTER COLUMN "joinCode" SET NOT NULL,
  ALTER COLUMN "expiresAt" SET NOT NULL,
  ALTER COLUMN "activitySnapshotJson" SET NOT NULL,
  ALTER COLUMN "startedAt" DROP DEFAULT,
  ALTER COLUMN "startedAt" DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "SpeakingSession_joinCode_key" ON "SpeakingSession"("joinCode");
CREATE INDEX IF NOT EXISTS "SpeakingSession_joinCode_status_expiresAt_idx"
  ON "SpeakingSession"("joinCode", "status", "expiresAt");

DROP INDEX IF EXISTS "SpeakingParticipant_sessionId_key";
ALTER TABLE "SpeakingParticipant"
  ALTER COLUMN "startedAt" DROP DEFAULT,
  ALTER COLUMN "startedAt" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "helpPending" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "SpeakingParticipant_sessionId_status_idx"
  ON "SpeakingParticipant"("sessionId", "status");

ALTER TABLE "SpeakingTurn" ADD COLUMN IF NOT EXISTS "requestId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "SpeakingTurn_participantId_requestId_key"
  ON "SpeakingTurn"("participantId", "requestId");
