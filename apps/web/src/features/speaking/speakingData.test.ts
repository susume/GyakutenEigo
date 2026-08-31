import assert from "node:assert/strict";
import test from "node:test";
import { SpeakingEvaluationSchema } from "@quizstrike/shared";
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
