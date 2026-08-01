-- Establish normalized application authority alongside the legacy RuntimeSnapshot.
-- Production originally had only RuntimeSnapshot, so this migration must create
-- the full relational baseline before adding folders and durable reports.
CREATE TYPE "UserRole" AS ENUM ('teacher', 'admin');
CREATE TYPE "SessionStatus" AS ENUM ('waiting', 'active', 'paused', 'ended');
CREATE TYPE "Team" AS ENUM ('blue', 'red');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'teacher',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Class" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuizSet" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "classId" TEXT,
    "folderId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QuizSet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Folder" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "quizSetId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "choiceA" TEXT NOT NULL,
    "choiceB" TEXT NOT NULL,
    "choiceC" TEXT NOT NULL,
    "choiceD" TEXT NOT NULL,
    "correctChoice" TEXT NOT NULL,
    "explanation" TEXT,
    "difficulty" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "classId" TEXT,
    "quizSetId" TEXT NOT NULL,
    "sessionCode" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'waiting',
    "maxPlayers" INTEGER NOT NULL DEFAULT 20,
    "currentRound" INTEGER NOT NULL DEFAULT 1,
    "settingsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlayerSession" (
    "id" TEXT NOT NULL,
    "gameSessionId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "team" "Team" NOT NULL,
    "money" INTEGER NOT NULL DEFAULT 0,
    "isAlive" BOOLEAN NOT NULL DEFAULT true,
    "score" INTEGER NOT NULL DEFAULT 0,
    "correctAnswers" INTEGER NOT NULL DEFAULT 0,
    "wrongAnswers" INTEGER NOT NULL DEFAULT 0,
    "socketId" TEXT,
    "gear" TEXT NOT NULL DEFAULT 'starter_blaster',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    CONSTRAINT "PlayerSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnswerLog" (
    "id" TEXT NOT NULL,
    "gameSessionId" TEXT NOT NULL,
    "playerSessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedChoice" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "moneyAwarded" INTEGER NOT NULL,
    "responseTimeMs" INTEGER,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnswerLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoundLog" (
    "id" TEXT NOT NULL,
    "gameSessionId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "winningTeam" "Team",
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    CONSTRAINT "RoundLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sessionCode" TEXT NOT NULL,
    "quizSetId" TEXT,
    "quizSetName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "detailJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "QuizSet_teacherId_folderId_idx" ON "QuizSet"("teacherId", "folderId");
CREATE INDEX "Folder_teacherId_parentId_idx" ON "Folder"("teacherId", "parentId");
CREATE UNIQUE INDEX "Folder_teacherId_parentId_name_key" ON "Folder"("teacherId", "parentId", "name");
CREATE UNIQUE INDEX "GameSession_sessionCode_key" ON "GameSession"("sessionCode");
CREATE UNIQUE INDEX "PlayerSession_gameSessionId_nickname_key" ON "PlayerSession"("gameSessionId", "nickname");
CREATE INDEX "Report_teacherId_createdAt_idx" ON "Report"("teacherId", "createdAt");
CREATE UNIQUE INDEX "Report_teacherId_sessionId_key" ON "Report"("teacherId", "sessionId");

ALTER TABLE "Class" ADD CONSTRAINT "Class_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizSet" ADD CONSTRAINT "QuizSet_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizSet" ADD CONSTRAINT "QuizSet_classId_fkey"
  FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuizSet" ADD CONSTRAINT "QuizSet_folderId_fkey"
  FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Question" ADD CONSTRAINT "Question_quizSetId_fkey"
  FOREIGN KEY ("quizSetId") REFERENCES "QuizSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_classId_fkey"
  FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_quizSetId_fkey"
  FOREIGN KEY ("quizSetId") REFERENCES "QuizSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerSession" ADD CONSTRAINT "PlayerSession_gameSessionId_fkey"
  FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnswerLog" ADD CONSTRAINT "AnswerLog_gameSessionId_fkey"
  FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnswerLog" ADD CONSTRAINT "AnswerLog_playerSessionId_fkey"
  FOREIGN KEY ("playerSessionId") REFERENCES "PlayerSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnswerLog" ADD CONSTRAINT "AnswerLog_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoundLog" ADD CONSTRAINT "RoundLog_gameSessionId_fkey"
  FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_quizSetId_fkey"
  FOREIGN KEY ("quizSetId") REFERENCES "QuizSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
