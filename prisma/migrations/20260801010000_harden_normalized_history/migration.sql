-- Preserve historical session and answer context when authoring data changes.
ALTER TABLE "QuizSet" ADD COLUMN IF NOT EXISTS "settingsJson" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "GameSession" ADD COLUMN IF NOT EXISTS "quizSetName" TEXT NOT NULL DEFAULT 'Quiz Set';
ALTER TABLE "AnswerLog" ADD COLUMN IF NOT EXISTS "questionPrompt" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AnswerLog" ADD COLUMN IF NOT EXISTS "correctChoice" TEXT NOT NULL DEFAULT 'A';
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "GameSession" AS session
SET "quizSetName" = quiz."title"
FROM "QuizSet" AS quiz
WHERE session."quizSetId" = quiz."id"
  AND session."quizSetName" = 'Quiz Set';

UPDATE "AnswerLog" AS answer
SET "questionPrompt" = question."prompt",
    "correctChoice" = question."correctChoice"
FROM "Question" AS question
WHERE answer."questionId" = question."id"
  AND answer."questionPrompt" = '';

ALTER TABLE "GameSession" DROP CONSTRAINT IF EXISTS "GameSession_quizSetId_fkey";
ALTER TABLE "GameSession" ALTER COLUMN "quizSetId" DROP NOT NULL;
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_quizSetId_fkey"
  FOREIGN KEY ("quizSetId") REFERENCES "QuizSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AnswerLog" DROP CONSTRAINT IF EXISTS "AnswerLog_questionId_fkey";
ALTER TABLE "AnswerLog" ALTER COLUMN "questionId" DROP NOT NULL;
ALTER TABLE "AnswerLog" ADD CONSTRAINT "AnswerLog_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Folder" DROP CONSTRAINT IF EXISTS "Folder_parentId_fkey";
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Folder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Folder" DROP CONSTRAINT IF EXISTS "Folder_not_self_parent";
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_not_self_parent" CHECK ("parentId" IS NULL OR "parentId" <> "id");

-- PostgreSQL UNIQUE treats NULL parent IDs as distinct. This expression index
-- enforces unique root-level sibling names as well as nested sibling names.
DROP INDEX IF EXISTS "Folder_teacherId_parentId_name_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Folder_teacher_parent_name_unique"
  ON "Folder" ("teacherId", COALESCE("parentId", ''), lower("name"));

CREATE INDEX IF NOT EXISTS "GameSession_teacherId_status_idx" ON "GameSession"("teacherId", "status");
DROP INDEX IF EXISTS "Report_teacherId_createdAt_idx";
CREATE INDEX IF NOT EXISTS "Report_teacherId_createdAt_id_idx" ON "Report"("teacherId", "createdAt", "id");

-- Cross-teacher parents and recursive cycles cannot be expressed by a simple
-- foreign key, so enforce them transactionally at the database boundary too.
CREATE OR REPLACE FUNCTION quizstrike_validate_folder_parent() RETURNS trigger AS $$
DECLARE
  parent_teacher TEXT;
  cycle_found BOOLEAN;
BEGIN
  IF NEW."parentId" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT "teacherId" INTO parent_teacher FROM "Folder" WHERE "id" = NEW."parentId";
  IF parent_teacher IS NULL OR parent_teacher <> NEW."teacherId" THEN
    RAISE EXCEPTION 'folder parent must belong to the same teacher';
  END IF;

  WITH RECURSIVE ancestors("id", "parentId") AS (
    SELECT "id", "parentId" FROM "Folder" WHERE "id" = NEW."parentId"
    UNION ALL
    SELECT folder."id", folder."parentId"
    FROM "Folder" AS folder
    JOIN ancestors ON folder."id" = ancestors."parentId"
  )
  SELECT EXISTS(SELECT 1 FROM ancestors WHERE "id" = NEW."id") INTO cycle_found;

  IF cycle_found THEN
    RAISE EXCEPTION 'folder hierarchy cycle detected';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "Folder_validate_parent" ON "Folder";
CREATE TRIGGER "Folder_validate_parent"
  BEFORE INSERT OR UPDATE OF "parentId", "teacherId" ON "Folder"
  FOR EACH ROW EXECUTE FUNCTION quizstrike_validate_folder_parent();
