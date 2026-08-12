import assert from "node:assert/strict";
import test from "node:test";
import type { QuizSet } from "@quizstrike/shared";
import { normalizeLegacyStudySet } from "./studySetCompatibility.js";

const legacySet = (id: string, createdAt: string): QuizSet => ({
  id,
  teacherId: "teacher-a",
  title: `Legacy ${id}`,
  questions: [
    { id: `${id}-later`, quizSetId: id, prompt: "Later", choiceA: "A", choiceB: "B", choiceC: "C", choiceD: "D", correctChoice: "A", createdAt: "2026-01-02T00:00:00.000Z" },
    { id: `${id}-first`, quizSetId: id, prompt: "First", choiceA: "A", choiceB: "B", choiceC: "C", choiceD: "D", correctChoice: "A", createdAt: "2026-01-01T00:00:00.000Z" }
  ],
  createdAt
});

test("legacy teacher Study Sets are restored as private without replacing IDs", () => {
  const restored = [legacySet("set-1", "2025-01-01T00:00:00.000Z"), legacySet("set-2", "2025-01-02T00:00:00.000Z")]
    .map(normalizeLegacyStudySet);

  assert.deepEqual(restored.map((set) => ({ id: set.id, teacherId: set.teacherId, visibility: set.visibility, status: set.status })), [
    { id: "set-1", teacherId: "teacher-a", visibility: "PRIVATE", status: "ACTIVE" },
    { id: "set-2", teacherId: "teacher-a", visibility: "PRIVATE", status: "ACTIVE" }
  ]);
  assert.deepEqual(restored[0].questions.map((question) => question.id), ["set-1-later", "set-1-first"]);
  assert.deepEqual(restored[0].questions.map((question) => question.position), [0, 1]);
});

test("explicit public visibility survives compatibility normalization", () => {
  const restored = normalizeLegacyStudySet({ ...legacySet("public-set", "2025-01-01T00:00:00.000Z"), visibility: "PUBLIC" });
  assert.equal(restored.visibility, "PUBLIC");
});
