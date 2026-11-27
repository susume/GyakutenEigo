-- Capture before and after applying the Phase 3 migration. Expect identical results.
SELECT md5(jsonb_build_object(
  'activity', (SELECT to_jsonb(row) FROM "SpeakingActivity" row WHERE id = 'phase3-qa-activity'),
  'session', (SELECT to_jsonb(row) - 'readingAssignmentJson' FROM "SpeakingSession" row WHERE id = 'phase3-qa-session'),
  'participants', (SELECT jsonb_agg(to_jsonb(row) ORDER BY id) FROM "SpeakingParticipant" row WHERE "sessionId" = 'phase3-qa-session'),
  'turns', (SELECT jsonb_agg(to_jsonb(row) ORDER BY id) FROM "SpeakingTurn" row WHERE "sessionId" = 'phase3-qa-session'),
  'evaluation', (SELECT to_jsonb(row) FROM "SpeakingEvaluation" row WHERE "participantId" = 'phase3-qa-graded'),
  'queued', (SELECT to_jsonb(row) FROM "SpeakingEvaluationJob" row WHERE id = 'phase3-qa-job')
)::text);
