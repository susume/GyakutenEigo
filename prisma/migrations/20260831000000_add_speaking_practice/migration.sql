CREATE TYPE "SpeakingActivityStatus" AS ENUM ('draft', 'ready', 'active', 'ended');
CREATE TYPE "SpeakingDifficulty" AS ENUM ('easy', 'normal', 'challenge');
CREATE TYPE "SpeakingNativeLanguage" AS ENUM ('ja', 'en');
CREATE TYPE "SpeakingIdentifierMode" AS ENUM ('anonymous', 'nickname', 'student_number');
CREATE TYPE "SpeakingParticipantStatus" AS ENUM ('joined', 'in_progress', 'evaluating', 'completed', 'error');
CREATE TYPE "SpeakingSessionStatus" AS ENUM ('ready', 'active', 'completed', 'expired');
CREATE TYPE "SpeakingTurnSpeaker" AS ENUM ('ai', 'student');

CREATE TABLE "SpeakingActivity" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "aiRole" TEXT NOT NULL,
    "studentRole" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "difficulty" "SpeakingDifficulty" NOT NULL DEFAULT 'normal',
    "nativeLanguage" "SpeakingNativeLanguage" NOT NULL DEFAULT 'ja',
    "durationSeconds" INTEGER NOT NULL,
    "joinCode" TEXT NOT NULL,
    "status" "SpeakingActivityStatus" NOT NULL DEFAULT 'draft',
    "identifierMode" "SpeakingIdentifierMode" NOT NULL DEFAULT 'nickname',
    "targetExpressionsJson" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SpeakingActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SpeakingRubric" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SpeakingRubric_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SpeakingSession" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "status" "SpeakingSessionStatus" NOT NULL DEFAULT 'ready',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    CONSTRAINT "SpeakingSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SpeakingParticipant" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "displayIdentifier" TEXT,
    "anonymousTokenHash" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "SpeakingParticipantStatus" NOT NULL DEFAULT 'joined',
    "helpCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SpeakingParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SpeakingTurn" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "speaker" "SpeakingTurnSpeaker" NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "audioDurationMs" INTEGER,
    "responseTimeMs" INTEGER,
    "usedHelp" BOOLEAN NOT NULL DEFAULT false,
    "transcriptionConfidence" DOUBLE PRECISION,
    CONSTRAINT "SpeakingTurn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SpeakingEvaluation" (
    "participantId" TEXT NOT NULL,
    "language" "SpeakingNativeLanguage" NOT NULL,
    "scoresJson" JSONB NOT NULL,
    "evidenceJson" JSONB NOT NULL,
    "strengthsJson" JSONB NOT NULL,
    "improvementsJson" JSONB NOT NULL,
    "usefulEnglishJson" JSONB NOT NULL,
    "overallMessage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SpeakingEvaluation_pkey" PRIMARY KEY ("participantId")
);

CREATE UNIQUE INDEX "SpeakingActivity_joinCode_key" ON "SpeakingActivity"("joinCode");
CREATE INDEX "SpeakingActivity_teacherId_status_idx" ON "SpeakingActivity"("teacherId", "status");
CREATE INDEX "SpeakingRubric_activityId_position_idx" ON "SpeakingRubric"("activityId", "position");
CREATE INDEX "SpeakingSession_activityId_status_idx" ON "SpeakingSession"("activityId", "status");
CREATE UNIQUE INDEX "SpeakingParticipant_sessionId_key" ON "SpeakingParticipant"("sessionId");
CREATE UNIQUE INDEX "SpeakingParticipant_anonymousTokenHash_key" ON "SpeakingParticipant"("anonymousTokenHash");
CREATE INDEX "SpeakingParticipant_activityId_status_idx" ON "SpeakingParticipant"("activityId", "status");
CREATE INDEX "SpeakingTurn_participantId_createdAt_idx" ON "SpeakingTurn"("participantId", "createdAt");
CREATE INDEX "SpeakingTurn_sessionId_createdAt_idx" ON "SpeakingTurn"("sessionId", "createdAt");

ALTER TABLE "SpeakingActivity" ADD CONSTRAINT "SpeakingActivity_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpeakingRubric" ADD CONSTRAINT "SpeakingRubric_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "SpeakingActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpeakingSession" ADD CONSTRAINT "SpeakingSession_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "SpeakingActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpeakingParticipant" ADD CONSTRAINT "SpeakingParticipant_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "SpeakingActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpeakingParticipant" ADD CONSTRAINT "SpeakingParticipant_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "SpeakingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpeakingTurn" ADD CONSTRAINT "SpeakingTurn_participantId_fkey"
  FOREIGN KEY ("participantId") REFERENCES "SpeakingParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpeakingTurn" ADD CONSTRAINT "SpeakingTurn_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "SpeakingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpeakingEvaluation" ADD CONSTRAINT "SpeakingEvaluation_participantId_fkey"
  FOREIGN KEY ("participantId") REFERENCES "SpeakingParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
