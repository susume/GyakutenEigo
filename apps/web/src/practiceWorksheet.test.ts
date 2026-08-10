import test from "node:test";
import assert from "node:assert/strict";
import {
  createDefaultWorksheetLayoutOptions,
  layoutWorksheetQuestions,
  wrapWorksheetText
} from "./practiceWorksheet.js";
import type { Question } from "@quizstrike/shared";

const makeQuestion = (id: string, prompt: string): Question => ({
  id,
  quizSetId: "set-1",
  prompt,
  choiceA: "A short answer",
  choiceB: "B short answer",
  choiceC: "C short answer",
  choiceD: "D short answer",
  correctChoice: "A",
  createdAt: "2026-08-10T00:00:00.000Z"
});

test("worksheet wrapping keeps long Japanese and academic characters inside the column", () => {
  const lines = wrapWorksheetText(
    "鎌倉幕府を開いた人物は誰ですか。H₂O × 7 ÷ 2 0°C",
    130,
    (value) => Array.from(value).length * 10
  );
  assert.ok(lines.length > 2);
  assert.equal(
    lines.join("").replace(/\s+/gu, ""),
    "鎌倉幕府を開いた人物は誰ですか。H₂O × 7 ÷ 2 0°C".replace(/\s+/gu, "")
  );
  assert.ok(lines.every((line) => Array.from(line).length * 10 <= 130));
});

test("worksheet wrapping measures the first English unit and keeps long words inside the column", () => {
  const lines = wrapWorksheetText(
    "Photosynthesis converts light energy into chemical energy. Supercalifragilisticexpialidocious",
    120,
    (value) => Array.from(value).length * 10
  );

  assert.ok(lines.length > 2);
  assert.ok(lines.every((line) => Array.from(line).length * 10 <= 120));
  assert.equal(
    lines.join("").replace(/\s+/gu, ""),
    "Photosynthesis converts light energy into chemical energy. Supercalifragilisticexpialidocious".replace(/\s+/gu, "")
  );
});

test("worksheet layout never splits a question block and enforces the two-column page limit", () => {
  const options = createDefaultWorksheetLayoutOptions();
  const questions = Array.from({ length: 30 }, (_, index) => makeQuestion(`q-${index}`, `Question ${index + 1}`));
  const layout = layoutWorksheetQuestions(questions, options);

  assert.ok(layout.questions.length > 0);
  assert.ok(layout.questions.length <= questions.length);
  assert.ok(layout.omittedQuestions > 0);
  assert.ok(layout.questions.length >= 16, `expected a short worksheet to fit about 16 questions, got ${layout.questions.length}`);
  assert.ok(layout.questions.every((question) => question.y + question.height <= options.footerY));
  assert.equal(new Set(layout.questions.map((question) => question.question.id)).size, layout.questions.length);
  assert.ok(layout.questions.some((question) => question.column === 0));
  assert.ok(layout.questions.some((question) => question.column === 1));
});
