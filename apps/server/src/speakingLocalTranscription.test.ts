import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import test from "node:test";
import express, { type Request } from "express";
import { SPEAKING_LOCAL_TRANSCRIPT_CONTENT_TYPE, type TeacherUser } from "@quizstrike/shared";
import { registerSpeakingRoutes } from "./routes/speakingRoutes.js";
import { createSpeakingProviders } from "./speakingProviders.js";

test("on-device turns require a pilot session and readiness, reuse retries, and skip audio transcription", async (t) => {
  const oldFlag = process.env.SPEAKING_LOCAL_TRANSCRIPTION_ENABLED;
  const oldPolicy = process.env.SPEAKING_LOCAL_TRANSCRIPTION_ALLOW_EXTERNAL_AI;
  process.env.SPEAKING_LOCAL_TRANSCRIPTION_ENABLED = "true";
  process.env.SPEAKING_LOCAL_TRANSCRIPTION_ALLOW_EXTERNAL_AI = "false";
  t.after(() => {
    if (oldFlag === undefined) delete process.env.SPEAKING_LOCAL_TRANSCRIPTION_ENABLED;
    else process.env.SPEAKING_LOCAL_TRANSCRIPTION_ENABLED = oldFlag;
    if (oldPolicy === undefined) delete process.env.SPEAKING_LOCAL_TRANSCRIPTION_ALLOW_EXTERNAL_AI;
    else process.env.SPEAKING_LOCAL_TRANSCRIPTION_ALLOW_EXTERNAL_AI = oldPolicy;
  });
  const app = express();
  app.use(express.json());
  const teacher: TeacherUser = { id: "owner", name: "Teacher", email: "owner@example.test", role: "teacher" };
  const providers = createSpeakingProviders({ SPEAKING_MOCK_MODE: "true" });
  const transcriber = t.mock.method(providers.transcription, "transcribe");
  const partner = t.mock.method(providers.conversation, "respond");
  registerSpeakingRoutes(app, {
    requireTeacher(req: Request & { user?: TeacherUser }, res, next) {
      if (req.header("x-teacher") !== teacher.id) { res.sendStatus(401); return; }
      req.user = teacher;
      next();
    },
    id: randomUUID,
    now: () => new Date().toISOString(),
    providers,
    allowTextInput: false,
    latencyDebug: true
  });
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const send = (path: string, options: RequestInit) => fetch(`${origin}/api/speaking/${path}`, options);
  const teacherPost = (path: string, body: object = {}) => send(path, {
    method: "POST", headers: { "x-teacher": "owner", "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
  const create = await teacherPost("activities", {
    title: "Reading conversation", scenario: "Discuss books.", aiRole: "Partner", studentRole: "Student", mode: "assessment",
    level: "beginner", difficulty: "easy", nativeLanguage: "en", durationSeconds: 120, identifierMode: "anonymous",
    targetExpressions: [],
    rubric: [{ id: "communication", name: "Communication", description: "Share a clear idea.", enabled: true }]
  });
  assert.equal(create.status, 201);
  const { activity } = await create.json();
  const launch = async (localTranscription: boolean) => {
    const response = await teacherPost(`activities/${activity.id}/sessions`, { localTranscription });
    assert.equal(response.status, 201);
    const { session } = await response.json();
    return session;
  };
  const pilot = await launch(true);
  const join = async (code: string) => {
    const response = await send("join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    assert.equal(response.status, 201);
    return response.json();
  };
  const { token, session } = await join(pilot.joinCode);
  assert.equal(session.localTranscription, true);
  const path = (suffix: string) => `sessions/${pilot.id}/${suffix}`;
  const localTurn = (sessionId: string, body: object, participantToken = token) => send(`sessions/${sessionId}/turn`, {
    method: "POST",
    headers: { "X-Speaking-Token": participantToken, "X-Speaking-Turn-Id": "client-turn-1", "Content-Type": SPEAKING_LOCAL_TRANSCRIPT_CONTENT_TYPE },
    body: JSON.stringify(body)
  });
  const studentPost = (suffix: string, body?: object) => send(path(suffix), {
    method: "POST", headers: { "X-Speaking-Token": token, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const transcript = { text: "I like reading books.", uncertain: false };
  assert.equal((await localTurn(pilot.id, transcript, "fake")).status, 401);
  assert.equal((await localTurn(pilot.id, transcript)).status, 409);
  assert.equal((await studentPost("start")).status, 409);
  assert.equal((await studentPost("local-readiness", { status: "anything" })).status, 400);
  assert.equal((await studentPost("local-readiness", { status: "downloading" })).status, 200);
  const roster = await send(path("roster"), { headers: { "x-teacher": "owner" } });
  assert.equal((await roster.json()).items[0].participant.localSpeechReadiness, "downloading");
  assert.equal((await studentPost("local-readiness", { status: "ready" })).status, 200);
  assert.equal((await teacherPost(path("start-session"))).status, 200);
  assert.equal((await studentPost("start")).status, 200);
  assert.equal((await send(path("turn"), {
    method: "POST", headers: { "X-Speaking-Token": token, "Content-Type": "audio/webm" }, body: "fake audio"
  })).status, 415);
  assert.equal((await studentPost("turn", { text: transcript.text })).status, 415);
  assert.equal((await localTurn(pilot.id, { ...transcript, confidence: 1 })).status, 400);
  assert.equal((await localTurn(pilot.id, { ...transcript, text: "a".repeat(1_201) })).status, 400);
  assert.equal((await localTurn(pilot.id, { ...transcript, text: "a".repeat(9_000) })).status, 413);
  const submitted = await localTurn(pilot.id, transcript);
  assert.equal(submitted.status, 200);
  const pair = await submitted.json();
  assert.equal(pair.studentTurn.text, transcript.text);
  assert.equal(pair.studentTurn.clientTranscribed, true);
  assert.equal(pair.studentTurn.transcriptionConfidence, undefined);
  assert.equal(pair.latency.audioBytes, 0);
  assert.equal(pair.latency.transcriptionAttempts, 0);
  const retry = await localTurn(pilot.id, { ...transcript, text: "A replacement answer." });
  assert.equal(retry.status, 200);
  const retriedPair = await retry.json();
  assert.equal(retriedPair.studentTurn.id, pair.studentTurn.id);
  assert.equal(retriedPair.studentTurn.text, transcript.text);
  assert.equal(retriedPair.aiTurn.id, pair.aiTurn.id);
  assert.equal(transcriber.mock.callCount(), 0);
  assert.equal(partner.mock.callCount(), 1);
  const standard = await launch(false);
  const standardJoin = await join(standard.joinCode);
  assert.equal((await localTurn(standard.id, transcript, standardJoin.token)).status, 415);
  assert.equal((await localTurn(standard.id, transcript)).status, 401);
});
