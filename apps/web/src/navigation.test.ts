import assert from "node:assert/strict";
import test from "node:test";
import { modeForRoute, normalizeRoutePath } from "./navigation.js";

test("route helpers keep URL and screen mode aligned", () => {
  assert.equal(normalizeRoutePath("/quiz-strike/"), "/quiz-strike");
  assert.equal(normalizeRoutePath("/"), "/");
  assert.equal(modeForRoute("/"), "home");
  assert.equal(modeForRoute("/quiz-strike"), "quizStrike");
  assert.equal(modeForRoute("/join"), "student");
  assert.equal(modeForRoute("/game"), "student");
  assert.equal(modeForRoute("/character-lab"), "characterLab");
});
