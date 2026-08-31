import assert from "node:assert/strict";
import test from "node:test";
import type { SpeakingActivity } from "@quizstrike/shared";
import { mockEvaluationProvider } from "./speakingProviders.js";
import { validateSpeakingEvaluation } from "./routes/speakingRoutes.js";

const activity = {
  id: "validation-activity",
  teacherId: "teacher",
  title: "Short conversation",
  scenario: "Say hello and share one thing.",
  aiRole: "Classmate",
  studentRole: "Student",
  level: "beginner",
  difficulty: "easy",
  nativeLanguage: "en",
  durationSeconds: 120,
  status: "ready",
  identifierMode: "anonymous",
  targetExpressions: ["My name is..."],
  rubric: [{ id: "communication", name: "Communication", description: "Communicates a clear idea.", enabled: true }],
  createdAt: "2026-08-31T00:00:00.000Z",
  updatedAt: "2026-08-31T00:00:00.000Z"
} satisfies SpeakingActivity;

test("evaluation validation accepts the enabled rubric and rejects malformed provider output", async () => {
  const valid = await mockEvaluationProvider.evaluate({ activity, turns: [], participantId: "participant-1", helpMetadata: { helpCount: 0, helpedTurnCount: 0 } });
  assert.equal(validateSpeakingEvaluation(valid, activity, "participant-1").participantId, "participant-1");

  assert.throws(() => validateSpeakingEvaluation({ ...valid, scores: {} }, activity, "participant-1"), /rubric criteria/);
  assert.throws(() => validateSpeakingEvaluation({ ...valid, participantId: "other" }, activity, "participant-1"), /invalid data/);
});

test("pronunciation-like rubric scoring is rejected even if a provider returns it", async () => {
  const pronunciationActivity: SpeakingActivity = { ...activity, rubric: [{ id: "pronunciation", name: "Pronunciation", description: "Not supported", enabled: true }] };
  const output = await mockEvaluationProvider.evaluate({ activity: pronunciationActivity, turns: [], participantId: "participant-1", helpMetadata: { helpCount: 0, helpedTurnCount: 0 } });
  assert.throws(() => validateSpeakingEvaluation(output, pronunciationActivity, "participant-1"), /Pronunciation scoring/);
});
