-- Seed only a disposable database with the 24 pre-Read Aloud migrations.
INSERT INTO "User" ("id", "name", "email", "passwordHash", "updatedAt")
  VALUES ('phase3-qa-teacher', 'Synthetic teacher', 'phase3-migration@example.test', 'synthetic', now());
INSERT INTO "SpeakingActivity" ("id", "teacherId", "title", "scenario", "aiRole", "studentRole", "level", "durationSeconds", "updatedAt")
  VALUES ('phase3-qa-activity', 'phase3-qa-teacher', 'Original exercise', 'Talk about a library', 'Classmate', 'Student', 'beginner', 180, now());
INSERT INTO "SpeakingSession" ("id", "activityId", "joinCode", "status", "expiresAt", "activitySnapshotJson")
  VALUES ('phase3-qa-session', 'phase3-qa-activity', 'QA3XYZ', 'ended', now(), '{"title":"Original exercise"}');
INSERT INTO "SpeakingParticipant" ("id", "activityId", "sessionId", "anonymousTokenHash", "status", "finishedAt")
  VALUES ('phase3-qa-graded', 'phase3-qa-activity', 'phase3-qa-session', 'phase3-qa-token-1', 'completed', now()),
         ('phase3-qa-queued', 'phase3-qa-activity', 'phase3-qa-session', 'phase3-qa-token-2', 'evaluating', now());
INSERT INTO "SpeakingTurn" ("id", "participantId", "sessionId", "speaker", "text")
  VALUES ('phase3-qa-turn1', 'phase3-qa-graded', 'phase3-qa-session', 'student', 'I made a map.'),
         ('phase3-qa-turn2', 'phase3-qa-queued', 'phase3-qa-session', 'student', 'I went to the library.');
INSERT INTO "SpeakingEvaluation" ("participantId", "language", "scoresJson", "evidenceJson", "strengthsJson", "improvementsJson", "usefulEnglishJson", "overallMessage")
  VALUES ('phase3-qa-graded', 'en', '{"communication":3}', '{"communication":"A clear response"}', '[]', '[]', '[]', 'Saved result');
INSERT INTO "SpeakingEvaluationJob" ("id", "participantId", "status", "updatedAt")
  VALUES ('phase3-qa-job', 'phase3-qa-queued', 'queued', now());
