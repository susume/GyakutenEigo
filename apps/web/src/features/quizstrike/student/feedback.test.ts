import test from "node:test";
import assert from "node:assert/strict";
import { ANSWER_FEEDBACK_DURATION_MS, getAnswerFeedbackDurationMs } from "./feedback.js";

test("short answer feedback keeps the fast transition", () => {
  assert.equal(
    getAnswerFeedbackDurationMs({ selectedText: "This one", correctText: "This one" }),
    ANSWER_FEEDBACK_DURATION_MS
  );
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
    }) > ANSWER_FEEDBACK_DURATION_MS
  );
});
