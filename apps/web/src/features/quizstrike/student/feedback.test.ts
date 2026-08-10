import test from "node:test";
import assert from "node:assert/strict";
import {
  ANSWER_FEEDBACK_DURATION_MS,
  CORRECT_ANSWER_FEEDBACK_DURATION_MS,
  getAnswerFeedbackDurationMs
} from "./feedback.js";

test("short answer feedback keeps the fast transition", () => {
  assert.equal(
    getAnswerFeedbackDurationMs({ selectedText: "This one", correctText: "This one" }),
    ANSWER_FEEDBACK_DURATION_MS
  );
});

test("correct answers use a brief confirmation even when the reward has explanatory text", () => {
  assert.equal(
    getAnswerFeedbackDurationMs({
      isCorrect: true,
      selectedText: "The student's selected answer",
      correctText: "The correct answer",
      explanation: "This explanation is useful, but correct answers should not be held for the reading delay."
    }),
    CORRECT_ANSWER_FEEDBACK_DURATION_MS
  );
  assert.ok(CORRECT_ANSWER_FEEDBACK_DURATION_MS >= 250);
  assert.ok(CORRECT_ANSWER_FEEDBACK_DURATION_MS <= 500);
  assert.notEqual(CORRECT_ANSWER_FEEDBACK_DURATION_MS, ANSWER_FEEDBACK_DURATION_MS);
});

test("explanations and long Japanese answers receive readable feedback time", () => {
  assert.ok(
    getAnswerFeedbackDurationMs({
      selectedText: "これはとても長い選択肢です。".repeat(8),
      correctText: "こちらが正しい選択肢です。".repeat(8),
      explanation: "この説明は答えに至る理由を示します。"
    }) > ANSWER_FEEDBACK_DURATION_MS
  );
  assert.ok(
    getAnswerFeedbackDurationMs({
      selectedText: "x".repeat(180),
      correctText: "y"
    }) >= 3400
  );
  assert.equal(
    getAnswerFeedbackDurationMs({
      isCorrect: false,
      selectedText: "A short answer",
      correctText: "The correct answer",
      explanation: "長い日本語の説明です。".repeat(30)
    }),
    4200
  );
});
