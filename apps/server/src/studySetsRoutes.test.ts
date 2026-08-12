import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import express, { type Request } from "express";
import type { Question, QuizSet, TeacherUser } from "@quizstrike/shared";
import { ContributionService } from "./contributionService.js";
import { registerQuizSetMutationRoutes } from "./routes/quizSets.js";
import { registerQuestionRoutes } from "./routes/questions.js";
import { registerStudySetRoutes } from "./routes/studySets.js";

const teachers = new Map<string, TeacherUser>([
  ["owner", { id: "owner", name: "Owner Teacher", email: "owner@example.test", role: "teacher" }],
  ["other", { id: "other", name: "Other Teacher", email: "other@example.test", role: "teacher" }],
  ["original", { id: "original", name: "Original Teacher", email: "original@example.test", role: "teacher" }]
]);

const question = (quizSetId: string, id: string): Question => ({
  id,
  quizSetId,
  prompt: `Prompt ${id}`,
  choiceA: "Correct",
  choiceB: "Choice B",
  choiceC: "Choice C",
  choiceD: "Choice D",
  correctChoice: "A",
  createdAt: "2026-08-12T00:00:00.000Z"
});

const studySet = (id: string, visibility: "PRIVATE" | "PUBLIC", status: QuizSet["status"] = "ACTIVE"): QuizSet => ({
  id,
  teacherId: "owner",
  classId: "private-class-id",
  folderId: "private-folder-id",
  title: `${visibility} ${id}`,
  description: "Route authorization fixture",
  visibility,
  status,
  subject: "English",
  gradeLevel: "Eiken Pre-2",
  language: "English",
  questions: [question(id, `${id}-q1`), question(id, `${id}-q2`)],
  createdAt: "2026-08-12T00:00:00.000Z"
});

test("Study Set HTTP routes enforce privacy, sanitize public views, and preserve copy ownership", async () => {
  const privateSet = studySet("private", "PRIVATE");
  const publicSet = { ...studySet("public", "PUBLIC"), originalSetId: "private-origin", originalCreatorId: "original" };
  const archivedSet = studySet("archived", "PUBLIC", "ARCHIVED");
  const quizSets = new Map([[privateSet.id, privateSet], [publicSet.id, publicSet], [archivedSet.id, archivedSet]]);
  const contribution = new ContributionService(() => quizSets.values());
  const pendingContributions: Promise<unknown>[] = [];
  const app = express();
  app.use(express.json());
  const requireTeacher = (req: Request & { user?: TeacherUser }, res: express.Response, next: express.NextFunction) => {
    const teacher = teachers.get(String(req.header("x-teacher") ?? ""));
    if (!teacher) {
      res.status(401).json({ error: "Teacher login required." });
      return;
    }
    req.user = teacher;
    next();
  };
  let idCounter = 0;
  registerStudySetRoutes(app, {
    requireTeacher,
    quizSets,
    sessions: { values: () => [] },
    users: teachers,
    contribution,
    recordContribution: (operation) => { pendingContributions.push(operation); },
    getRecognitionSummary: (teacherId) => contribution.getSummary(teacherId),
    getQuestionAudio: async () => undefined,
    saveQuestionAudio: async () => undefined,
    deleteQuestionAudio: async () => undefined,
    routeParam: (value) => String(value ?? ""),
    now: () => "2026-08-12T01:00:00.000Z",
    id: () => `generated-${++idCounter}`,
    schedulePersistence: () => undefined
  });
  registerQuizSetMutationRoutes(app, {
    requireTeacher,
    quizSets,
    folders: new Map(),
    sessions: { values: () => [] },
    contribution,
    recordContribution: (operation) => { pendingContributions.push(operation); },
    assertTeacherOwnsQuiz: (teacherId, quizSetId) => {
      const quiz = quizSets.get(quizSetId);
      return quiz?.teacherId === teacherId ? quiz : undefined;
    },
    routeParam: (value) => String(value ?? ""),
    isChoice: (value): value is Question["correctChoice"] => ["A", "B", "C", "D"].includes(String(value)),
    now: () => "2026-08-12T01:00:00.000Z",
    id: () => `generated-${++idCounter}`,
    schedulePersistence: () => undefined,
    deleteQuestionAudio: async () => undefined
  });
  registerQuestionRoutes(app, {
    requireTeacher,
    getQuizQuestion: (questionId) => [...quizSets.values()].flatMap((quiz) => quiz.questions).find((item) => item.id === questionId),
    canReadQuestionAudio: () => false,
    isQuestionAudioUsedByActiveSession: () => false,
    assertTeacherOwnsQuiz: (teacherId, quizSetId) => {
      const quiz = quizSets.get(quizSetId);
      return quiz?.teacherId === teacherId ? quiz : undefined;
    },
    contribution,
    recordContribution: (operation) => { pendingContributions.push(operation); },
    getQuestionAudio: async () => undefined,
    saveQuestionAudio: async () => undefined,
    deleteQuestionAudio: async () => undefined,
    routeParam: (value) => String(value ?? ""),
    isChoice: (value): value is Question["correctChoice"] => ["A", "B", "C", "D"].includes(String(value)),
    schedulePersistence: () => undefined
  });

  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const api = async (path: string, teacherId: string, options: { method?: string; body?: unknown } = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers: { "x-teacher": teacherId, ...(options.body === undefined ? {} : { "content-type": "application/json" }) },
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
    return { response, body: await response.json() as Record<string, any> };
  };

  try {
    assert.equal((await api("/api/study-sets/private", "owner")).response.status, 200);
    assert.equal((await api("/api/study-sets/private", "other")).response.status, 404);
    assert.equal((await api("/api/study-sets/archived", "owner")).response.status, 200);
    assert.equal((await api("/api/study-sets/archived", "other")).response.status, 404);

    const listing = await api("/api/study-sets?scope=public&subject=english&gradeLevel=eiken%20pre-2", "other");
    assert.equal(listing.response.status, 200);
    assert.deepEqual(listing.body.items.map((item: { id: string }) => item.id), ["public"]);
    assert.equal(listing.body.items[0].creator.name, "Owner Teacher");
    assert.equal("originalSetId" in listing.body.items[0], false);
    const boundedPage = await api("/api/study-sets?scope=public&page=Infinity&pageSize=Infinity", "other");
    assert.equal(boundedPage.body.page, 1);
    assert.equal(boundedPage.body.pageSize, 20);

    const publicDetail = await api("/api/study-sets/public", "other");
    assert.equal(publicDetail.response.status, 200);
    assert.equal(publicDetail.body.creator.name, "Owner Teacher");
    assert.match(String(publicDetail.body.attribution), /Original Teacher/);
    assert.equal("classId" in publicDetail.body.studySet, false);
    assert.equal("folderId" in publicDetail.body.studySet, false);
    assert.equal("originalSetId" in publicDetail.body.studySet, false);

    assert.equal((await api("/api/study-sets/public", "other", { method: "PATCH", body: { title: "Hijacked" } })).response.status, 404);
    assert.equal((await api("/api/study-sets/private", "owner", { method: "PATCH", body: { visibility: "SCHOOL" } })).response.status, 400);
    assert.equal((await api("/api/quiz-sets/public", "other", { method: "DELETE" })).response.status, 404);
    assert.equal((await api("/api/questions/public-q1", "other", { method: "PUT", body: { prompt: "Hijacked" } })).response.status, 403);

    const copied = await api("/api/study-sets/public/duplicate", "other", { method: "POST" });
    assert.equal(copied.response.status, 201);
    assert.equal(copied.body.studySet.teacherId, "other");
    assert.equal(copied.body.studySet.visibility, "PRIVATE");
    assert.equal(copied.body.studySet.originalCreatorId, "original");
    assert.notEqual(copied.body.studySet.questions[0].id, publicSet.questions[0].id);
    assert.equal(publicSet.questions[0].prompt, "Prompt public-q1");

    const published = await api("/api/study-sets/private", "owner", { method: "PATCH", body: { visibility: "PUBLIC" } });
    assert.equal(published.response.status, 200);
    assert.equal(privateSet.visibility, "PUBLIC");
    const invalidEdit = await api("/api/questions/private-q1", "owner", { method: "PUT", body: { choiceD: "" } });
    assert.equal(invalidEdit.response.status, 400);
    assert.equal(privateSet.questions[0].choiceD, "Choice D");
    assert.equal((await api("/api/questions/private-q1", "owner", { method: "DELETE" })).response.status, 409);
    await Promise.all(pendingContributions);
    assert.equal(publicSet.remixCount, 1);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
