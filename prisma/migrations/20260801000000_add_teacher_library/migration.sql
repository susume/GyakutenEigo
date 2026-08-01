CREATE TABLE "Folder" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "QuizSet" ADD COLUMN "folderId" TEXT;

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

CREATE INDEX "QuizSet_teacherId_folderId_idx" ON "QuizSet"("teacherId", "folderId");
CREATE INDEX "Folder_teacherId_parentId_idx" ON "Folder"("teacherId", "parentId");
CREATE UNIQUE INDEX "Folder_teacherId_parentId_name_key" ON "Folder"("teacherId", "parentId", "name");
CREATE INDEX "Report_teacherId_createdAt_idx" ON "Report"("teacherId", "createdAt");
CREATE UNIQUE INDEX "Report_teacherId_sessionId_key" ON "Report"("teacherId", "sessionId");

ALTER TABLE "Folder" ADD CONSTRAINT "Folder_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizSet" ADD CONSTRAINT "QuizSet_folderId_fkey"
  FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_quizSetId_fkey"
  FOREIGN KEY ("quizSetId") REFERENCES "QuizSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
