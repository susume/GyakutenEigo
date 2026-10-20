import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SPEAKING_RUBRIC } from "./speaking.js";
import { SPEAKING_RUBRIC_FAIRNESS_RULES, SPEAKING_RUBRIC_GUIDE } from "./speakingRubric.js";

test("all default criteria have distinct observable anchors at every score", () => {
  assert.deepEqual(SPEAKING_RUBRIC_GUIDE.map((criterion) => criterion.id), DEFAULT_SPEAKING_RUBRIC.map((criterion) => criterion.id));
  for (const criterion of SPEAKING_RUBRIC_GUIDE) {
    assert.deepEqual(Object.keys(criterion.levels).sort(), ["0", "1", "2", "3", "4"]);
    assert.equal(new Set(Object.values(criterion.levels)).size, 5);
    assert.ok(Object.values(criterion.levels).every((anchor) => anchor.length > 30));
  }
  assert.ok(SPEAKING_RUBRIC_FAIRNESS_RULES.some((rule) => /null \(N\/A\), not 0/u.test(rule)));
  assert.ok(SPEAKING_RUBRIC_FAIRNESS_RULES.some((rule) => /use alone cannot lower a score or prevent 4/u.test(rule)));
});
