-- QuizSet is the existing reusable question collection. Extend it into the
-- Study Set model so existing teacher content remains available and private.
CREATE TYPE "QuizSetVisibility" AS ENUM ('PRIVATE', 'PUBLIC');
CREATE TYPE "QuizSetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "ContributionEventType" AS ENUM (
    'STUDY_SET_CREATED',
    'STUDY_SET_PUBLISHED',
    'STUDY_SET_USED',
    'STUDY_SET_DUPLICATED',
    'CREATOR_REUSE_CREDITED',
    'GAME_COMPLETED',
    'BADGE_EARNED'
);

ALTER TABLE "QuizSet"
    ADD COLUMN "visibility" "QuizSetVisibility" NOT NULL DEFAULT 'PRIVATE',
    ADD COLUMN "subject" TEXT,
    ADD COLUMN "topic" TEXT,
    ADD COLUMN "gradeLevel" TEXT,
    ADD COLUMN "language" TEXT,
    ADD COLUMN "tagsJson" JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN "publishedAt" TIMESTAMP(3),
    ADD COLUMN "status" "QuizSetStatus" NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN "usageCount" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "uniqueTeacherUsageCount" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "remixCount" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "originalSetId" TEXT,
    ADD COLUMN "originalCreatorId" TEXT;

ALTER TABLE "GameSession"
    ADD COLUMN "questionSnapshotJson" JSONB;

CREATE TABLE "StudySetUsage" (
    "id" TEXT NOT NULL,
    "quizSetId" TEXT NOT NULL,
    "consumerTeacherId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudySetUsage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContributionEvent" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ContributionEventType" NOT NULL,
    "points" INTEGER NOT NULL,
    "studySetId" TEXT,
    "sessionId" TEXT,
    "metadataJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContributionEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContributionBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContributionBadge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContributionEvent_eventKey_key" ON "ContributionEvent"("eventKey");
CREATE UNIQUE INDEX "StudySetUsage_sessionId_key" ON "StudySetUsage"("sessionId");
CREATE UNIQUE INDEX "StudySetUsage_quizSetId_consumerTeacherId_sessionId_key" ON "StudySetUsage"("quizSetId", "consumerTeacherId", "sessionId");
CREATE UNIQUE INDEX "ContributionBadge_userId_badgeId_key" ON "ContributionBadge"("userId", "badgeId");
CREATE INDEX "QuizSet_visibility_status_createdAt_idx" ON "QuizSet"("visibility", "status", "createdAt");
CREATE INDEX "QuizSet_visibility_subject_gradeLevel_language_idx" ON "QuizSet"("visibility", "subject", "gradeLevel", "language");
CREATE INDEX "QuizSet_usageCount_uniqueTeacherUsageCount_idx" ON "QuizSet"("usageCount", "uniqueTeacherUsageCount");
CREATE INDEX "QuizSet_originalSetId_idx" ON "QuizSet"("originalSetId");
CREATE INDEX "StudySetUsage_quizSetId_createdAt_idx" ON "StudySetUsage"("quizSetId", "createdAt");
CREATE INDEX "StudySetUsage_consumerTeacherId_createdAt_idx" ON "StudySetUsage"("consumerTeacherId", "createdAt");
CREATE INDEX "ContributionEvent_userId_createdAt_idx" ON "ContributionEvent"("userId", "createdAt");
CREATE INDEX "ContributionEvent_studySetId_type_idx" ON "ContributionEvent"("studySetId", "type");
CREATE INDEX "ContributionEvent_sessionId_type_idx" ON "ContributionEvent"("sessionId", "type");
CREATE INDEX "ContributionBadge_userId_earnedAt_idx" ON "ContributionBadge"("userId", "earnedAt");

-- Public discovery uses case-insensitive contains searches. Trigram indexes
-- keep those queries indexable as the library grows beyond classroom scale.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "QuizSet_public_title_trgm_idx" ON "QuizSet" USING GIN ("title" gin_trgm_ops)
    WHERE "visibility" = 'PUBLIC' AND "status" = 'ACTIVE';
CREATE INDEX "QuizSet_public_description_trgm_idx" ON "QuizSet" USING GIN ("description" gin_trgm_ops)
    WHERE "visibility" = 'PUBLIC' AND "status" = 'ACTIVE';
CREATE INDEX "QuizSet_public_subject_trgm_idx" ON "QuizSet" USING GIN ("subject" gin_trgm_ops)
    WHERE "visibility" = 'PUBLIC' AND "status" = 'ACTIVE';
CREATE INDEX "QuizSet_public_topic_trgm_idx" ON "QuizSet" USING GIN ("topic" gin_trgm_ops)
    WHERE "visibility" = 'PUBLIC' AND "status" = 'ACTIVE';
CREATE INDEX "User_name_trgm_idx" ON "User" USING GIN ("name" gin_trgm_ops);

ALTER TABLE "QuizSet" ADD CONSTRAINT "QuizSet_originalSetId_fkey"
    FOREIGN KEY ("originalSetId") REFERENCES "QuizSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuizSet" ADD CONSTRAINT "QuizSet_originalCreatorId_fkey"
    FOREIGN KEY ("originalCreatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudySetUsage" ADD CONSTRAINT "StudySetUsage_quizSetId_fkey"
    FOREIGN KEY ("quizSetId") REFERENCES "QuizSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudySetUsage" ADD CONSTRAINT "StudySetUsage_consumerTeacherId_fkey"
    FOREIGN KEY ("consumerTeacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContributionEvent" ADD CONSTRAINT "ContributionEvent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContributionBadge" ADD CONSTRAINT "ContributionBadge_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
