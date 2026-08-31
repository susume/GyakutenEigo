import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SPEAKING_RUBRIC, SpeakingEvaluationSchema, type SpeakingCreateActivityInput } from "@quizstrike/shared";
import { SPEAKING_TEMPLATES, activityByCode, appendTurn, createActivity, createLocalSession, makeDemoEvaluation } from "./speakingData.js";
import { mockEvaluationProvider, mockTranscriptionProvider } from "./speakingProviders.js";

const input: SpeakingCreateActivityInput = {
  title: "  Shopping for Clothes  ",
  scenario: "The student is buying a T-shirt.",
  aiRole: "Shop assistant",
  studentRole: "Customer",
  level: "elementary",
  difficulty: "normal",
  nativeLanguage: "ja",
  durationSeconds: 300,
  identifierMode: "nickname",
  targetExpressions: ["I'd like...", "How much is it?"],
  rubric: DEFAULT_SPEAKING_RUBRIC
};

test("speaking data provides six immediately joinable templates and bounded activity creation", () => {
  assert.equal(SPEAKING_TEMPLATES.length, 6);
  assert.equal(activityByCode({ activities: SPEAKING_TEMPLATES, sessions: {} }, "abc123")?.title, "Shopping for Clothes");
  const activity = createActivity(input, "teacher-1");
  assert.equal(activity.title, "Shopping for Clothes");
  assert.match(activity.joinCode, /^[A-Z2-9]{6}$/);
  assert.equal(activity.rubric.length, DEFAULT_SPEAKING_RUBRIC.length);
  assert.equal(activity.durationSeconds, 300);
});

test("local mock session records structured turns and validates deterministic evaluation output", () => {
  const session = createLocalSession(SPEAKING_TEMPLATES[1]!, "Aki");
  const next = appendTurn(session, { speaker: "student", text: "I want a blue T-shirt.", usedHelp: true, transcriptionConfidence: 0.94 });
  assert.equal(next.turns.filter((turn) => turn.speaker === "student").length, 1);
  assert.equal(next.turns.at(-1)?.usedHelp, true);
  assert.equal(SpeakingEvaluationSchema.safeParse(makeDemoEvaluation("participant-1")).success, true);
});

test("silence does not create a transcript or a passing evaluation", async () => {
  const activity = SPEAKING_TEMPLATES[1]!;
  const transcription = await mockTranscriptionProvider.transcribe(undefined, 0, { hasMicrophone: true, speechDetected: false });
  assert.equal(transcription.text, "");

  const session = createLocalSession(activity, "Aki");
  const evaluation = await mockEvaluationProvider.evaluate({ activity, turns: session.turns, participantId: "silent-participant", helpCount: 0 });
  assert.deepEqual(Object.values(evaluation.scores), [1, 1, 1, 1, 1]);
  assert.equal(evaluation.usefulEnglish.length, 0);
  assert.match(evaluation.overallMessage, /声が聞こえませんでした/);
});
