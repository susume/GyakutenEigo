import test from "node:test";
import assert from "node:assert/strict";
import { PlayerQuestionGate, isValidPlayerToken } from "./index.js";

test("isValidPlayerToken rejects missing or mismatched student tokens", () => {
  assert.equal(isValidPlayerToken("secret-token", "secret-token"), true);
  assert.equal(isValidPlayerToken("secret-token", "wrong-token"), false);
  assert.equal(isValidPlayerToken("secret-token", ""), false);
  assert.equal(isValidPlayerToken("", "secret-token"), false);
});

test("PlayerQuestionGate accepts only the currently issued question and consumes it once", () => {
  const gate = new PlayerQuestionGate();
  gate.issue("player-1", "question-1", 1000);

  const wrongQuestion = gate.consume("player-1", "question-2", 2000);
  assert.deepEqual(wrongQuestion, { ok: false, reason: "question_not_active" });

  const accepted = gate.consume("player-1", "question-1", 3500);
  assert.deepEqual(accepted, { ok: true, responseTimeMs: 2500 });

  const replay = gate.consume("player-1", "question-1", 4000);
  assert.deepEqual(replay, { ok: false, reason: "question_not_active" });
});

test("PlayerQuestionGate clamps negative response time when clocks move backward", () => {
  const gate = new PlayerQuestionGate();
  gate.issue("player-1", "question-1", 5000);

  assert.deepEqual(gate.consume("player-1", "question-1", 4500), {
    ok: true,
    responseTimeMs: 0
  });
});
