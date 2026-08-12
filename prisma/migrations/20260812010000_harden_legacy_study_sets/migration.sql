-- Backward-compatible Study Set repair.
-- Existing QuizSet rows are always private unless a teacher explicitly
-- published them after the public Study Set feature was installed.
UPDATE "QuizSet"
SET "visibility" = 'PRIVATE'
WHERE "visibility" IS NULL;

UPDATE "QuizSet"
SET "status" = 'ACTIVE'
WHERE "status" IS NULL;

ALTER TABLE "QuizSet"
    ALTER COLUMN "visibility" SET DEFAULT 'PRIVATE',
    ALTER COLUMN "visibility" SET NOT NULL,
    ALTER COLUMN "status" SET DEFAULT 'ACTIVE',
    ALTER COLUMN "status" SET NOT NULL;

-- Preserve the legacy order (createdAt, then id) while giving the modern
-- editor a stable, explicit order that can be changed without replacing IDs.
ALTER TABLE "Question"
    ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

WITH ranked_questions AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "quizSetId"
            ORDER BY "createdAt" ASC, "id" ASC
        ) - 1 AS "legacyPosition"
    FROM "Question"
)
UPDATE "Question" AS question
SET "position" = ranked_questions."legacyPosition"
FROM ranked_questions
WHERE question."id" = ranked_questions."id";

CREATE INDEX "Question_quizSetId_position_createdAt_idx"
    ON "Question"("quizSetId", "position", "createdAt");
