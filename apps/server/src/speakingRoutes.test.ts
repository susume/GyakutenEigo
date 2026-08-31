import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import express, { type NextFunction, type Request, type Response } from "express";
import type { TeacherUser } from "@quizstrike/shared";
import { createSpeakingProviders } from "./speakingProviders.js";
import { createSpeakingRouteState, registerSpeakingRoutes } from "./routes/speakingRoutes.js";

const teachers = new Map<string, TeacherUser>([
  ["owner", { id: "owner", name: "Owner", email: "owner@example.test", role: "teacher" }],
  ["other", { id: "other", name: "Other", email: "other@example.test", role: "teacher" }]
]);

const activityInput = {
  title: "Buying a T-shirt",
  scenario: "The student wants to buy a T-shirt in a clothing store.",
  aiRole: "Shop assistant",
  studentRole: "Customer",
  level: "elementary",
  difficulty: "normal",
  nativeLanguage: "ja",
  durationSeconds: 120,
  identifierMode: "nickname",
  targetExpressions: ["I'd like...", "How much is it?"],
  rubric: [
    { id: "communication", name: "Communication", description: "Communicates a clear idea.", enabled: true },
    { id: "grammar", name: "Grammar", description: "Uses understandable sentences.", enabled: false }
  ]
} as const;

type ApiOptions = {
  method?: string;
  teacher?: string;
  speakingToken?: string;
  body?: unknown;
  rawBody?: Uint8Array;
  contentType?: string;
  turnId?: string;
};

test("Speaking Practice uses one classroom session for multiple isolated participants", async () => {
  const app = express();
  app.use(express.json());
  const state = createSpeakingRouteState();
  let counter = 0;
  let receivedAudio: Buffer | undefined;
  const providers = createSpeakingProviders({ NODE_ENV: "test", SPEAKING_MOCK_MODE: "true" });
  let nowMs = Date.parse("2026-08-31T00:00:00.000Z");
  const requireTeacher = (req: Request & { user?: TeacherUser }, res: Response, next: NextFunction) => {
    const teacher = teachers.get(String(req.header("x-teacher") ?? ""));
    if (!teacher) {
      res.status(401).json({ error: "Teacher login required." });
      return;
    }
    req.user = teacher;
    next();
  };
  registerSpeakingRoutes(app, {
    requireTeacher,
    now: () => new Date(nowMs).toISOString(),
    id: () => `speaking-test-${++counter}`,
    state,
    providers,
    transcriber: {
      async transcribe(input) {
        if (input.mimeType === "audio/webm") {
          receivedAudio = Buffer.from(input.audio);
          return { text: "Can I try it on?", confidence: 0.91 };
        }
        return providers.transcription.transcribe(input);
      }
    },
    allowTextInput: true,
    sessionLifetimeSeconds: 10 * 60
  });

  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const api = async <T>(path: string, options: ApiOptions = {}) => {
    const headers = new Headers();
    if (options.teacher) headers.set("x-teacher", options.teacher);
    if (options.speakingToken) headers.set("x-speaking-token", options.speakingToken);
    if (options.turnId) headers.set("x-speaking-turn-id", options.turnId);
    if (options.rawBody) headers.set("content-type", options.contentType ?? "audio/webm");
    else if (options.body !== undefined) headers.set("content-type", options.contentType ?? "application/json");
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.rawBody === undefined
        ? (options.body === undefined ? undefined : JSON.stringify(options.body))
        : new Blob([options.rawBody as unknown as BlobPart], { type: options.contentType ?? "audio/webm" })
    });
    return { response, body: await response.json() as T };
  };

  try {
    const unauthenticated = await api("/api/speaking/activities");
    assert.equal(unauthenticated.response.status, 401);

    const created = await api<{ activity: { id: string; joinCode?: string; rubric: Array<{ id: string }> } }>("/api/speaking/activities", {
      method: "POST",
      teacher: "owner",
      body: activityInput
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.activity.joinCode, undefined);
    assert.deepEqual(created.body.activity.rubric.map((criterion) => criterion.id), ["communication"]);

    const privateRead = await api(`/api/speaking/activities/${created.body.activity.id}`, { teacher: "other" });
    assert.equal(privateRead.response.status, 404);

    const launched = await api<{ activity: { id: string }; session: { id: string; joinCode: string; status: string } }>(`/api/speaking/activities/${created.body.activity.id}/sessions`, {
      method: "POST",
      teacher: "owner"
    });
    assert.equal(launched.response.status, 201);
    assert.match(launched.body.session.joinCode, /^[A-Z2-9]{6}$/);
    assert.equal(launched.body.session.status, "ready");

    const waitingJoin = await api<{ token: string; session: { id: string }; participant: { id: string } }>("/api/speaking/join", {
      method: "POST",
      body: { code: launched.body.session.joinCode, identifier: "Aki" }
    });
    assert.equal(waitingJoin.response.status, 201);
    const waitingStart = await api(`/api/speaking/sessions/${waitingJoin.body.session.id}/start`, {
      method: "POST",
      speakingToken: waitingJoin.body.token
    });
    assert.equal(waitingStart.response.status, 409);
    const waitingFinish = await api(`/api/speaking/sessions/${waitingJoin.body.session.id}/finish`, {
      method: "POST",
      speakingToken: waitingJoin.body.token
    });
    assert.equal(waitingFinish.response.status, 409);

    const started = await api<{ session: { status: string } }>(`/api/speaking/sessions/${launched.body.session.id}/start-session`, { method: "POST", teacher: "owner" });
    assert.equal(started.response.status, 200);
    assert.equal(started.body.session.status, "active");

    const joined = [waitingJoin, ...(await Promise.all(["Beni", "Cleo"].map((identifier) => api<{ token: string; session: { id: string }; participant: { id: string } }>("/api/speaking/join", {
      method: "POST",
      body: { code: launched.body.session.joinCode, identifier }
    }))))];
    assert.equal(new Set(joined.map((item) => item.body.session.id)).size, 1);
    assert.equal(new Set(joined.map((item) => item.body.participant.id)).size, 3);
    assert.equal(new Set(joined.map((item) => item.body.token)).size, 3);

    for (const item of joined) {
      const participantStart = await api(`/api/speaking/sessions/${item.body.session.id}/start`, { method: "POST", speakingToken: item.body.token });
      assert.equal(participantStart.response.status, 200);
    }

    const help = await api<{ helpCount: number; english: string }>(`/api/speaking/sessions/${joined[1]!.body.session.id}/help`, { method: "POST", speakingToken: joined[1]!.body.token });
    assert.equal(help.response.status, 200);
    assert.equal(help.body.helpCount, 1);
    assert.ok(help.body.english);

    const firstTurn = await api<{ studentTurn: { id: string; participantId: string; usedHelp?: boolean }; aiTurn: { text: string } }>(`/api/speaking/sessions/${joined[0]!.body.session.id}/turn`, {
      method: "POST",
      speakingToken: joined[0]!.body.token,
      turnId: "aki-turn-1",
      body: { text: "I want a blue T-shirt." }
    });
    assert.equal(firstTurn.response.status, 200);
    assert.equal(firstTurn.body.studentTurn.participantId, joined[0]!.body.participant.id);
    assert.match(firstTurn.body.aiTurn.text, /size|looking/i);

    const secondTurn = await api<{ studentTurn: { participantId: string }; aiTurn: { text: string } }>(`/api/speaking/sessions/${joined[1]!.body.session.id}/turn`, {
      method: "POST",
      speakingToken: joined[1]!.body.token,
      body: { text: "Medium, please." }
    });
    assert.equal(secondTurn.response.status, 200);
    assert.equal(secondTurn.body.studentTurn.participantId, joined[1]!.body.participant.id);

    const thirdTurn = await api<{ studentTurn: { participantId: string } }>(`/api/speaking/sessions/${joined[2]!.body.session.id}/turn`, {
      method: "POST",
      speakingToken: joined[2]!.body.token,
      rawBody: new Uint8Array(Buffer.from("actual-audio-fixture")),
      contentType: "audio/webm"
    });
    assert.equal(thirdTurn.response.status, 200);
    assert.equal(thirdTurn.body.studentTurn.participantId, joined[2]!.body.participant.id);
    assert.deepEqual(receivedAudio, Buffer.from("actual-audio-fixture"));

    const duplicate = await api<{ studentTurn: { id: string } }>(`/api/speaking/sessions/${joined[0]!.body.session.id}/turn`, {
      method: "POST",
      speakingToken: joined[0]!.body.token,
      turnId: "aki-turn-1",
      body: { text: "This must not be appended twice." }
    });
    assert.equal(duplicate.response.status, 200);
    assert.equal(duplicate.body.studentTurn.id, firstTurn.body.studentTurn.id);

    const crossParticipantResult = await api(`/api/speaking/results/${joined[1]!.body.participant.id}`, { speakingToken: joined[0]!.body.token });
    assert.equal(crossParticipantResult.response.status, 403);

    const paused = await api(`/api/speaking/sessions/${launched.body.session.id}/pause`, { method: "POST", teacher: "owner" });
    assert.equal(paused.response.status, 200);
    const pausedTurn = await api(`/api/speaking/sessions/${joined[1]!.body.session.id}/turn`, { method: "POST", speakingToken: joined[1]!.body.token, body: { text: "Not during pause." } });
    assert.equal(pausedTurn.response.status, 409);
    const resumed = await api(`/api/speaking/sessions/${launched.body.session.id}/resume`, { method: "POST", teacher: "owner" });
    assert.equal(resumed.response.status, 200);
    const resumedTurn = await api(`/api/speaking/sessions/${joined[1]!.body.session.id}/turn`, { method: "POST", speakingToken: joined[1]!.body.token, body: { text: "I would like to try it on." } });
    assert.equal(resumedTurn.response.status, 200);

    nowMs += 121_000;
    const expiredParticipantTurn = await api(`/api/speaking/sessions/${joined[0]!.body.session.id}/turn`, { method: "POST", speakingToken: joined[0]!.body.token, body: { text: "After my time." } });
    assert.equal(expiredParticipantTurn.response.status, 409);

    const finishedA = await api<{ result: { participant: { id: string }; evaluation?: { scores: Record<string, number> } } }>(`/api/speaking/sessions/${joined[0]!.body.session.id}/finish`, { method: "POST", speakingToken: joined[0]!.body.token });
    const finishedB = await api<{ result: { participant: { id: string }; evaluation?: { scores: Record<string, number> } } }>(`/api/speaking/sessions/${joined[1]!.body.session.id}/finish`, { method: "POST", speakingToken: joined[1]!.body.token });
    assert.equal(finishedA.response.status, 200);
    assert.equal(finishedB.response.status, 200);
    assert.equal(finishedA.body.result.participant.id, joined[0]!.body.participant.id);
    assert.equal(finishedA.body.result.evaluation?.scores.grammar, undefined);

    const results = await api<{ items: Array<{ participant: { id: string }; overallScore?: number; evaluation?: unknown }> }>(`/api/speaking/activities/${created.body.activity.id}/results?sessionId=${encodeURIComponent(launched.body.session.id)}`, { teacher: "owner" });
    assert.equal(results.response.status, 200);
    assert.equal(results.body.items.length, 3);
    assert.equal(results.body.items.filter((item) => item.evaluation).length, 2);
    assert.equal(results.body.items.filter((item) => !item.evaluation).length, 1);

    const ownerResult = await api<{ result: { participant: { displayIdentifier?: string }; evaluation?: unknown } }>(`/api/speaking/results/${joined[0]!.body.participant.id}`, { teacher: "owner" });
    assert.equal(ownerResult.response.status, 200);
    assert.equal(ownerResult.body.result.participant.displayIdentifier, "Aki");
    assert.ok(ownerResult.body.result.evaluation);
    const otherResult = await api(`/api/speaking/results/${joined[0]!.body.participant.id}`, { teacher: "other" });
    assert.equal(otherResult.response.status, 403);

    const ended = await api(`/api/speaking/sessions/${launched.body.session.id}/end`, { method: "POST", teacher: "owner" });
    assert.equal(ended.response.status, 200);
    const newJoinAfterEnd = await api(`/api/speaking/join`, { method: "POST", body: { code: launched.body.session.joinCode, identifier: "Dara" } });
    assert.equal(newJoinAfterEnd.response.status, 404);

    const relaunched = await api<{ session: { id: string; joinCode: string } }>(`/api/speaking/activities/${created.body.activity.id}/sessions`, { method: "POST", teacher: "owner" });
    assert.equal(relaunched.response.status, 201);
    assert.notEqual(relaunched.body.session.joinCode, launched.body.session.joinCode);

    nowMs = Date.parse("2026-08-31T00:00:00.000Z") + 13 * 60_000;
    const expiredJoin = await api(`/api/speaking/join`, { method: "POST", body: { code: relaunched.body.session.joinCode, identifier: "Eri" } });
    assert.equal(expiredJoin.response.status, 404);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
