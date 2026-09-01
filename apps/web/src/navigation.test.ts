import assert from "node:assert/strict";
import test from "node:test";
import { buildSpeakingJoinUrl, buildStudentJoinUrl, buildTeacherSpeakingPath, getJoinCodeFromSearch, isTeacherSpeakingRoute, modeForRoute, normalizeRoutePath } from "./navigation.js";

test("route helpers keep URL and screen mode aligned", () => {
  assert.equal(normalizeRoutePath("/quiz-strike/"), "/quiz-strike");
  assert.equal(normalizeRoutePath("/quiz-strike///"), "/quiz-strike");
  assert.equal(normalizeRoutePath("/"), "/");
  assert.equal(modeForRoute("/"), "home");
  assert.equal(modeForRoute("/quiz-strike"), "quizStrike");
  assert.equal(modeForRoute("/join"), "student");
  assert.equal(modeForRoute("/game"), "student");
  assert.equal(modeForRoute("/character-lab"), "characterLab");
  assert.equal(modeForRoute("/speak"), "speaking");
  assert.equal(modeForRoute("/speak/session/session-1"), "speaking");
  assert.equal(modeForRoute("/speak/teacher"), "teacher");
  assert.equal(modeForRoute("/quiz-strike/teacher/speaking"), "teacher");
  assert.equal(buildTeacherSpeakingPath("/speak/teacher/create"), "/quiz-strike/teacher/speaking/create");
  assert.equal(buildTeacherSpeakingPath("/quiz-strike/teacher/speaking"), "/quiz-strike/teacher/speaking");
  assert.equal(isTeacherSpeakingRoute("/speak/teacher/create"), true);
  assert.equal(isTeacherSpeakingRoute("/quiz-strike/teacher/speaking/create"), true);
});

test("student join links carry the session code and prefill it safely", () => {
  assert.equal(getJoinCodeFromSearch("?code=abc123"), "ABC123");
  assert.equal(getJoinCodeFromSearch("?code=%20yvhcmq%20"), "YVHCMQ");
  assert.equal(buildStudentJoinUrl("https://class.example/", "abc123"), "https://class.example/join?code=ABC123");
  assert.equal(buildSpeakingJoinUrl("https://class.example/", "abc123"), "https://class.example/speak/join/ABC123");
});
