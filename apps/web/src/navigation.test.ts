import assert from "node:assert/strict";
import test from "node:test";
import { buildStudentJoinUrl, getJoinCodeFromSearch, modeForRoute, normalizeRoutePath } from "./navigation.js";

test("route helpers keep URL and screen mode aligned", () => {
  assert.equal(normalizeRoutePath("/quiz-strike/"), "/quiz-strike");
  assert.equal(normalizeRoutePath("/"), "/");
  assert.equal(modeForRoute("/"), "home");
  assert.equal(modeForRoute("/quiz-strike"), "quizStrike");
  assert.equal(modeForRoute("/join"), "student");
  assert.equal(modeForRoute("/game"), "student");
  assert.equal(modeForRoute("/character-lab"), "characterLab");
});

test("student join links carry the session code and prefill it safely", () => {
  assert.equal(getJoinCodeFromSearch("?code=abc123"), "ABC123");
  assert.equal(getJoinCodeFromSearch("?code=%20yvhcmq%20"), "YVHCMQ");
  assert.equal(buildStudentJoinUrl("https://class.example/", "abc123"), "https://class.example/join?code=ABC123");
});
