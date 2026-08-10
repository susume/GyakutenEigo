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

test("a long high-priority question is retained with a clean full-width fallback", () => {
  const options = {
    ...createDefaultWorksheetLayoutOptions(),
    width: 500,
    height: 520,
    pageMargin: 20,
    headerBottom: 20,
    footerY: 480,
    columnGap: 20,
    questionLineHeight: 10,
    optionLineHeight: 10,
    blockGap: 4,
    measurePrompt: (value: string) => value.length * 4,
    measureOption: (value: string) => value.length
  };
  const longQuestion = makeQuestion("priority-mistake", "学".repeat(2300));
  const layout = layoutWorksheetQuestions(
    [longQuestion, makeQuestion("filler-1", "A short filler"), makeQuestion("filler-2", "Another short filler")],
    options
  );

  assert.equal(layout.questions[0]?.question.id, "priority-mistake");
  assert.equal(layout.questions[0]?.fullWidth, true);
  assert.ok(layout.questions[0]!.width > layout.columnWidth);
  assert.ok(layout.questions[0]!.x + layout.questions[0]!.width <= options.width - options.pageMargin);
  assert.ok(layout.questions.every((question) => question.y + question.height <= options.footerY));
});

test("lower-priority filler is not placed after a higher-priority block reaches the page boundary", () => {
  const options = {
    ...createDefaultWorksheetLayoutOptions(),
    width: 500,
    height: 260,
    pageMargin: 20,
    headerBottom: 20,
    footerY: 220,
    columnGap: 20,
    questionLineHeight: 10,
    optionLineHeight: 10,
    blockGap: 0,
    measurePrompt: (value: string) => value.length * 4,
    measureOption: (value: string) => value.length
  };
  const nearlyFull = (id: string) => makeQuestion(id, "x".repeat(650));
  const layout = layoutWorksheetQuestions([
    nearlyFull("higher-1"),
    nearlyFull("higher-2"),
    makeQuestion("missed-longer", "x".repeat(200)),
    makeQuestion("lower-filler", "short")
  ], options);

  assert.deepEqual(layout.questions.map((question) => question.question.id), ["higher-1", "higher-2"]);
  assert.equal(layout.omittedQuestions, 2);
});

test("worksheet blocks do not overlap, overflow, or require a second page", () => {
  const options = createDefaultWorksheetLayoutOptions();
  const questions = Array.from({ length: 40 }, (_, index) => makeQuestion(
    `q-${index}`,
    index === 0 ? "日本語の質問。".repeat(120) : `Question ${index + 1}`
  ));
  const layout = layoutWorksheetQuestions(questions, options);

  for (const question of layout.questions) {
    assert.ok(question.x >= options.pageMargin);
    assert.ok(question.x + question.width <= options.width - options.pageMargin);
    assert.ok(question.y >= options.headerBottom);
    assert.ok(question.y + question.height <= options.footerY);
  }
  for (let leftIndex = 0; leftIndex < layout.questions.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < layout.questions.length; rightIndex += 1) {
      const left = layout.questions[leftIndex]!;
      const right = layout.questions[rightIndex]!;
      const overlaps = left.x < right.x + right.width
        && right.x < left.x + left.width
        && left.y < right.y + right.height
        && right.y < left.y + left.height;
      assert.equal(overlaps, false, `${left.question.id} overlaps ${right.question.id}`);
    }
  }
});
