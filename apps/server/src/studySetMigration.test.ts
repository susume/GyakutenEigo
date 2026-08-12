import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("legacy Study Set migration backfills private visibility and stable question order", async () => {
  const migrationUrl = new URL("../../../prisma/migrations/20260812010000_harden_legacy_study_sets/migration.sql", import.meta.url);
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /SET "visibility" = 'PRIVATE'[\s\S]*WHERE "visibility" IS NULL/);
  assert.match(sql, /ALTER COLUMN "visibility" SET DEFAULT 'PRIVATE'/);
  assert.match(sql, /PARTITION BY "quizSetId"[\s\S]*ORDER BY "createdAt" ASC, "id" ASC/);
  assert.doesNotMatch(sql, /SET "visibility" = 'PUBLIC'\s+WHERE/);
  assert.doesNotMatch(sql, /DELETE\s+FROM\s+"QuizSet"/i);
});
