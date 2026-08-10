import assert from "node:assert/strict";
import test from "node:test";
import { getNicknameError, validateStudentJoin } from "./studentJoinValidation";

test("student join validation normalizes valid classroom input", () => {
  assert.deepEqual(validateStudentJoin(" abc123 ", "  Player One  "), {
    code: "ABC123",
    nickname: "Player One",
    error: ""
  });
  assert.equal(validateStudentJoin("ABC123", "学習者").error, "");
});

test("student join validation blocks incomplete and unsafe input before the API call", () => {
  assert.equal(validateStudentJoin("ABC", "Player One").error, "Enter the 6-character game code.");
  assert.equal(validateStudentJoin("ABC123", "   ").error, "Enter a player name.");
  assert.equal(getNicknameError("Teacher Admin"), "Choose another player name.");
});
