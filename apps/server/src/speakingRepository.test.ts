import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SPEAKING_RUBRIC, speakingActiveElapsedMs, speakingRemainingSeconds, type SpeakingCreateActivityInput, type SpeakingEvaluation } from "@quizstrike/shared";
import { InMemorySpeakingRepository, PrismaSpeakingRepository, createInMemorySpeakingState, createSpeakingRepository, hashSpeakingToken } from "./speakingRepository.js";
import type { PrismaClient } from "@prisma/client";

test("Prisma history queries and atomic deletion constrain terminal statuses and ownership", async () => {
  const calls: unknown[] = [];
  const prisma = {
    speakingActivity: { findMany: async (query: unknown) => { calls.push(query); return []; } },
    speakingSession: { deleteMany: async (query: unknown) => { calls.push(query); return { count: 0 }; } }
  } as unknown as PrismaClient;
  const repository = new PrismaSpeakingRepository(prisma);
  assert.deepEqual(await repository.listReportSummaries("owner"), []);
  assert.equal(await repository.deleteSession("owner", "live"), false);
  const query = calls[0] as { where: unknown; include: { sessions: { where: unknown } } };
  assert.deepEqual(query.where, { teacherId: "owner" });
  assert.deepEqual(query.include.sessions.where, { status: { in: ["ended", "expired", "completed"] } });
  assert.deepEqual(calls[1], { where: { id: "live", activity: { teacherId: "owner" }, status: { in: ["ended", "expired", "completed"] } } });
});

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

test("repeated process restarts exhaust the durable evaluation attempt budget", async () => {
  const state = createInMemorySpeakingState();
  let repository = new InMemorySpeakingRepository(state);
  const now = "2026-09-12T00:00:00.000Z";
  const activity = await repository.createActivity("teacher-1", input, "crash-activity", now);
  const session = await repository.createSession({ id: "crash-session", activity, joinCode: "ABC238", createdAt: now, expiresAt: "2026-09-13T00:00:00.000Z" });
  const participant = await repository.createParticipant({ id: "crash-participant", activity, session, tokenHash: hashSpeakingToken("crash-token") });
  await repository.upsertEvaluationJob(participant.id, { id: "crash-job", queuedAt: now, updatedAt: now });
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    repository = new InMemorySpeakingRepository(state);
    assert.equal((await repository.claimEvaluationJob(participant.id, now, now))?.attempt, attempt);
  }
  assert.equal(await repository.claimEvaluationJob(participant.id, now, now), undefined);
  assert.equal((await repository.getEvaluationJob(participant.id))?.status, "failed");
  assert.equal((await repository.getParticipant(participant.id))?.status, "error");
  assert.deepEqual(await repository.recoverableEvaluationParticipants(now), []);
  assert.equal(await repository.settleEvaluationJob(participant.id, 5, now, { evaluation: evaluation(participant.id) }), false);
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

test("library, sets, reports, and safe deletion preserve the reusable-test model", async () => {
  const repository = new InMemorySpeakingRepository(createInMemorySpeakingState());
  const now = "2026-09-01T00:00:00.000Z";
  const activity = await repository.createActivity("teacher-1", input, "library-activity", now);
  const secondActivity = await repository.createActivity("teacher-1", { ...input, title: "Second activity" }, "library-activity-2", now);
  const session = await repository.createSession({ id: "library-session", activity, joinCode: "ABC240", createdAt: now, expiresAt: "2026-09-01T08:00:00.000Z" });
  await repository.createSession({ id: "archived-session", activity: secondActivity, joinCode: "ABC241", createdAt: now, expiresAt: "2026-09-01T08:00:00.000Z" });
  const participant = await repository.createParticipant({ id: "library-participant", activity, session, displayIdentifier: "Aki", tokenHash: hashSpeakingToken("library-token") });
  await repository.updateParticipant(participant.id, { status: "completed", finishedAt: "2026-09-01T00:02:00.000Z" });
  await repository.saveEvaluation(participant.id, evaluation(participant.id));

  await repository.updateSession(session.id, { status: "ended", endedAt: now });
  await repository.updateSession("archived-session", { status: "ended", endedAt: now });

  const set = await repository.createSet("teacher-1", { name: "Week 1", description: "First week" }, "library-set", now);
  await repository.addSetActivity("teacher-1", set.id, activity.id);
  await repository.addSetActivity("teacher-1", set.id, secondActivity.id);
  const detail = await repository.getSet("teacher-1", set.id);
  assert.deepEqual(detail?.activities.map((item) => item.activity.id), [activity.id, secondActivity.id]);
  assert.equal(detail?.activities[0]?.sessionCount, 1);

  const library = await repository.listActivityLibrary("teacher-1");
  assert.equal(library.find((item) => item.activity.id === activity.id)?.sessionCount, 1);
  assert.equal(library.find((item) => item.activity.id === activity.id)?.setMemberships[0]?.id, set.id);
  const reports = await repository.listReportSummaries("teacher-1");
  assert.equal(reports[0]?.participantCount, 1);
  assert.equal(reports[0]?.completedCount, 1);
  assert.deepEqual(reports[0]?.setMemberships, []); // Launched before membership existed.

  assert.equal(await repository.reorderSetActivities("teacher-1", set.id, [secondActivity.id, activity.id]) !== undefined, true);
  assert.deepEqual((await repository.getSet("teacher-1", set.id))?.activities.map((item) => item.activity.id), [secondActivity.id, activity.id]);
  assert.equal(await repository.archiveActivity("teacher-1", secondActivity.id), true);
  assert.equal((await repository.listActivityLibrary("teacher-1")).some((item) => item.activity.id === secondActivity.id), false);
  assert.equal((await repository.listReportSummaries("teacher-1")).some((item) => item.activity.id === secondActivity.id), true);

  assert.equal(await repository.deleteSession("other-teacher", session.id), false);
  assert.equal(await repository.deleteSession("teacher-1", session.id), true);
  assert.equal((await repository.listReportSummaries("teacher-1")).some((item) => item.session.id === session.id), false);
  assert.equal(await repository.deleteSet("teacher-1", set.id), true);
  assert.equal((await repository.listSets("teacher-1")).length, 0);
});

test("speaking repository fails closed for production without Prisma", () => {
  assert.throws(() => createSpeakingRepository({ environment: "production" }), /durable Prisma database/);
  assert.ok(createSpeakingRepository({ environment: "development" }) instanceof InMemorySpeakingRepository);
});

test("Set ordering rejects duplicates and retains order after removal", async () => {
  const repository = new InMemorySpeakingRepository(createInMemorySpeakingState());
  const now = "2026-09-09T00:00:00.000Z";
  await repository.createSet("owner", { name: "Ordered" }, "set", now);
  for (const id of ["a", "b", "c"]) {
    await repository.createActivity("owner", input, id, now);
    await repository.addSetActivity("owner", "set", id);
  }
  assert.equal(await repository.reorderSetActivities("owner", "set", ["a", "a", "c"]), undefined);
  assert.equal((await repository.getSet("owner", "set"))?.activities.length, 3);
  await repository.reorderSetActivities("owner", "set", ["c", "b", "a"]);
  await repository.removeSetActivity("owner", "set", "b");
  assert.deepEqual((await repository.getSet("owner", "set"))?.activities.map((item) => item.activity.id), ["c", "a"]);
});

test("report summaries preserve the session title after editing a reusable test", async () => {
  const repository = new InMemorySpeakingRepository(createInMemorySpeakingState());
  const now = "2026-09-09T00:00:00.000Z";
  const activity = await repository.createActivity("owner", input, "a", now);
  await repository.createSession({ id: "s", activity, joinCode: "ABC999", createdAt: now, expiresAt: now });
  await repository.updateSession("s", { status: "ended", endedAt: now });
  await repository.updateActivity("owner", "a", { ...input, title: "Edited title" }, now);
  assert.equal((await repository.listReportSummaries("owner"))[0]?.activity.title, input.title);
});

test("expired evaluation workers cannot replace a newer result", async () => {
  const state = createInMemorySpeakingState();
  const repository = new InMemorySpeakingRepository(state);
  const now = "2026-09-06T00:00:00.000Z";
  const activity = await repository.createActivity("teacher-1", input, "lease-activity", now);
  const session = await repository.createSession({ id: "lease-session", activity, joinCode: "ABC238", createdAt: now, expiresAt: "2026-09-06T08:00:00.000Z" });
  const participant = await repository.createParticipant({ id: "lease-participant", activity, session, tokenHash: hashSpeakingToken("lease-token") });
  await repository.upsertEvaluationJob(participant.id, { id: "lease-job", queuedAt: now, updatedAt: now });
  const first = await repository.claimEvaluationJob(participant.id, now, "2026-09-06T00:01:00.000Z");
  const restarted = new InMemorySpeakingRepository(state);
  assert.deepEqual(await restarted.recoverableEvaluationParticipants("2026-09-06T00:01:00.000Z"), [participant.id]);
  const second = await restarted.claimEvaluationJob(participant.id, "2026-09-06T00:01:00.000Z", "2026-09-06T00:02:00.000Z");
  assert.ok(first && second && second.attempt > first.attempt);
  assert.equal(await repository.settleEvaluationJob(participant.id, first!.attempt, now, { errorCode: "timeout" }), false);
  assert.equal(await restarted.settleEvaluationJob(participant.id, second!.attempt, now, { evaluation: evaluation(participant.id) }), true);
  assert.equal(await repository.settleEvaluationJob(participant.id, first!.attempt, now, { errorCode: "timeout" }), false);
  assert.equal((await repository.getParticipant(participant.id))?.status, "completed");
  assert.ok((await repository.getResult(participant.id))?.evaluation);
});

test("evaluation retry state survives a restart and becomes terminal after a permanent failure", async () => {
  const state = createInMemorySpeakingState();
  const repository = new InMemorySpeakingRepository(state);
  const now = "2026-09-12T00:00:00.000Z";
  const activity = await repository.createActivity("teacher-1", input, "retry-activity", now);
  const session = await repository.createSession({ id: "retry-session", activity, joinCode: "ABC242", createdAt: now, expiresAt: "2026-09-12T08:00:00.000Z" });
  const participant = await repository.createParticipant({ id: "retry-participant", activity, session, tokenHash: hashSpeakingToken("retry-token") });
  await repository.upsertEvaluationJob(participant.id, { id: "retry-job", queuedAt: now, updatedAt: now });
  const first = await repository.claimEvaluationJob(participant.id, now, "2026-09-12T00:01:00.000Z");
  assert.ok(first);
  assert.equal(await repository.settleEvaluationJob(participant.id, first!.attempt, "2026-09-12T00:00:01.000Z", { errorCode: "timeout", retryable: true, nextRetryAt: "2026-09-12T00:00:10.000Z" }), true);
  assert.equal((await repository.getEvaluationJob(participant.id))?.status, "retrying");
  assert.deepEqual(await new InMemorySpeakingRepository(state).recoverableEvaluationParticipants("2026-09-12T00:00:09.000Z"), []);
  assert.deepEqual(await new InMemorySpeakingRepository(state).recoverableEvaluationParticipants("2026-09-12T00:00:10.000Z"), [participant.id]);
  const second = await repository.claimEvaluationJob(participant.id, "2026-09-12T00:00:10.000Z", "2026-09-12T00:02:10.000Z");
  assert.equal(second?.attempt, 2);
  assert.equal(await repository.settleEvaluationJob(participant.id, second!.attempt, "2026-09-12T00:00:11.000Z", { errorCode: "authentication", retryable: false, nextRetryAt: null }), true);
  assert.equal((await repository.getEvaluationJob(participant.id))?.status, "failed");
  assert.equal((await repository.getParticipant(participant.id))?.status, "error");
  assert.deepEqual(await repository.recoverableEvaluationParticipants("2026-09-12T00:05:00.000Z"), []);
});

test("concurrent classroom admission respects capacity and request identity", async () => {
  const repository = new InMemorySpeakingRepository(createInMemorySpeakingState());
  const now = "2026-09-06T00:00:00.000Z";
  const activity = await repository.createActivity("teacher-1", input, "capacity-activity", now);
  const session = await repository.createSession({ id: "capacity-session", activity, joinCode: "ABC239", createdAt: now, expiresAt: "2026-09-06T08:00:00.000Z" });
  const attempts = await Promise.allSettled(Array.from({ length: 12 }, (_, index) => repository.createParticipant({ id: `capacity-${index}`, activity, session, maxParticipants: 3, joinRequestId: `request-${index}`, tokenHash: hashSpeakingToken(`capacity-token-${index}`) })));
  assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 3);
  assert.equal(await repository.countParticipants(session.id), 3);
  await assert.rejects(repository.createParticipant({ id: "duplicate", activity, session, maxParticipants: 3, joinRequestId: "request-0", tokenHash: hashSpeakingToken("duplicate-token") }), /duplicate/);
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
