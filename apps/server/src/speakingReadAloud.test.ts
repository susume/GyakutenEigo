import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";
import express, { type Request } from "express";
import { PrismaClient } from "@prisma/client";
import { SPEAKING_LOCAL_TRANSCRIPT_CONTENT_TYPE, type TeacherUser } from "@quizstrike/shared";
import { registerSpeakingRoutes } from "./routes/speakingRoutes.js";
import { createSpeakingProviders } from "./speakingProviders.js";

const databaseUrl = process.env.SPEAKCHECK_TEST_DATABASE_URL;
for (const backend of ["memory", "postgres"]) {
  test(`Read Aloud import, ownership, local-only submission and moderation (${backend})`, { skip: backend === "postgres" && !databaseUrl }, async (t) => {
    if (backend === "postgres") assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(new URL(databaseUrl!).hostname));
    const prisma = backend === "postgres" ? new PrismaClient({ datasourceUrl: databaseUrl }) : undefined;
    t.after(() => prisma?.$disconnect());
    const teachers = ["owner", "other"].map((name): TeacherUser => ({ id: randomUUID(), name, email: `${randomUUID()}@example.test`, role: "teacher" }));
    const [owner, other] = teachers;
    await prisma?.user.createMany({ data: teachers.map(({ id, name, email }) => ({ id, name, email, passwordHash: "synthetic" })) });
    const app = express();
    app.use(express.json());
    const before = process.env.SPEAKING_READ_ALOUD_ENABLED;
    const beforeIndependent = process.env.SPEAKING_PROVIDER_INDEPENDENT_ONLY;
    process.env.SPEAKING_READ_ALOUD_ENABLED = "true";
    process.env.SPEAKING_PROVIDER_INDEPENDENT_ONLY = "true";
    t.after(() => {
      if (before === undefined) delete process.env.SPEAKING_READ_ALOUD_ENABLED;
      else process.env.SPEAKING_READ_ALOUD_ENABLED = before;
      if (beforeIndependent === undefined) delete process.env.SPEAKING_PROVIDER_INDEPENDENT_ONLY;
      else process.env.SPEAKING_PROVIDER_INDEPENDENT_ONLY = beforeIndependent;
    });
    const providers = createSpeakingProviders({ SPEAKING_MOCK_MODE: "true" });
    const calls = [
      t.mock.method(providers.transcription, "transcribe"), t.mock.method(providers.conversation, "respond"),
      t.mock.method(providers.help, "hint"), t.mock.method(providers.evaluation, "evaluate")
    ];
    const register = (router: typeof app) => registerSpeakingRoutes(router, {
      requireTeacher(req: Request & { user?: TeacherUser }, res, next) {
        const teacher = teachers.find((item) => item.id === req.header("x-teacher"));
        if (!teacher) { res.sendStatus(401); return; }
        req.user = teacher;
        next();
      },
      id: randomUUID, now: () => new Date().toISOString(), providers, prisma
    });
    register(app);
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    t.after(() => { server.closeAllConnections(); server.close(); });
    let origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/speaking`;
    const send = async (path: string, status: number, headers: Record<string, string> = {}, body?: object, method = body ? "POST" : "GET") => {
      const response = await fetch(origin + path, { method, headers: { "content-type": "application/json", ...headers }, body: body && JSON.stringify(body) });
      const payload = await response.json();
      assert.equal(response.status, status, `${method} ${path} ${JSON.stringify(payload)}`);
      return payload;
    };
    const ownerHeaders = { "x-teacher": owner.id }, otherHeaders = { "x-teacher": other.id };
    const create = {
      title: "Original passage exercise", scenario: "Read the original text.", aiRole: "Partner", studentRole: "Student",
      level: "beginner", difficulty: "easy", nativeLanguage: "en", durationSeconds: 180, identifierMode: "anonymous",
      targetExpressions: [], rubric: [{ id: "communication", name: "Communication", description: "Share an idea.", enabled: true }]
    };
    const { activity } = await send("/activities", 201, ownerHeaders, create);
    const { activity: otherActivity } = await send("/activities", 201, otherHeaders, create);
    await send(`/activities/${activity.id}/sessions`, 503, ownerHeaders, {});
    const original = { grade: 1, textbook: "Original", edition: "Pilot", unit: "2", part: "A", text: "We stayed at home and made a paper map." };
    const catalog = { formatVersion: 1, passages: [original] };
    await send("/read-aloud/passages", 400, ownerHeaders, { catalog, authorized: false });
    const first = (await send("/read-aloud/passages", 201, ownerHeaders, { catalog, authorized: true })).passages[0];
    const same = (await send("/read-aloud/passages", 201, ownerHeaders, { catalog, authorized: true })).passages[0];
    assert.equal(same.id, first.id);
    assert.deepEqual((await send("/read-aloud/passages", 200, otherHeaders)).passages, []);
    await send(`/activities/${otherActivity.id}/sessions`, 404, otherHeaders, { readingPassageId: first.id });
    const { session } = await send(`/activities/${activity.id}/sessions`, 201, ownerHeaders, { readingPassageId: first.id });
    assert.equal(session.readingAssignment, undefined);
    const second = (await send("/read-aloud/passages", 201, ownerHeaders, { catalog: { ...catalog, passages: [{ ...original, text: "We made a new map." }] }, authorized: true })).passages[0];
    assert.equal(second.version, 2);
    const { participant, token } = await send("/join", 201, {}, { code: session.joinCode });
    const student = { "x-speaking-token": token };
    const sessionPath = `/sessions/${session.id}`;
    assert.equal((await send(sessionPath, 200, student)).session.readingAssignment.passage.text, original.text);
    await send(sessionPath, 401, otherHeaders);
    await send(sessionPath + "/start-session", 200, ownerHeaders, {});
    await send(sessionPath + "/finish", 409, student, {});
    await send(sessionPath + "/local-readiness", 200, student, { status: "ready" });
    await send(sessionPath + "/help", 403, student, {});
    await send(sessionPath + "/turn", 415, student, { text: original.text });
    const turnHeaders = { ...student, "content-type": SPEAKING_LOCAL_TRANSCRIPT_CONTENT_TYPE, "x-speaking-turn-id": "attempt-one" };
    const transcript = { text: "We stayed at home and made a map.", uncertain: false, durationMs: 60_000 };
    await send(sessionPath + "/turn", 400, turnHeaders, { ...transcript, durationMs: 91_000 });
    const pair = await send(sessionPath + "/turn", 200, turnHeaders, transcript);
    const duplicate = await send(sessionPath + "/turn", 200, turnHeaders, transcript);
    assert.equal(pair.studentTurn.id, duplicate.studentTurn.id);
    await send(sessionPath + "/turn", 409, { ...turnHeaders, "x-speaking-turn-id": "other-attempt" }, transcript);
    const finish = await fetch(origin + sessionPath + "/finish", { method: "POST", headers: student });
    assert.ok([200, 202].includes(finish.status), await finish.text());
    const resultPath = `/results/${participant.id}`;
    let provisional;
    for (let attempt = 0; attempt < 25 && !provisional; attempt++) {
      provisional = (await send(resultPath, 200, student)).result.evaluation;
      if (!provisional) await new Promise((resolve) => setTimeout(resolve, 40));
    }
    assert.ok(provisional);
    assert.equal(provisional.scores.pronunciation, null);
    assert.equal(provisional.assessmentEvidence.reading.passageVersion, 1);
    assert.equal(provisional.assessmentEvidence.reading.alignment.omissions, 1);
    assert.equal(provisional.assessmentEvidence.reading.durationMs, 60_000);
    const draft = { expectedRevision: 0, status: "confirmed", scores: { reading_accuracy: 3, pronunciation: null, fluency: null, expression: null }, comment: "Observed in class." };
    await send(resultPath, 403, otherHeaders);
    await send(resultPath + "/reading-review", 404, student, draft);
    await send(resultPath + "/reading-review", 404, otherHeaders, draft);
    const { review } = await send(resultPath + "/reading-review", 201, ownerHeaders, draft);
    await send(resultPath + "/reading-review", 409, ownerHeaders, draft);
    const submitted = (await send(resultPath, 200, student)).result;
    assert.equal(submitted.readingReview.status, "confirmed");
    assert.equal(submitted.readingReview.revision, 1);
    assert.deepEqual(submitted.evaluation, provisional);
    await send(resultPath + "/reading-review", 201, ownerHeaders, { ...draft, expectedRevision: review.revision, status: "reopened" });
    assert.equal((await send(resultPath + "/reading-review", 200, ownerHeaders)).reviews.length, 2);
    const summary = (await send(sessionPath + "/results", 200, ownerHeaders)).items[0];
    assert.equal(summary.readingReviewStatus, "reopened");
    assert.equal(summary.evaluation.assessmentEvidence, undefined);
    assert.ok(calls.every((call) => call.mock.callCount() === 0));

    if (prisma) {
      process.env.SPEAKING_READ_ALOUD_ENABLED = "false";
      const rollback = express();
      rollback.use(express.json());
      register(rollback);
      const restarted = rollback.listen(0, "127.0.0.1");
      await once(restarted, "listening");
      t.after(() => { restarted.closeAllConnections(); restarted.close(); });
      origin = `http://127.0.0.1:${(restarted.address() as AddressInfo).port}/api/speaking`;
      await send("/read-aloud/passages", 404, ownerHeaders);
      await send(`/activities/${activity.id}/sessions`, 503, ownerHeaders, { readingPassageId: first.id });
      assert.equal((await send(resultPath, 200, student)).result.readingReview.status, "reopened");
    }
  });
}
