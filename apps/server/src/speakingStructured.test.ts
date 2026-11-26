import assert from "node:assert/strict";
import test from "node:test";
import { SpeakingStructuredPlanSchema, type SpeakingActivity, type SpeakingTurn } from "@quizstrike/shared";
import { assessStructuredConversation, structuredProgress } from "./speakingStructured.js";
import { createSpeakingProviders } from "./speakingProviders.js";

const plan = SpeakingStructuredPlanSchema.parse({ steps: [
  { question: "What do you like to read?", objective: "Say what you like to read.", concepts: ["like books"], followUp: "Can you give an example?" },
  { question: "What would you like to ask me?", objective: "Ask a question.", kind: "question" }
] });
const turn = (id: string, text: string, transcriptionUncertain = false): SpeakingTurn => ({ id, text, transcriptionUncertain, participantId: "student", speaker: "student", createdAt: "2026-11-26T00:00:00Z" });

test("structured replies accept alternate wording, clarify, branch and finish by replaying turns", () => {
  const turns = [turn("uncertain", "Books?", true)];
  assert.match(structuredProgress(plan, turns).reply, /Let me ask again/);
  turns.push(turn("preference", "I really enjoy books about animals."));
  assert.equal(structuredProgress(plan, turns).reply, "Can you give an example?");
  turns.push(turn("detail", "A story about a dog."));
  assert.equal(structuredProgress(plan, turns).reply, "What would you like to ask me?");
  turns.push(turn("question", "Do you like picture books?"));
  const result = structuredProgress(plan, turns);
  assert.equal(result.complete, true);
  assert.deepEqual([...result.evidence.values()], [["preference"], ["question"]]);
});

test("provisional scores cite transcript evidence and leave unsupported criteria for review", () => {
  const activity = {
    nativeLanguage: "ja",
    rubric: ["task_achievement", "interaction", "fluency", "intonation", "language_control"].map((id) => ({ id, name: id, description: id, enabled: true }))
  } as SpeakingActivity;
  const evaluate = (text: string) => assessStructuredConversation(plan, activity, [turn("preference", text)], "student", "2026-11-26T00:00:00Z");
  const alternate = evaluate("I like reading comics.");
  assert.equal(alternate.assessmentStatus, "insufficient_evidence");
  assert.equal(alternate.goalCompletion?.requirements[0]?.status, "uncertain");
  assert.ok(Object.values(alternate.scores).every((score) => score === null));
  const matched = evaluate("I enjoy books.");
  assert.equal(matched.scores.task_achievement, null);
  assert.equal(matched.goalCompletion?.requirements[0]?.status, "completed");
  const complete = assessStructuredConversation(plan, activity, [turn("preference", "I enjoy books."), turn("detail", "Animal stories."), turn("question", "What do you like?")], "student", "2026-11-26T00:00:00Z");
  assert.equal(complete.scores.task_achievement, 4);
  assert.equal(matched.scores.fluency, null);
  assert.equal(matched.scores.intonation, null);
});

test("a provider-independent production process needs no provider credentials", () => {
  const providers = createSpeakingProviders({
    NODE_ENV: "production", SPEAKING_PROVIDER_INDEPENDENT_ONLY: "true",
    SPEAKING_AI_PROVIDER: "gemini", SPEAKING_TRANSCRIPTION_PROVIDER: "gemini"
  });
  assert.ok(Object.values(providers).every((provider) => provider.providerName === "mock"));
});
