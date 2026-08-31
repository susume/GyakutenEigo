import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SPEAKING_RUBRIC, type SpeakingCreateActivityInput, type SpeakingEvaluation } from "@quizstrike/shared";
import { InMemorySpeakingRepository, createInMemorySpeakingState, hashSpeakingToken } from "./speakingRepository.js";

const input: SpeakingCreateActivityInput = {
  title: "Repository activity",
  scenario: "A short classroom practice.",
  aiRole: "Partner",
  studentRole: "Student",
  level: "beginner",
  difficulty: "easy",
  nativeLanguage: "ja",
  durationSeconds: 120,
  identifierMode: "nickname",
  targetExpressions: ["Hello."],
  rubric: DEFAULT_SPEAKING_RUBRIC
};

const evaluation = (participantId: string): SpeakingEvaluation => ({
  participantId,
  language: "ja",
  scores: { communication: 3 },
  evidence: { communication: "Evidence" },
  strengths: ["Good effort."],
  improvements: ["Try one more question."],
  usefulEnglish: [],
  overallMessage: "Keep practicing.",
  createdAt: "2026-08-31T00:00:00.000Z"
});

test("repository state survives service re-instantiation and isolates participants in one session", async () => {
  const state = createInMemorySpeakingState();
  const first = new InMemorySpeakingRepository(state);
  const activity = await first.createActivity("teacher-1", input, "activity-1", "2026-08-31T00:00:00.000Z");
  const session = await first.createSession({ id: "session-1", activity, joinCode: "ABC234", createdAt: "2026-08-31T00:00:00.000Z", expiresAt: "2026-08-31T08:00:00.000Z" });
  const participantA = await first.createParticipant({ id: "participant-a", activity, session, displayIdentifier: "Aki", tokenHash: hashSpeakingToken("token-a") });
  const participantB = await first.createParticipant({ id: "participant-b", activity, session, displayIdentifier: "Beni", tokenHash: hashSpeakingToken("token-b") });
  await first.appendTurn({ id: "turn-a", participantId: participantA.id, speaker: "student", text: "Hello.", createdAt: "2026-08-31T00:00:01.000Z" });
  await first.saveEvaluation(participantA.id, evaluation(participantA.id));

  const second = new InMemorySpeakingRepository(state);
  const access = await second.getParticipantAccessByTokenHash(hashSpeakingToken("token-b"));
  assert.equal(access?.session.id, session.id);
  assert.equal(access?.participant.id, participantB.id);
  assert.equal((await second.listTurns(participantB.id)).length, 0);
  const resultA = await second.getResult(participantA.id);
  assert.equal(resultA?.evaluation?.participantId, participantA.id);
  assert.equal((await second.listResults(activity.id, session.id, "teacher-1")).length, 2);
  assert.equal((await second.listResults(activity.id, session.id, "teacher-1")).filter((item) => item.evaluation).length, 1);
});
