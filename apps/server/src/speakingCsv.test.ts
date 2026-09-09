import assert from "node:assert/strict";
import test from "node:test";
import { buildSpeakingCsv } from "./speakingCsv.js";

test("speaking CSV preserves Japanese, commas, quotes, newlines, and custom rubric columns", () => {
  const csv = buildSpeakingCsv([{
    setNames: "Grade 2, Unit 4",
    performanceTest: "Shopping for Clothes",
    session: "ABC123",
    date: "2026-09-09",
    student: "佐藤\nAki",
    status: "Completed",
    duration: "2:15",
    overallScore: 88,
    criteria: [{ id: "task", name: "Task achievement", score: 4 }, { id: "custom", name: "Teacher's \"focus\"", score: null }],
    helpCount: 1
  }]);
  assert.ok(csv.startsWith("\uFEFFSet,Performance Test"));
  assert.ok(csv.includes('"Grade 2, Unit 4"'));
  assert.ok(csv.includes('"佐藤\nAki"'));
  assert.ok(csv.includes('"Teacher\'s ""focus"""'));
  assert.ok(csv.endsWith("\r\n"));
});
