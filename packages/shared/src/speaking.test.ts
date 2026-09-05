import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SPEAKING_SCENARIO_RESOURCES, speakingScenarioResources } from "./speaking.js";

test("speaking scenario support resolves neutral defaults without title inference", () => {
  const resources = speakingScenarioResources({ openingLine: "", studentGoal: "", suggestedSteps: [], usefulVocabulary: [] });
  assert.equal(resources.openingLine, DEFAULT_SPEAKING_SCENARIO_RESOURCES.openingLine);
  assert.equal(resources.studentGoal, DEFAULT_SPEAKING_SCENARIO_RESOURCES.studentGoal);
  assert.deepEqual(resources.suggestedSteps, []);
  assert.deepEqual(resources.usefulVocabulary, []);
  assert.deepEqual(resources.referenceItems, []);
});

test("speaking scenario support bounds teacher-authored reference material", () => {
  const resources = speakingScenarioResources({
    openingLine: "A custom opening",
    suggestedSteps: Array.from({ length: 12 }, (_, index) => `Step ${index}`),
    usefulVocabulary: Array.from({ length: 20 }, (_, index) => `Word ${index}`),
    referenceItems: Array.from({ length: 30 }, (_, index) => ({ label: `Item ${index}`, detail: "detail" }))
  });
  assert.equal(resources.openingLine, "A custom opening");
  assert.equal(resources.suggestedSteps.length, 8);
  assert.equal(resources.usefulVocabulary.length, 16);
  assert.equal(resources.referenceItems.length, 24);
});
