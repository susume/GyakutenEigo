CREATE TYPE "CompetitionType" AS ENUM ('SPONSORED', 'SCHOOL_VS_SCHOOL', 'CLAN_VS_CLASS');
CREATE TYPE "CompetitionStatus" AS ENUM ('DRAFT', 'ANNOUNCED', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'STUDY_PERIOD', 'CHECK_IN', 'LIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "CompetitionVisibility" AS ENUM ('PUBLIC', 'INVITATION_ONLY');
CREATE TYPE "CompetitionStreamingStatus" AS ENUM ('OFF', 'APPROVAL_REQUIRED', 'APPROVED');
CREATE TYPE "CompetitionRegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "CompetitionEligibilityStatus" AS ENUM ('PENDING', 'ELIGIBLE', 'INELIGIBLE');
CREATE TYPE "CompetitionCheckInStatus" AS ENUM ('NOT_OPEN', 'OPEN', 'CHECKED_IN', 'MISSED');
CREATE TYPE "CompetitionMatchStatus" AS ENUM ('SCHEDULED', 'CHECK_IN', 'LIVE', 'CONFIRMED', 'DISPUTED');

CREATE TABLE "Competition" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "coverImage" TEXT NOT NULL,
  "sponsorName" TEXT,
  "sponsorArtwork" TEXT,
  "type" "CompetitionType" NOT NULL,
  "organizerId" TEXT NOT NULL,
  "organizerName" TEXT NOT NULL,
  "status" "CompetitionStatus" NOT NULL DEFAULT 'DRAFT',
  "registrationOpensAt" TIMESTAMP(3) NOT NULL,
  "registrationClosesAt" TIMESTAMP(3) NOT NULL,
  "rosterDeadline" TIMESTAMP(3) NOT NULL,
  "studyPackReleaseAt" TIMESTAMP(3) NOT NULL,
  "matchStartAt" TIMESTAMP(3) NOT NULL,
  "matchEndAt" TIMESTAMP(3) NOT NULL,
  "region" TEXT NOT NULL,
  "timeZone" TEXT NOT NULL,
  "division" TEXT NOT NULL,
  "difficulty" TEXT NOT NULL,
  "activeTeamSize" INTEGER NOT NULL,
  "substituteLimit" INTEGER NOT NULL,
  "maximumTeams" INTEGER NOT NULL,
  "matchFormat" TEXT NOT NULL,
  "mapPoolJson" JSONB NOT NULL,
  "gameMode" TEXT NOT NULL,
  "rulesVersion" TEXT NOT NULL,
  "prizeDescription" TEXT NOT NULL,
  "visibility" "CompetitionVisibility" NOT NULL DEFAULT 'PUBLIC',
  "registrationRequirements" JSONB NOT NULL,
  "streamingStatus" "CompetitionStreamingStatus" NOT NULL DEFAULT 'OFF',
  "rulesSummary" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Competition_slug_key" ON "Competition"("slug");
CREATE INDEX "Competition_status_registrationOpensAt_idx" ON "Competition"("status", "registrationOpensAt");
CREATE INDEX "Competition_type_division_region_idx" ON "Competition"("type", "division", "region");

CREATE TABLE "CompetitionStudyPack" (
  "id" TEXT NOT NULL,
  "competitionId" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "releaseAt" TIMESTAMP(3) NOT NULL,
  "releasedAt" TIMESTAMP(3),
  "correctionVersion" INTEGER NOT NULL DEFAULT 0,
  "wordsJson" JSONB NOT NULL,
  "correctionHistoryJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompetitionStudyPack_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CompetitionStudyPack_competitionId_key" ON "CompetitionStudyPack"("competitionId");

CREATE TABLE "CompetitionAnnouncement" (
  "id" TEXT NOT NULL,
  "competitionId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL,
  "publishedByName" TEXT NOT NULL,
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "CompetitionAnnouncement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CompetitionAnnouncement_competitionId_publishedAt_idx" ON "CompetitionAnnouncement"("competitionId", "publishedAt");

CREATE TABLE "CompetitionTeam" (
  "id" TEXT NOT NULL,
  "competitionId" TEXT NOT NULL,
  "teamName" TEXT NOT NULL,
  "affiliation" TEXT NOT NULL,
  "logoUrl" TEXT,
  "captainUserId" TEXT NOT NULL,
  "captainName" TEXT NOT NULL,
  "coachUserId" TEXT,
  "coachName" TEXT,
  "activePlayersJson" JSONB NOT NULL,
  "substitutePlayersJson" JSONB NOT NULL,
  "registrationStatus" "CompetitionRegistrationStatus" NOT NULL DEFAULT 'PENDING',
  "eligibilityStatus" "CompetitionEligibilityStatus" NOT NULL DEFAULT 'PENDING',
  "checkInStatus" "CompetitionCheckInStatus" NOT NULL DEFAULT 'NOT_OPEN',
  "seed" INTEGER,
  "division" TEXT NOT NULL,
  "invitationCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompetitionTeam_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CompetitionTeam_competitionId_registrationStatus_eligibilityStatus_idx" ON "CompetitionTeam"("competitionId", "registrationStatus", "eligibilityStatus");

CREATE TABLE "CompetitionMatch" (
  "id" TEXT NOT NULL,
  "competitionId" TEXT NOT NULL,
  "roundLabel" TEXT NOT NULL,
  "bracketPosition" INTEGER NOT NULL,
  "homeTeamId" TEXT,
  "awayTeamId" TEXT,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "checkInOpensAt" TIMESTAMP(3) NOT NULL,
  "map" TEXT NOT NULL,
  "gameMode" TEXT NOT NULL,
  "status" "CompetitionMatchStatus" NOT NULL DEFAULT 'SCHEDULED',
  "sessionCode" TEXT,
  "refereeName" TEXT,
  "resultJson" JSONB,
  CONSTRAINT "CompetitionMatch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CompetitionMatch_competitionId_scheduledAt_idx" ON "CompetitionMatch"("competitionId", "scheduledAt");

CREATE TABLE "CompetitionNotification" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "competitionId" TEXT NOT NULL,
  "recipientUserId" TEXT,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompetitionNotification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CompetitionNotification_key_key" ON "CompetitionNotification"("key");
CREATE INDEX "CompetitionNotification_recipientUserId_createdAt_idx" ON "CompetitionNotification"("recipientUserId", "createdAt");

CREATE TABLE "CompetitionAuditLog" (
  "id" TEXT NOT NULL,
  "competitionId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "actorName" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "detail" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompetitionAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CompetitionAuditLog_competitionId_createdAt_idx" ON "CompetitionAuditLog"("competitionId", "createdAt");

ALTER TABLE "CompetitionStudyPack" ADD CONSTRAINT "CompetitionStudyPack_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetitionAnnouncement" ADD CONSTRAINT "CompetitionAnnouncement_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetitionTeam" ADD CONSTRAINT "CompetitionTeam_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetitionMatch" ADD CONSTRAINT "CompetitionMatch_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetitionNotification" ADD CONSTRAINT "CompetitionNotification_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetitionAuditLog" ADD CONSTRAINT "CompetitionAuditLog_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
