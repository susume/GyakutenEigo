import assert from "node:assert/strict";
import test from "node:test";
import { SpeakingEvaluationSchema, speakingScenarioResources } from "@quizstrike/shared";
import { SPEAKING_TEMPLATES, formatDuration, makeDemoEvaluation, previewActivityLimits } from "./speakingData.js";

test("speaking templates are static previews and never carry a classroom join code", () => {
  assert.equal(SPEAKING_TEMPLATES.length, 6);
  assert.equal(SPEAKING_TEMPLATES.every((activity) => !Object.hasOwn(activity, "joinCode")), true);
  assert.equal(SPEAKING_TEMPLATES.every((activity) => activity.status === "ready"), true);
  assert.equal(previewActivityLimits.maxExpressions, 12);
});

test("only the explicitly labeled home preview creates demo evaluation data", () => {
  const evaluation = makeDemoEvaluation("preview-participant");
  assert.equal(SpeakingEvaluationSchema.safeParse(evaluation).success, true);
  assert.equal(evaluation.participantId, "preview-participant");
  assert.equal(formatDuration(300), "5:00");
  assert.equal(formatDuration(-1), "0:00");
});

test("scenario resources stay attached to the activity instead of being inferred from its title", () => {
  const restaurant = speakingScenarioResources(SPEAKING_TEMPLATES.find((activity) => activity.id === "template-restaurant")?.scenarioResources);
  const hobbies = speakingScenarioResources(SPEAKING_TEMPLATES.find((activity) => activity.id === "template-hobbies")?.scenarioResources);
  assert.equal(restaurant.referenceItems[0]?.label, "Soup");
  assert.equal(hobbies.referenceItems.length, 0);
  assert.equal(hobbies.studentGoal.toLocaleLowerCase().includes("restaurant"), false);
  assert.equal(SPEAKING_TEMPLATES.find((activity) => activity.id === "template-hobbies")?.targetExpressions.length, 4);
});

test("all configured target expressions remain discoverable to the live experience", () => {
  const activity = SPEAKING_TEMPLATES[0]!;
  const expandedExpressions = [...activity.targetExpressions, "Could I have a glass of water?"];
  assert.equal(expandedExpressions.at(-1), "Could I have a glass of water?");
  assert.ok(expandedExpressions.length >= 5);
});
