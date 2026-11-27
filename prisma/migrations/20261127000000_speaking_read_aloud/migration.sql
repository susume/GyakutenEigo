ALTER TABLE "SpeakingSession" ADD COLUMN "readingAssignmentJson" JSONB;

CREATE TABLE "SpeakingPassageVersion" (
  "id" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "passageKey" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "passageJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SpeakingPassageVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SpeakingPassageVersion_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SpeakingPassageVersion_teacherId_passageKey_version_key"
  ON "SpeakingPassageVersion" ("teacherId", "passageKey", "version");

CREATE TABLE "SpeakingReadingReview" (
  "participantId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "reviewJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SpeakingReadingReview_pkey" PRIMARY KEY ("participantId", "revision"),
  CONSTRAINT "SpeakingReadingReview_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "SpeakingParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- These records are accessed through the authenticated application API.
ALTER TABLE "SpeakingPassageVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SpeakingReadingReview" ENABLE ROW LEVEL SECURITY;
