-- The Gemini evaluator used responseSchema for a JSON Schema containing
-- additionalProperties from 18 September 2026. Gemini rejected those requests
-- with HTTP 400, leaving terminal bad_request jobs without evaluations.
-- Requeue that release's failed request/configuration jobs once, using saved
-- student speech. Normal recovery still treats new bad_request errors as
-- terminal; deploying this migration does not create an automatic retry loop.
-- Keep jobs failed until a corrected worker consumes the marker. This prevents
-- an older server from claiming them during a rolling deployment.
WITH recovered_jobs AS (
  UPDATE "SpeakingEvaluationJob" AS job
  SET "lastErrorCode" = 'gemini_json_schema_recovery_pending',
      "updatedAt" = CURRENT_TIMESTAMP
  WHERE job."status" = 'failed'
    AND job."lastErrorCode" = 'bad_request'
    AND job."queuedAt" >= TIMESTAMP '2026-09-18 14:29:00'
    AND NOT EXISTS (
      SELECT 1 FROM "SpeakingEvaluation" AS evaluation
      WHERE evaluation."participantId" = job."participantId"
    )
    AND EXISTS (
      SELECT 1 FROM "SpeakingTurn" AS turn
      WHERE turn."participantId" = job."participantId"
        AND turn."speaker" = 'student'
        AND length(btrim(turn."text")) > 0
    )
  RETURNING job."participantId"
)
UPDATE "SpeakingParticipant" AS participant
SET "status" = 'evaluating', "helpPending" = false
FROM recovered_jobs
WHERE participant."id" = recovered_jobs."participantId";
