import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SPEAKING_RUBRIC } from "./speaking.js";
import { hwgDoctorGrade, HWG_DOCTOR_RUBRIC, SPEAKING_RUBRIC_FAIRNESS_RULES, SPEAKING_RUBRIC_GUIDE } from "./speakingRubric.js";

test("all default criteria have distinct observable anchors at every score", () => {
  assert.deepEqual(SPEAKING_RUBRIC_GUIDE.map((criterion) => criterion.id), DEFAULT_SPEAKING_RUBRIC.map((criterion) => criterion.id));
  for (const criterion of SPEAKING_RUBRIC_GUIDE) {
    assert.deepEqual(Object.keys(criterion.levels).sort(), ["0", "1", "2", "3", "4"]);
    assert.equal(new Set(Object.values(criterion.levels)).size, 5);
    assert.ok(Object.values(criterion.levels).every((anchor) => anchor.length > 30));
  }
  assert.ok(SPEAKING_RUBRIC_FAIRNESS_RULES.some((rule) => /null \(N\/A\), not 0/u.test(rule)));
  assert.ok(SPEAKING_RUBRIC_FAIRNESS_RULES.some((rule) => /use alone cannot lower a score or prevent full credit/u.test(rule)));
});

test("HWG DL6 grades use raw points and require all four scores", () => {
  const rubric = HWG_DOCTOR_RUBRIC.map(({ id }) => ({ id, enabled: true }));
  for (const [values, grade] of [
    [[5, 5, 5, 5], "A"], [[5, 5, 5, 2], "A"], [[5, 5, 5, 1], "B"],
    [[5, 3, 3, 0], "B"], [[5, 3, 2, 0], "C"], [[0, 0, 0, 0], "C"]
  ] as const) {
    const scores = Object.fromEntries(rubric.map(({ id }, index) => [id, values[index]!]));
    assert.deepEqual(hwgDoctorGrade(rubric, scores), { points: values.reduce<number>((sum, score) => sum + score, 0), grade });
  }
  const partial = Object.fromEntries(rubric.map(({ id }, index) => [id, index === 0 ? null : 5]));
  assert.equal(hwgDoctorGrade(rubric, partial), undefined);
});
