CREATE TYPE "TournamentStatus" AS ENUM ('DRAFT', 'REGISTRATION_OPEN', 'STUDY_PACK_RELEASED', 'CHECK_IN', 'LIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "TournamentLevel" AS ENUM ('SCHOOL_VS_SCHOOL', 'CLASS_VS_CLASS', 'IN_SCHOOL', 'INVITATIONAL', 'SPONSORED');
CREATE TYPE "TournamentTeamStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "TournamentMatchStatus" AS ENUM ('SCHEDULED', 'CHECK_IN', 'LIVE', 'COMPLETED', 'BYE', 'FORFEIT', 'CANCELLED');

CREATE TABLE "Tournament" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "sponsorName" TEXT,
  "sponsorMessage" TEXT,
  "sponsorUrl" TEXT,
  "level" "TournamentLevel" NOT NULL,
  "status" "TournamentStatus" NOT NULL DEFAULT 'DRAFT',
  "tournamentAt" TIMESTAMP(3) NOT NULL,
  "registrationDeadline" TIMESTAMP(3) NOT NULL,
  "timeZone" TEXT NOT NULL DEFAULT 'Asia/Tokyo',
  "maximumTeams" INTEGER NOT NULL,
  "quizSetId" TEXT,
  "quizSetName" TEXT NOT NULL,
  "rulesJson" JSONB NOT NULL,
  "invitationCodesJson" JSONB NOT NULL DEFAULT '[]',
  "championTeamId" TEXT,
  "runnerUpTeamId" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Tournament_slug_key" ON "Tournament"("slug");
CREATE INDEX "Tournament_ownerId_status_idx" ON "Tournament"("ownerId", "status");
CREATE INDEX "Tournament_status_tournamentAt_idx" ON "Tournament"("status", "tournamentAt");
CREATE INDEX "Tournament_registrationDeadline_idx" ON "Tournament"("registrationDeadline");

CREATE TABLE "TournamentStudyPack" (
  "id" TEXT NOT NULL,
  "tournamentId" TEXT NOT NULL,
  "releaseAt" TIMESTAMP(3) NOT NULL,
  "releasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TournamentStudyPack_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TournamentStudyPack_tournamentId_key" ON "TournamentStudyPack"("tournamentId");

CREATE TABLE "TournamentStudyItem" (
  "id" TEXT NOT NULL,
  "studyPackId" TEXT NOT NULL,
  "term" TEXT NOT NULL,
  "pronunciation" TEXT,
  "meaning" TEXT,
  "example" TEXT,
  "note" TEXT,
  "sortOrder" INTEGER NOT NULL,
  CONSTRAINT "TournamentStudyItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TournamentStudyItem_studyPackId_sortOrder_idx" ON "TournamentStudyItem"("studyPackId", "sortOrder");

CREATE TABLE "TournamentTeam" (
  "id" TEXT NOT NULL,
  "tournamentId" TEXT NOT NULL,
  "teamName" TEXT NOT NULL,
  "schoolName" TEXT NOT NULL,
  "className" TEXT,
  "managerUserId" TEXT NOT NULL,
  "managerName" TEXT NOT NULL,
  "schoolLocation" TEXT,
  "rosterJson" JSONB NOT NULL,
  "substitutesJson" JSONB NOT NULL,
  "color" TEXT NOT NULL DEFAULT 'blue',
  "registrationStatus" "TournamentTeamStatus" NOT NULL DEFAULT 'PENDING',
  "checkedIn" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TournamentTeam_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TournamentTeam_tournamentId_registrationStatus_idx" ON "TournamentTeam"("tournamentId", "registrationStatus");
CREATE INDEX "TournamentTeam_managerUserId_idx" ON "TournamentTeam"("managerUserId");

CREATE TABLE "TournamentMatch" (
  "id" TEXT NOT NULL,
  "tournamentId" TEXT NOT NULL,
  "roundNumber" INTEGER NOT NULL,
  "roundLabel" TEXT NOT NULL,
  "bracketPosition" INTEGER NOT NULL,
  "teamAId" TEXT,
  "teamBId" TEXT,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "status" "TournamentMatchStatus" NOT NULL DEFAULT 'SCHEDULED',
  "checkedInTeamIdsJson" JSONB NOT NULL DEFAULT '[]',
  "gameSessionId" TEXT,
  "sessionCode" TEXT,
  "settingsSnapshotJson" JSONB,
  "settingsLockedAt" TIMESTAMP(3),
  "resultJson" JSONB,
  "winnerTeamId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TournamentMatch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TournamentMatch_gameSessionId_key" ON "TournamentMatch"("gameSessionId");
CREATE INDEX "TournamentMatch_tournamentId_roundNumber_bracketPosition_idx" ON "TournamentMatch"("tournamentId", "roundNumber", "bracketPosition");
CREATE INDEX "TournamentMatch_tournamentId_scheduledAt_idx" ON "TournamentMatch"("tournamentId", "scheduledAt");
CREATE INDEX "TournamentMatch_sessionCode_idx" ON "TournamentMatch"("sessionCode");

CREATE TABLE "TournamentAuditEvent" (
  "id" TEXT NOT NULL,
  "tournamentId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "actorName" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TournamentAuditEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TournamentAuditEvent_tournamentId_createdAt_idx" ON "TournamentAuditEvent"("tournamentId", "createdAt");

ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_quizSetId_fkey" FOREIGN KEY ("quizSetId") REFERENCES "QuizSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TournamentStudyPack" ADD CONSTRAINT "TournamentStudyPack_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TournamentStudyItem" ADD CONSTRAINT "TournamentStudyItem_studyPackId_fkey" FOREIGN KEY ("studyPackId") REFERENCES "TournamentStudyPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TournamentTeam" ADD CONSTRAINT "TournamentTeam_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TournamentMatch" ADD CONSTRAINT "TournamentMatch_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TournamentMatch" ADD CONSTRAINT "TournamentMatch_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TournamentAuditEvent" ADD CONSTRAINT "TournamentAuditEvent_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
