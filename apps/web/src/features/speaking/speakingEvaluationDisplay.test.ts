import assert from "node:assert/strict";
import test from "node:test";
import type { SpeakingEvaluation, SpeakingTurn } from "@quizstrike/shared";
import { exactUsefulEnglishItems } from "./speakingEvaluationDisplay";

const turns: SpeakingTurn[] = [
  { id: "student-1", participantId: "p-1", speaker: "student", text: "I want to burger.", createdAt: "2026-09-12T00:00:01.000Z" },
  { id: "ai-1", participantId: "p-1", speaker: "ai", text: "Okay.", createdAt: "2026-09-12T00:00:02.000Z" }
];

const evaluation: SpeakingEvaluation = {
  participantId: "p-1",
  language: "en",
  assessmentStatus: "scored",
  scores: { communication: 3 },
  evidence: { communication: "Evidence" },
  strengths: [],
  improvements: [],
  usefulEnglish: [
    { said: "I want burger.", try: "I'd like a burger, please.", sourceTurnId: "student-1" },
    { said: "I want to burger.", try: "I'd like a burger, please." }
  ],
  overallMessage: "Good work.",
  createdAt: "2026-09-12T00:00:03.000Z"
};

test("result display resolves Useful English to exact saved student text", () => {
  assert.deepEqual(exactUsefulEnglishItems(evaluation, turns), [{
    said: "I want to burger.",
    try: "I'd like a burger, please.",
    sourceTurnId: "student-1"
  }]);
});
