import assert from "node:assert/strict";
import test from "node:test";
import type { QuizSet } from "@quizstrike/shared";
import { ContributionService } from "./contributionService.js";
import { buildRecognitionSummary, getRecognitionLevel, isMeaningfulStudySet } from "./recognition.js";
import { canTeacherUseStudySet, canTeacherViewStudySet } from "./routes/studySets.js";
import { createQuestionSnapshot } from "./routes/sessionRoutes.js";

const question = (id: string) => ({
  id,
  quizSetId: "set",
  prompt: `Question ${id}`,
  choiceA: "A",
  choiceB: "B",
  choiceC: "C",
  choiceD: "D",
  correctChoice: "A" as const,
  createdAt: "2026-08-12T00:00:00.000Z"
});

const studySet = (id: string, teacherId: string): QuizSet => ({
  id,
  teacherId,
  title: "Useful Study Set",
  visibility: "PUBLIC",
  questions: [question(`${id}-1`), question(`${id}-2`)],
  createdAt: "2026-08-12T00:00:00.000Z"
});

test("Study Set publication quality requires a title and complete questions", () => {
  assert.equal(isMeaningfulStudySet(studySet("set", "teacher")), true);
  assert.equal(isMeaningfulStudySet({ ...studySet("set", "teacher"), questions: [question("one")] }), false);
  assert.equal(isMeaningfulStudySet({ ...studySet("set", "teacher"), questions: [{ ...question("one"), choiceD: "" }, question("two")] }), false);
});

test("private Study Sets are owner-only while public Study Sets are reusable", () => {
  assert.equal(canTeacherViewStudySet({ ...studySet("private", "owner"), visibility: "PRIVATE" }, "owner"), true);
  assert.equal(canTeacherViewStudySet({ ...studySet("private", "owner"), visibility: "PRIVATE" }, "other"), false);
  assert.equal(canTeacherViewStudySet({ ...studySet("public", "owner"), visibility: "PUBLIC" }, "other"), true);
  assert.equal(canTeacherViewStudySet(undefined, "other"), false);
  assert.equal(canTeacherUseStudySet({ ...studySet("private", "owner"), visibility: "PRIVATE" }, "other"), false);
  assert.equal(canTeacherUseStudySet({ ...studySet("public", "owner"), visibility: "PUBLIC" }, "other"), true);
  assert.equal(canTeacherUseStudySet({ ...studySet("archived", "owner"), status: "ARCHIVED" }, "owner"), false);
});

test("recognition levels and badges are derived from server-side stats", () => {
  assert.equal(getRecognitionLevel(0).name, "Teacher");
  assert.equal(getRecognitionLevel(350).name, "Community Educator");
  const summary = buildRecognitionSummary({
    points: 150,
    studySetsCreated: 1,
    publicSetsShared: 1,
    gamesHosted: 10,
    studentsReached: 20,
    teachersUsingSets: 1,
    totalSetUses: 2,
    badgeRows: [
      { id: "first", badgeId: "FIRST_SET", earnedAt: "2026-08-12T00:00:00.000Z" },
      { id: "share", badgeId: "SHARING_KNOWLEDGE", earnedAt: "2026-08-12T00:00:00.000Z" },
      { id: "regular", badgeId: "CLASSROOM_REGULAR", earnedAt: "2026-08-12T00:00:00.000Z" },
      { id: "helpful", badgeId: "HELPFUL_TEACHER", earnedAt: "2026-08-12T00:00:00.000Z" }
    ]
  });
  assert.equal(summary.level, "Helpful Teacher");
  assert.deepEqual(summary.badges.map((badge) => badge.id), ["FIRST_SET", "SHARING_KNOWLEDGE", "CLASSROOM_REGULAR", "HELPFUL_TEACHER"]);
  const retained = buildRecognitionSummary({
    points: 5,
    studySetsCreated: 0,
    publicSetsShared: 0,
    gamesHosted: 0,
    studentsReached: 0,
    teachersUsingSets: 0,
    totalSetUses: 0,
    badgeRows: [{ id: "share", badgeId: "SHARING_KNOWLEDGE", earnedAt: "2026-08-12T00:00:00.000Z" }]
  });
  assert.deepEqual(retained.badges.map((badge) => badge.id), ["SHARING_KNOWLEDGE"]);
});

test("reuse credits only once per external teacher and never for creator self-use", async () => {
  const sets = new Map([["set", studySet("set", "owner")]]);
  const service = new ContributionService(() => sets.values());
  await service.recordStudySetCreated(sets.get("set")!);
  await service.recordStudySetUse({ studySetId: "set", ownerTeacherId: "owner", consumerTeacherId: "owner", sessionId: "self" });
  await service.recordStudySetUse({ studySetId: "set", ownerTeacherId: "owner", consumerTeacherId: "teacher-b", sessionId: "game-1" });
  await service.recordStudySetUse({ studySetId: "set", ownerTeacherId: "owner", consumerTeacherId: "teacher-b", sessionId: "game-2" });
  const summary = await service.getSummary("owner");
  assert.equal(summary.totalSetUses, 3);
  assert.equal(summary.teachersUsingSets, 1);
  assert.equal(summary.points, 30);
});

test("game question snapshots are detached from later Study Set edits", () => {
  const source = studySet("set", "owner");
  const snapshot = createQuestionSnapshot(source.questions);
  source.questions[0].prompt = "Edited after game creation";
  source.questions[0].choiceA = "Changed answer";
  assert.equal(snapshot[0].prompt, "Question set-1");
  assert.equal(snapshot[0].choiceA, "A");
});

test("empty and remixed sets do not earn creation recognition", async () => {
  const empty: QuizSet = { ...studySet("empty", "teacher"), questions: [] };
  const remix: QuizSet = { ...studySet("remix", "teacher"), visibility: "PRIVATE", originalSetId: "source" };
  const sets = new Map([[empty.id, empty], [remix.id, remix]]);
  const service = new ContributionService(() => sets.values());
  await service.recordStudySetCreated(empty);
  await service.recordStudySetCreated(remix);
  const summary = await service.getSummary("teacher");
  assert.equal(summary.points, 0);
  assert.equal(summary.studySetsCreated, 0);
  assert.equal(summary.badges.length, 0);
});

test("recreating identical content under a new ID cannot farm creation points", async () => {
  const first = studySet("first", "teacher");
  const recreated = {
    ...studySet("recreated", "teacher"),
    title: first.title,
    questions: first.questions.map((item, index) => ({ ...item, id: `recreated-${index}`, quizSetId: "recreated" }))
  };
  const sets = new Map([[first.id, first]]);
  const service = new ContributionService(() => sets.values());
  await service.recordStudySetCreated(first);
  sets.delete(first.id);
  sets.set(recreated.id, recreated);
  await service.recordStudySetCreated(recreated);
  const summary = await service.getSummary("teacher");
  assert.equal(summary.points, 25);
});
