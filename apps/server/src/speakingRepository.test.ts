import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SPEAKING_RUBRIC, speakingActiveElapsedMs, speakingRemainingSeconds, type SpeakingCreateActivityInput, type SpeakingEvaluation } from "@quizstrike/shared";
import { InMemorySpeakingRepository, createInMemorySpeakingState, createSpeakingRepository, hashSpeakingToken } from "./speakingRepository.js";

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
  assessmentStatus: "scored",
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

test("activity edits preserve old session snapshots and update new sessions", async () => {
  const repository = new InMemorySpeakingRepository(createInMemorySpeakingState());
  const original = await repository.createActivity("teacher-1", input, "activity-edit", "2026-08-31T00:00:00.000Z");
  const sessionA = await repository.createSession({ id: "session-a", activity: original, joinCode: "ABC235", createdAt: "2026-08-31T00:00:00.000Z", expiresAt: "2026-08-31T08:00:00.000Z" });
  const edited = await repository.updateActivity("teacher-1", original.id, {
    ...input,
    difficulty: "challenge",
    nativeLanguage: "en",
    targetExpressions: ["New phrase."],
    rubric: [{ ...DEFAULT_SPEAKING_RUBRIC[0]!, enabled: true }]
  }, "2026-08-31T01:00:00.000Z");
  assert.equal(edited?.id, original.id);
  assert.equal(edited?.teacherId, original.teacherId);
  assert.equal(edited?.createdAt, original.createdAt);
  assert.equal(edited?.updatedAt, "2026-08-31T01:00:00.000Z");

  const sessionB = await repository.createSession({ id: "session-b", activity: edited!, joinCode: "ABC236", createdAt: "2026-08-31T01:00:00.000Z", expiresAt: "2026-08-31T09:00:00.000Z" });
  const snapshotA = await repository.getSession(sessionA.id);
  const snapshotB = await repository.getSession(sessionB.id);
  assert.equal(snapshotA?.activity.difficulty, "easy");
  assert.equal(snapshotA?.activity.nativeLanguage, "ja");
  assert.deepEqual(snapshotA?.activity.targetExpressions, ["Hello."]);
  assert.deepEqual(snapshotA?.activity.rubric.map((criterion) => criterion.id), DEFAULT_SPEAKING_RUBRIC.map((criterion) => criterion.id));
  assert.equal(snapshotB?.activity.difficulty, "challenge");
  assert.equal(snapshotB?.activity.nativeLanguage, "en");
  assert.deepEqual(snapshotB?.activity.targetExpressions, ["New phrase."]);
  assert.deepEqual(snapshotB?.activity.rubric.map((criterion) => criterion.id), ["communication"]);
});

test("speaking repository fails closed for production without Prisma", () => {
  assert.throws(() => createSpeakingRepository({ environment: "production" }), /durable Prisma database/);
  assert.ok(createSpeakingRepository({ environment: "development" }) instanceof InMemorySpeakingRepository);
});

test("participant active time excludes a finalized teacher pause", async () => {
  const repository = new InMemorySpeakingRepository(createInMemorySpeakingState());
  const created = await repository.createActivity("teacher-1", input, "activity-time", "2026-08-31T00:00:00.000Z");
  const session = await repository.createSession({ id: "session-time", activity: created, joinCode: "ABC237", createdAt: "2026-08-31T00:00:00.000Z", expiresAt: "2026-08-31T08:00:00.000Z" });
  const participant = await repository.createParticipant({ id: "participant-time", activity: created, session, displayIdentifier: "Aki", tokenHash: hashSpeakingToken("token-time") });
  const finishedParticipant = await repository.createParticipant({ id: "participant-finished-during-pause", activity: created, session, displayIdentifier: "Beni", tokenHash: hashSpeakingToken("token-finished-during-pause") });
  await repository.startParticipant(participant.id, "2026-08-31T00:00:00.000Z");
  await repository.startParticipant(finishedParticipant.id, "2026-08-31T00:00:00.000Z");
  await repository.updateSession(session.id, { status: "active", startedAt: "2026-08-31T00:00:00.000Z" });
  await repository.updateSession(session.id, { status: "paused", pausedAt: "2026-08-31T00:01:00.000Z" });
  await repository.updateParticipant(finishedParticipant.id, { status: "completed", finishedAt: "2026-08-31T00:02:00.000Z" });
  await repository.finalizeSessionPause(session.id, "2026-08-31T00:03:00.000Z");
  const updated = await repository.getParticipant(participant.id);
  assert.equal(updated?.pausedDurationMs, 120_000);
  assert.equal(updated?.startedAt, "2026-08-31T00:00:00.000Z");
  const pausedSession = await repository.getSession(session.id);
  assert.equal(speakingActiveElapsedMs(updated!, pausedSession!.session, "2026-08-31T00:03:00.000Z"), 60_000);
  assert.equal(speakingRemainingSeconds(updated!, pausedSession!.session, 120, "2026-08-31T00:03:00.000Z"), 60);
  const updatedFinishedParticipant = await repository.getParticipant(finishedParticipant.id);
  assert.equal(updatedFinishedParticipant?.pausedDurationMs, 60_000);
  assert.equal(speakingActiveElapsedMs(updatedFinishedParticipant!, pausedSession!.session, updatedFinishedParticipant!.finishedAt!), 60_000);
});
