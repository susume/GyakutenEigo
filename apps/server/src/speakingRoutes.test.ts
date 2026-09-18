import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import express, { type NextFunction, type Request, type Response } from "express";
import { SPEAKING_CORE_LIBRARY, SPEAKING_LIMITS, speakingRemainingSeconds, type SpeakingEvaluation, type TeacherUser } from "@quizstrike/shared";
import { createSpeakingProviders, parseJsonResponse } from "./speakingProviders.js";
import { SpeakingProviderError } from "./speakingProviders.js";
import { createSpeakingRouteState, registerSpeakingRoutes } from "./routes/speakingRoutes.js";
import { speakingGoalRequirements } from "./speakingEvaluation.js";

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
  mode: "practice",
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
  speechDetected?: boolean;
  audioDurationMs?: number;
};

test("Speaking Practice uses one classroom session for multiple isolated participants", async () => {
  const app = express();
  app.use(express.json());
  const state = createSpeakingRouteState();
  let counter = 0;
  let receivedAudio: Buffer | undefined;
  const providers = createSpeakingProviders({ NODE_ENV: "test", SPEAKING_MOCK_MODE: "true" });
  let recoveryConversationAttempts = 0;
  const conversationTurnSnapshots: Array<Array<{ speaker: string; text: string }>> = [];
  let signalDelayedTranscriptionStarted!: () => void;
  let releaseDelayedTranscription!: () => void;
  const delayedTranscriptionStarted = new Promise<void>((resolve) => { signalDelayedTranscriptionStarted = resolve; });
  const delayedTranscriptionRelease = new Promise<void>((resolve) => { releaseDelayedTranscription = resolve; });
  let evaluationCalls = 0;
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
    conversationProvider: {
      async respond(input) {
        conversationTurnSnapshots.push(input.turns.map((turn) => ({ speaker: turn.speaker, text: turn.text })));
        if (input.studentText === "Please recover this turn." && recoveryConversationAttempts++ === 0) throw new Error("Simulated provider outage");
        return providers.conversation.respond(input);
      }
    },
    transcriber: {
      async transcribe(input) {
        if (input.text === "Wait while the teacher pauses.") {
          signalDelayedTranscriptionStarted();
          await delayedTranscriptionRelease;
          return { text: input.text, confidence: 1 };
        }
        if (input.mimeType === "audio/webm") {
          receivedAudio = Buffer.from(input.audio);
          if (input.speechDetected === false) return { text: "", confidence: 0 };
          return { text: "Can I try it on?", confidence: 0.91 };
        }
        return providers.transcription.transcribe(input);
      }
    },
    evaluationProvider: {
      async evaluate(input) {
        evaluationCalls += 1;
        return providers.evaluation.evaluate(input);
      }
    },
    allowTextInput: true,
    sessionLifetimeSeconds: 10 * 60,
    latencyDebug: true
  });
  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
    if (status === 413) {
      res.status(413).json({ error: "That recording is too large. Please record a shorter answer." });
      return;
    }
    next(error);
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
    if (options.speechDetected !== undefined) headers.set("x-speaking-audio-activity", String(options.speechDetected));
    if (options.audioDurationMs !== undefined) headers.set("x-speaking-audio-duration-ms", String(options.audioDurationMs));
    if (options.rawBody) headers.set("content-type", options.contentType ?? "audio/webm");
    else if (options.body !== undefined) headers.set("content-type", options.contentType ?? "application/json");
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.rawBody === undefined
        ? (options.body === undefined ? undefined : JSON.stringify(options.body))
        : new Blob([options.rawBody as unknown as BlobPart], { type: options.contentType ?? "audio/webm" })
    });
    const responseText = await response.text();
    let body = {} as T;
    try { body = responseText ? JSON.parse(responseText) as T : body; } catch { /* Express's default 413 page is HTML. */ }
    return { response, body };
  };

  try {
    const unauthenticated = await api("/api/speaking/activities");
    assert.equal(unauthenticated.response.status, 401);

    const created = await api<{ activity: { id: string; joinCode?: string; mode: string; supportSettings: { allowHelp: boolean }; rubric: Array<{ id: string }> } }>("/api/speaking/activities", {
      method: "POST",
      teacher: "owner",
      body: activityInput
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.activity.joinCode, undefined);
    assert.deepEqual(created.body.activity.rubric.map((criterion) => criterion.id), ["communication", "grammar"]);
    assert.equal(created.body.activity.mode, "practice");
    assert.equal(created.body.activity.supportSettings.allowHelp, true);
    const duplicateRubric = await api("/api/speaking/activities", {
      method: "POST",
      teacher: "owner",
      body: { ...activityInput, rubric: [activityInput.rubric[0], activityInput.rubric[0]] }
    });
    assert.equal(duplicateRubric.response.status, 400);

    const privateRead = await api(`/api/speaking/activities/${created.body.activity.id}`, { teacher: "other" });
    assert.equal(privateRead.response.status, 404);
    const forbiddenEdit = await api(`/api/speaking/activities/${created.body.activity.id}`, { method: "PATCH", teacher: "other", body: activityInput });
    assert.equal(forbiddenEdit.response.status, 404);
    const edited = await api<{ activity: { id: string; difficulty: string; targetExpressions: string[] } }>(`/api/speaking/activities/${created.body.activity.id}`, {
      method: "PATCH",
      teacher: "owner",
      body: { ...activityInput, difficulty: "challenge", targetExpressions: ["I'd like the blue one."] }
    });
    assert.equal(edited.response.status, 200);
    assert.equal(edited.body.activity.difficulty, "challenge");
    assert.deepEqual(edited.body.activity.targetExpressions, ["I'd like the blue one."]);

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

    const restrictedActivity = await api<{ activity: { id: string } }>("/api/speaking/activities", {
      method: "POST",
      teacher: "owner",
      body: {
        ...activityInput,
        title: "Assessment without live help",
        mode: "assessment",
        supportSettings: { showTargetExpressions: true, showContext: true, showTranscript: false, allowReplay: false, allowHelp: false }
      }
    });
    const restrictedLaunch = await api<{ session: { id: string; joinCode: string } }>(`/api/speaking/activities/${restrictedActivity.body.activity.id}/sessions`, { method: "POST", teacher: "owner" });
    const restrictedJoin = await api<{ token: string; session: { id: string } }>("/api/speaking/join", { method: "POST", body: { code: restrictedLaunch.body.session.joinCode, identifier: "Restricted" } });
    assert.equal((await api(`/api/speaking/sessions/${restrictedLaunch.body.session.id}/start-session`, { method: "POST", teacher: "owner" })).response.status, 200);
    assert.equal((await api(`/api/speaking/sessions/${restrictedJoin.body.session.id}/start`, { method: "POST", speakingToken: restrictedJoin.body.token })).response.status, 200);
    const restrictedHelp = await api<{ code: string; error: string }>(`/api/speaking/sessions/${restrictedJoin.body.session.id}/help`, { method: "POST", speakingToken: restrictedJoin.body.token });
    assert.equal(restrictedHelp.response.status, 403);
    assert.equal(restrictedHelp.body.code, "SPEAKING_HELP_DISABLED");

    const firstTurn = await api<{ studentTurn: { id: string; participantId: string; usedHelp?: boolean }; aiTurn: { text: string }; latency: { audioBytes: number; requestParsingMs: number; transcriptionMs: number; studentPersistenceMs: number; promptPreparationMs: number; conversationMs: number; aiPersistenceMs: number; totalMs: number } }>(`/api/speaking/sessions/${joined[0]!.body.session.id}/turn`, {
      method: "POST",
      speakingToken: joined[0]!.body.token,
      turnId: "aki-turn-1",
      body: { text: "I want a blue T-shirt." }
    });
    assert.equal(firstTurn.response.status, 200);
    assert.equal(firstTurn.body.studentTurn.participantId, joined[0]!.body.participant.id);
    assert.match(firstTurn.body.aiTurn.text, /size|looking/i);
    for (const key of ["audioBytes", "requestParsingMs", "transcriptionMs", "studentPersistenceMs", "promptPreparationMs", "conversationMs", "aiPersistenceMs", "totalMs"] as const) {
      assert.equal(typeof firstTurn.body.latency[key], "number");
    }
    assert.ok(firstTurn.body.latency.totalMs >= firstTurn.body.latency.transcriptionMs);
    assert.deepEqual(conversationTurnSnapshots[0]?.map((turn) => turn.speaker), ["ai", "student"]);
    assert.equal(conversationTurnSnapshots[0]?.at(-1)?.text, "I want a blue T-shirt.");

    const secondTurn = await api<{ studentTurn: { participantId: string }; aiTurn: { text: string } }>(`/api/speaking/sessions/${joined[1]!.body.session.id}/turn`, {
      method: "POST",
      speakingToken: joined[1]!.body.token,
      rawBody: new Uint8Array(Buffer.from("actual-audio-fixture")),
      contentType: "audio/webm",
      speechDetected: true
    });
    assert.equal(secondTurn.response.status, 200);
    assert.equal(secondTurn.body.studentTurn.participantId, joined[1]!.body.participant.id);
    assert.deepEqual(receivedAudio, Buffer.from("actual-audio-fixture"));
    const unsupportedFormat = await api(`/api/speaking/sessions/${joined[1]!.body.session.id}/turn`, {
      method: "POST",
      speakingToken: joined[1]!.body.token,
      rawBody: new Uint8Array(Buffer.from("unsupported-audio")),
      contentType: "audio/aac"
    });
    assert.equal(unsupportedFormat.response.status, 415);
    const oversized = await api(`/api/speaking/sessions/${joined[1]!.body.session.id}/turn`, {
      method: "POST",
      speakingToken: joined[1]!.body.token,
      rawBody: new Uint8Array(SPEAKING_LIMITS.maxAudioBytes + 1),
      contentType: "audio/webm"
    });
    assert.equal(oversized.response.status, 413);
    const fractionalDuration = await api(`/api/speaking/sessions/${joined[1]!.body.session.id}/turn`, {
      method: "POST",
      speakingToken: joined[1]!.body.token,
      rawBody: new Uint8Array(Buffer.from("actual-audio-fixture")),
      contentType: "audio/webm",
      speechDetected: true,
      audioDurationMs: 1_200.5
    });
    assert.equal(fractionalDuration.response.status, 400);

    const silentTurn = await api(`/api/speaking/sessions/${joined[2]!.body.session.id}/turn`, {
      method: "POST",
      speakingToken: joined[2]!.body.token,
      rawBody: new Uint8Array(Buffer.from("container-only-silence")),
      contentType: "audio/webm",
      speechDetected: false
    });
    assert.equal(silentTurn.response.status, 422);

    const duplicate = await api<{ studentTurn: { id: string } }>(`/api/speaking/sessions/${joined[0]!.body.session.id}/turn`, {
      method: "POST",
      speakingToken: joined[0]!.body.token,
      turnId: "aki-turn-1",
      body: { text: "This must not be appended twice." }
    });
    assert.equal(duplicate.response.status, 200);
    assert.equal(duplicate.body.studentTurn.id, firstTurn.body.studentTurn.id);

    const failedRecoveryTurn = await api(`/api/speaking/sessions/${joined[0]!.body.session.id}/turn`, {
      method: "POST",
      speakingToken: joined[0]!.body.token,
      turnId: "aki-recovery-turn",
      body: { text: "Please recover this turn." }
    });
    assert.equal(failedRecoveryTurn.response.status, 503);
    const afterFailedRecovery = await api<{ turns: Array<{ id: string; requestId?: string; speaker: string }> }>(`/api/speaking/sessions/${joined[0]!.body.session.id}`, { speakingToken: joined[0]!.body.token });
    const savedRecoveryTurn = afterFailedRecovery.body.turns.find((turn) => turn.requestId === "aki-recovery-turn");
    assert.ok(savedRecoveryTurn);

    const crossParticipantResult = await api(`/api/speaking/results/${joined[1]!.body.participant.id}`, { speakingToken: joined[0]!.body.token });
    assert.equal(crossParticipantResult.response.status, 403);

    const delayedTurnPromise = api(`/api/speaking/sessions/${joined[1]!.body.session.id}/turn`, {
      method: "POST",
      speakingToken: joined[1]!.body.token,
      turnId: "beni-delayed-turn",
      body: { text: "Wait while the teacher pauses." }
    });
    await delayedTranscriptionStarted;
    const paused = await api(`/api/speaking/sessions/${launched.body.session.id}/pause`, { method: "POST", teacher: "owner" });
    assert.equal(paused.response.status, 200);
    releaseDelayedTranscription();
    const delayedTurn = await delayedTurnPromise;
    assert.equal(delayedTurn.response.status, 409);
    const pausedTurn = await api(`/api/speaking/sessions/${joined[1]!.body.session.id}/turn`, { method: "POST", speakingToken: joined[1]!.body.token, body: { text: "Not during pause." } });
    assert.equal(pausedTurn.response.status, 409);
    const recoveredWhilePaused = await api<{ studentTurn: { id: string }; aiTurn: { id: string }; session: { status: string } }>(`/api/speaking/sessions/${joined[0]!.body.session.id}/turn`, {
      method: "POST",
      speakingToken: joined[0]!.body.token,
      turnId: "aki-recovery-turn",
      body: { text: "This retry body must not create another student turn." }
    });
    assert.equal(recoveredWhilePaused.response.status, 200);
    assert.equal(recoveredWhilePaused.body.studentTurn.id, savedRecoveryTurn!.id);
    assert.equal(recoveredWhilePaused.body.session.status, "paused");
    const afterRecovery = await api<{ turns: Array<{ requestId?: string }> }>(`/api/speaking/sessions/${joined[0]!.body.session.id}`, { speakingToken: joined[0]!.body.token });
    assert.equal(afterRecovery.body.turns.filter((turn) => turn.requestId === "aki-recovery-turn").length, 1);
    const resumed = await api(`/api/speaking/sessions/${launched.body.session.id}/resume`, { method: "POST", teacher: "owner" });
    assert.equal(resumed.response.status, 200);
    const resumedTurn = await api(`/api/speaking/sessions/${joined[1]!.body.session.id}/turn`, { method: "POST", speakingToken: joined[1]!.body.token, body: { text: "I would like to try it on." } });
    assert.equal(resumedTurn.response.status, 200);

    nowMs += 121_000;
    const expiredParticipantTurn = await api(`/api/speaking/sessions/${joined[0]!.body.session.id}/turn`, { method: "POST", speakingToken: joined[0]!.body.token, body: { text: "After my time." } });
    assert.equal(expiredParticipantTurn.response.status, 409);

    const finishedA = await api<{ result: { participant: { id: string }; evaluation?: { scores: Record<string, number | null> } } }>(`/api/speaking/sessions/${joined[0]!.body.session.id}/finish`, { method: "POST", speakingToken: joined[0]!.body.token });
    const finishedB = await api<{ result: { participant: { id: string }; evaluation?: { scores: Record<string, number | null> } } }>(`/api/speaking/sessions/${joined[1]!.body.session.id}/finish`, { method: "POST", speakingToken: joined[1]!.body.token });
    const finishedSilent = await api<{ result: { participant: { id: string }; evaluation?: { assessmentStatus: string; scores: Record<string, number | null> } } }>(`/api/speaking/sessions/${joined[2]!.body.session.id}/finish`, { method: "POST", speakingToken: joined[2]!.body.token });
    assert.equal(finishedA.response.status, 200);
    assert.equal(finishedB.response.status, 200);
    assert.equal(finishedA.body.result.participant.id, joined[0]!.body.participant.id);
    assert.equal(finishedA.body.result.evaluation?.scores.grammar, undefined);
    assert.equal(finishedSilent.response.status, 200);
    assert.equal(finishedSilent.body.result.evaluation?.assessmentStatus, "insufficient_evidence");
    assert.equal(finishedSilent.body.result.evaluation?.scores.communication, null);
    assert.equal(evaluationCalls, 2);

    const results = await api<{ items: Array<{ participant: { id: string }; overallScore?: number; evaluation?: unknown }> }>(`/api/speaking/activities/${created.body.activity.id}/results?sessionId=${encodeURIComponent(launched.body.session.id)}`, { teacher: "owner" });
    assert.equal(results.response.status, 200);
    assert.equal(results.body.items.length, 3);
    assert.equal(results.body.items.filter((item) => item.evaluation).length, 3);
    assert.equal(results.body.items.filter((item) => !item.evaluation).length, 0);

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

test("transcription retries one transient failure with the same audio and never duplicates turns", async () => {
  const app = express();
  app.use(express.json());
  const state = createSpeakingRouteState();
  const providers = createSpeakingProviders({ NODE_ENV: "test", SPEAKING_MOCK_MODE: "true" });
  let counter = 0;
  const nowMs = Date.parse("2026-09-13T00:00:00.000Z");
  const attemptsByRequest = new Map<string, number>();
  const audioByRequest = new Map<string, Buffer[]>();
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
    id: () => `transcription-retry-${++counter}`,
    state,
    providers,
    transcriber: {
      async transcribe(input) {
        const requestId = input.requestId ?? "missing-request-id";
        const attempt = (attemptsByRequest.get(requestId) ?? 0) + 1;
        attemptsByRequest.set(requestId, attempt);
        const recordings = audioByRequest.get(requestId) ?? [];
        recordings.push(Buffer.from(input.audio));
        audioByRequest.set(requestId, recordings);
        if (requestId === "recover-turn" && attempt === 1) throw new SpeakingProviderError("temporary timeout", "timeout", 408);
        if (requestId === "fail-turn") throw new SpeakingProviderError("temporary timeout", "timeout", 408);
        return { text: "I would like the blue one.", confidence: 0.9 };
      }
    },
    allowTextInput: true,
    latencyDebug: true,
    random: () => 0
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
    if (options.speechDetected !== undefined) headers.set("x-speaking-audio-activity", String(options.speechDetected));
    if (options.rawBody) headers.set("content-type", options.contentType ?? "audio/webm");
    else if (options.body !== undefined) headers.set("content-type", options.contentType ?? "application/json");
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.rawBody === undefined ? (options.body === undefined ? undefined : JSON.stringify(options.body)) : new Blob([options.rawBody as unknown as BlobPart], { type: options.contentType ?? "audio/webm" })
    });
    const text = await response.text();
    return { response, body: (text ? JSON.parse(text) : {}) as T };
  };
  try {
    const created = await api<{ activity: { id: string } }>("/api/speaking/activities", { method: "POST", teacher: "owner", body: activityInput });
    const launched = await api<{ session: { id: string; joinCode: string } }>(`/api/speaking/activities/${created.body.activity.id}/sessions`, { method: "POST", teacher: "owner" });
    await api(`/api/speaking/sessions/${launched.body.session.id}/start-session`, { method: "POST", teacher: "owner" });
    const joined = await api<{ token: string; participant: { id: string } }>("/api/speaking/join", { method: "POST", body: { code: launched.body.session.joinCode, identifier: "Retry student" } });
    await api(`/api/speaking/sessions/${launched.body.session.id}/start`, { method: "POST", speakingToken: joined.body.token });
    const audio = new Uint8Array(Buffer.from("same-audio-fixture"));
    const recovered = await api<{ studentTurn: { id: string }; aiTurn: { id: string }; latency: { transcriptionAttempts: number; transcriptionRetryUsed: boolean; transcriptionRetrySucceeded: boolean } }>(`/api/speaking/sessions/${launched.body.session.id}/turn`, { method: "POST", speakingToken: joined.body.token, turnId: "recover-turn", rawBody: audio, contentType: "audio/webm", speechDetected: true });
    assert.equal(recovered.response.status, 200);
    assert.equal(recovered.body.latency.transcriptionAttempts, 2);
    assert.equal(recovered.body.latency.transcriptionRetryUsed, true);
    assert.equal(recovered.body.latency.transcriptionRetrySucceeded, true);
    assert.equal(attemptsByRequest.get("recover-turn"), 2);
    assert.deepEqual(audioByRequest.get("recover-turn"), [Buffer.from(audio), Buffer.from(audio)]);
    const afterRecovery = await api<{ turns: Array<{ speaker: string; requestId?: string }> }>(`/api/speaking/sessions/${launched.body.session.id}`, { speakingToken: joined.body.token });
    assert.equal(afterRecovery.body.turns.filter((turn) => turn.requestId === "recover-turn").length, 1);
    assert.equal(afterRecovery.body.turns.filter((turn) => turn.requestId === "recover-turn:ai").length, 1);

    const failed = await api<{ error: string; latency?: { transcriptionAttempts: number; transcriptionRetryUsed: boolean } }>(`/api/speaking/sessions/${launched.body.session.id}/turn`, { method: "POST", speakingToken: joined.body.token, turnId: "fail-turn", rawBody: audio, contentType: "audio/webm", speechDetected: true });
    assert.equal(failed.response.status, 503);
    assert.match(failed.body.error, /taking longer than expected|recording is saved/i);
    assert.equal(attemptsByRequest.get("fail-turn"), 2);
    const failedRetry = await api<{ error: string }>(`/api/speaking/sessions/${launched.body.session.id}/turn`, { method: "POST", speakingToken: joined.body.token, turnId: "fail-turn", rawBody: audio, contentType: "audio/webm", speechDetected: true });
    assert.equal(failedRetry.response.status, 503);
    assert.equal(attemptsByRequest.get("fail-turn"), 4);
    const afterFailure = await api<{ turns: Array<{ requestId?: string }> }>(`/api/speaking/sessions/${launched.body.session.id}`, { speakingToken: joined.body.token });
    assert.equal(afterFailure.body.turns.filter((turn) => turn.requestId === "fail-turn" || turn.requestId === "fail-turn:ai").length, 0);
    const diagnostics = await api<{ transcription: { firstAttemptSuccessRate: number; retryRecoveryRate: number; timeoutRate: number; latencyMs: { p50: number; p95: number } } }>("/api/speaking/diagnostics/evaluations", { teacher: "owner" });
    assert.equal(diagnostics.response.status, 200);
    assert.equal(diagnostics.body.transcription.firstAttemptSuccessRate, 0);
    assert.equal(diagnostics.body.transcription.retryRecoveryRate, 1 / 3);
    assert.ok(diagnostics.body.transcription.timeoutRate > 0);
    assert.ok(diagnostics.body.transcription.latencyMs.p95 >= diagnostics.body.transcription.latencyMs.p50);
    assert.equal(JSON.stringify(diagnostics.body).includes("recover-turn"), false);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

for (const failure of [
  new SpeakingProviderError("temporary timeout", "timeout"),
  new SpeakingProviderError("request timeout", "timeout", 408),
  new SpeakingProviderError("rate limit", "rate_limit", 429),
  new SpeakingProviderError("server failure", "unavailable", 500),
  new SpeakingProviderError("overloaded", "unavailable", 503),
  new SpeakingProviderError("network failure", "network"),
  new SpeakingProviderError("malformed JSON", "invalid_response"),
  new SpeakingProviderError("bad credentials", "authentication", 401),
  new SpeakingProviderError("invalid model", "bad_request", 404)
]) test(`evaluation recovery handles ${failure.failureKind} ${failure.status ?? ""}`, async () => {
  const app = express();
  app.use(express.json());
  const state = createSpeakingRouteState();
  const providers = createSpeakingProviders({ NODE_ENV: "test", SPEAKING_MOCK_MODE: "true" });
  let counter = 0;
  let evaluationCalls = 0;
  let nowMs = Date.parse("2026-09-12T00:00:00.000Z");
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
    id: () => `retry-route-${++counter}`,
    state,
    providers,
    evaluationProvider: {
      async evaluate(input) {
        evaluationCalls += 1;
        if (evaluationCalls === 1) throw failure;
        return providers.evaluation.evaluate(input);
      }
    },
    allowTextInput: true,
    random: () => 0.5
  });
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const api = async <T>(path: string, options: ApiOptions = {}) => {
    const headers = new Headers();
    if (options.teacher) headers.set("x-teacher", options.teacher);
    if (options.speakingToken) headers.set("x-speaking-token", options.speakingToken);
    if (options.body !== undefined) headers.set("content-type", "application/json");
    const response = await fetch(`${baseUrl}${path}`, { method: options.method ?? "GET", headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
    const text = await response.text();
    return { response, body: (text ? JSON.parse(text) : {}) as T };
  };
  try {
    const created = await api<{ activity: { id: string } }>("/api/speaking/activities", { method: "POST", teacher: "owner", body: activityInput });
    const launched = await api<{ session: { id: string; joinCode: string } }>(`/api/speaking/activities/${created.body.activity.id}/sessions`, { method: "POST", teacher: "owner" });
    await api(`/api/speaking/sessions/${launched.body.session.id}/start-session`, { method: "POST", teacher: "owner" });
    const joined = await api<{ token: string; session: { id: string }; participant: { id: string } }>("/api/speaking/join", { method: "POST", body: { code: launched.body.session.joinCode, identifier: "Retry student" } });
    await api(`/api/speaking/sessions/${joined.body.session.id}/start`, { method: "POST", speakingToken: joined.body.token });
    await api(`/api/speaking/sessions/${joined.body.session.id}/turn`, { method: "POST", speakingToken: joined.body.token, body: { text: "I want a blue shirt." } });
    const firstFinish = await api<{ evaluationStatus?: string; evaluationRetryable?: boolean; nextRetryAt?: string }>(`/api/speaking/sessions/${joined.body.session.id}/finish`, { method: "POST", speakingToken: joined.body.token });
    assert.equal(firstFinish.response.status, 202);
    if (failure.failureKind === "authentication" || failure.failureKind === "bad_request") {
      assert.equal(firstFinish.body.evaluationStatus, "failed");
      assert.equal(firstFinish.body.evaluationRetryable, false);
      nowMs += 600_000;
      await api(`/api/speaking/sessions/${joined.body.session.id}/finish`, { method: "POST", speakingToken: joined.body.token });
      await api(`/api/speaking/results/${joined.body.participant.id}`, { speakingToken: joined.body.token });
      assert.equal(evaluationCalls, 1);
      return;
    }
    assert.equal(firstFinish.body.evaluationStatus, "retrying");
    assert.equal(firstFinish.body.evaluationRetryable, true);
    assert.ok(firstFinish.body.nextRetryAt);
    await Promise.all([
      api(`/api/speaking/results/${joined.body.participant.id}`, { speakingToken: joined.body.token }),
      api(`/api/speaking/sessions/${joined.body.session.id}/finish`, { method: "POST", speakingToken: joined.body.token })
    ]);
    assert.equal(evaluationCalls, 1, "manual retry must respect durable backoff");

    nowMs = Date.parse(firstFinish.body.nextRetryAt!);
    let recovered: { evaluation?: unknown; participant: { status: string } } | undefined;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const next = await api<{ result: { evaluation?: unknown; participant: { status: string } }; evaluationStatus?: string }>(`/api/speaking/results/${joined.body.participant.id}`, { speakingToken: joined.body.token });
      recovered = next.body.result;
      if (recovered.evaluation) break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.ok(recovered?.evaluation);
    assert.equal(recovered?.participant.status, "completed");
    assert.equal(evaluationCalls, 2);
    const diagnostics = await api<{ metrics: { attempts: number; successes: number; retriesScheduled: number; failuresByKind: Record<string, number>; promptChars: { p50?: number }; responseChars: { p50?: number }; queueWaitMs: { p95?: number } } }>("/api/speaking/diagnostics/evaluations", { teacher: "owner" });
    assert.equal(diagnostics.response.status, 200);
    assert.equal(diagnostics.body.metrics.attempts, 2);
    assert.equal(diagnostics.body.metrics.successes, 1);
    assert.equal(diagnostics.body.metrics.retriesScheduled, 1);
    assert.equal(diagnostics.body.metrics.failuresByKind[failure.failureKind], 1);
    assert.ok((diagnostics.body.metrics.promptChars.p50 ?? 0) > 0);
    assert.ok((diagnostics.body.metrics.responseChars.p50 ?? 0) > 0);
    assert.ok((diagnostics.body.metrics.queueWaitMs.p95 ?? Infinity) < 1_000, "retry backoff must not be reported as provider queue delay");
  } finally {
    app.emit("speaking:shutdown");
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("teacher pauses freeze active speaking time and pause-to-end accounts the final interval", async () => {
  const app = express();
  app.use(express.json());
  const state = createSpeakingRouteState();
  let counter = 0;
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
    id: () => `speaking-time-test-${++counter}`,
    state,
    providers: createSpeakingProviders({ NODE_ENV: "test", SPEAKING_MOCK_MODE: "true" }),
    allowTextInput: true,
    sessionLifetimeSeconds: 10 * 60
  });

  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const api = async <T>(path: string, options: { method?: string; teacher?: string; speakingToken?: string; body?: unknown } = {}) => {
    const headers = new Headers();
    if (options.teacher) headers.set("x-teacher", options.teacher);
    if (options.speakingToken) headers.set("x-speaking-token", options.speakingToken);
    if (options.body !== undefined) headers.set("content-type", "application/json");
    const response = await fetch(`${baseUrl}${path}`, { method: options.method ?? "GET", headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
    const responseText = await response.text();
    let body = {} as T;
    try { body = responseText ? JSON.parse(responseText) as T : body; } catch { /* Express's default 413 page is HTML. */ }
    return { response, body };
  };

  try {
    const created = await api<{ activity: { id: string } }>("/api/speaking/activities", { method: "POST", teacher: "owner", body: activityInput });
    const launched = await api<{ session: { id: string; joinCode: string } }>(`/api/speaking/activities/${created.body.activity.id}/sessions`, { method: "POST", teacher: "owner" });
    const joined = await api<{ token: string; participant: { id: string }; session: { id: string } }>("/api/speaking/join", { method: "POST", body: { code: launched.body.session.joinCode, identifier: "Aki" } });
    await api(`/api/speaking/sessions/${launched.body.session.id}/start-session`, { method: "POST", teacher: "owner" });
    await api(`/api/speaking/sessions/${joined.body.session.id}/start`, { method: "POST", speakingToken: joined.body.token });

    nowMs += 60_000;
    const paused = await api<{ session: { status: "paused"; pausedAt?: string }; participant: { startedAt?: string; pausedDurationMs: number } }>(`/api/speaking/sessions/${launched.body.session.id}/pause`, { method: "POST", teacher: "owner" });
    assert.equal(paused.body.session.status, "paused");
    nowMs += 120_000;
    const pausedView = await api<{ session: { status: "paused"; pausedAt?: string }; participant: { startedAt?: string; pausedDurationMs: number } }>(`/api/speaking/sessions/${joined.body.session.id}`, { speakingToken: joined.body.token });
    assert.equal(pausedView.body.participant.pausedDurationMs, 0);
    assert.equal(speakingRemainingSeconds(pausedView.body.participant as { startedAt?: string; pausedDurationMs: number }, pausedView.body.session, 120, nowMs), 60);
    const pausedTurn = await api(`/api/speaking/sessions/${joined.body.session.id}/turn`, { method: "POST", speakingToken: joined.body.token, body: { text: "Not while paused." } });
    assert.equal(pausedTurn.response.status, 409);

    const resumed = await api<{ session: { status: "active" } }>(`/api/speaking/sessions/${launched.body.session.id}/resume`, { method: "POST", teacher: "owner" });
    assert.equal(resumed.body.session.status, "active");
    nowMs += 59_000;
    const lastValidTurn = await api(`/api/speaking/sessions/${joined.body.session.id}/turn`, { method: "POST", speakingToken: joined.body.token, body: { text: "I would like this one." } });
    assert.equal(lastValidTurn.response.status, 200);
    nowMs += 2_000;
    const overTimeTurn = await api(`/api/speaking/sessions/${joined.body.session.id}/turn`, { method: "POST", speakingToken: joined.body.token, body: { text: "This is too late." } });
    assert.equal(overTimeTurn.response.status, 409);

    const pausedAgain = await api(`/api/speaking/sessions/${launched.body.session.id}/pause`, { method: "POST", teacher: "owner" });
    assert.equal(pausedAgain.response.status, 200);
    nowMs += 30_000;
    const ended = await api<{ session: { status: "ended" } }>(`/api/speaking/sessions/${launched.body.session.id}/end`, { method: "POST", teacher: "owner" });
    assert.equal(ended.body.session.status, "ended");
    const endedView = await api<{ participant: { pausedDurationMs: number } }>(`/api/speaking/sessions/${joined.body.session.id}`, { speakingToken: joined.body.token });
    assert.equal(endedView.body.participant.pausedDurationMs, 150_000);
    nowMs += 10 * 60_000;
    const endedResults = await api<{ session: { status: string }; items: Array<{ participant: { id: string }; durationSeconds: number }> }>(`/api/speaking/sessions/${launched.body.session.id}/results`, { teacher: "owner" });
    assert.equal(endedResults.body.session.status, "ended");
    assert.equal(endedResults.body.items.find((item) => item.participant.id === joined.body.participant.id)?.durationSeconds, 121);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

for (const terminalFailure of ["unavailable", "authentication", "bad_request"] as const) test(`terminal speaking evaluation exposes a cooldowned, idempotent manual retry: ${terminalFailure}`, async () => {
  const app = express();
  app.use(express.json());
  const state = createSpeakingRouteState();
  const providers = createSpeakingProviders({ NODE_ENV: "test", SPEAKING_MOCK_MODE: "true" });
  let counter = 0;
  let evaluationCalls = 0;
  let nowMs = Date.parse("2026-09-14T00:00:00.000Z");
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
    id: () => `manual-retry-${++counter}`,
    state,
    providers,
    evaluationProvider: {
      async evaluate(input) {
        evaluationCalls += 1;
        if (evaluationCalls === 5 && terminalFailure !== "unavailable") {
          throw new SpeakingProviderError("terminal provider failure", terminalFailure, terminalFailure === "authentication" ? 401 : 404);
        }
        if (evaluationCalls <= 5) throw new SpeakingProviderError("temporary provider outage", "unavailable", 503);
        return providers.evaluation.evaluate(input);
      }
    },
    allowTextInput: true,
    random: () => 0.5
  });
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const api = async <T>(path: string, options: { method?: string; teacher?: string; speakingToken?: string; body?: unknown } = {}) => {
    const headers = new Headers();
    if (options.teacher) headers.set("x-teacher", options.teacher);
    if (options.speakingToken) headers.set("x-speaking-token", options.speakingToken);
    if (options.body !== undefined) headers.set("content-type", "application/json");
    const response = await fetch(`${baseUrl}${path}`, { method: options.method ?? "GET", headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
    const responseText = await response.text();
    let body = {} as T;
    try { body = responseText ? JSON.parse(responseText) as T : body; } catch { /* Express error pages are not part of this assertion. */ }
    return { response, body };
  };

  try {
    const created = await api<{ activity: { id: string } }>("/api/speaking/activities", { method: "POST", teacher: "owner", body: activityInput });
    const launched = await api<{ session: { id: string; joinCode: string } }>(`/api/speaking/activities/${created.body.activity.id}/sessions`, { method: "POST", teacher: "owner" });
    await api(`/api/speaking/sessions/${launched.body.session.id}/start-session`, { method: "POST", teacher: "owner" });
    const joined = await api<{ token: string; participant: { id: string }; session: { id: string } }>("/api/speaking/join", { method: "POST", body: { code: launched.body.session.joinCode, identifier: "Manual retry student" } });
    await api(`/api/speaking/sessions/${joined.body.session.id}/start`, { method: "POST", speakingToken: joined.body.token });
    await api(`/api/speaking/sessions/${joined.body.session.id}/turn`, { method: "POST", speakingToken: joined.body.token, body: { text: "I would like the blue one." } });

    let finish = await api<{ result: { turns: unknown[] }; evaluationStatus?: string; evaluationRetryable?: boolean; nextRetryAt?: string; evaluationManualRetryAt?: string }>(`/api/speaking/sessions/${joined.body.session.id}/finish`, { method: "POST", speakingToken: joined.body.token });
    assert.equal(finish.response.status, 202);
    for (let attempt = 1; attempt < 5; attempt += 1) {
      assert.equal(finish.body.evaluationStatus, "retrying");
      nowMs = Date.parse(finish.body.nextRetryAt!);
      state.requestWindows.clear();
      finish = await api(`/api/speaking/sessions/${joined.body.session.id}/finish`, { method: "POST", speakingToken: joined.body.token });
    }
    assert.equal(evaluationCalls, 5);
    assert.equal(finish.body.evaluationStatus, "failed");
    assert.equal(state.evaluationJobs.get(joined.body.participant.id)?.retryable, terminalFailure === "unavailable");
    assert.equal(finish.body.evaluationRetryable, false);
    if (terminalFailure !== "unavailable") {
      assert.equal(finish.body.evaluationManualRetryAt, undefined);
      nowMs += 600_000;
      state.requestWindows.clear();
      const terminalResult = await api<{ evaluationStatus: string; evaluationRetryable: boolean; evaluationManualRetryable: boolean; evaluationManualRetryAt?: string; result: { evaluation?: unknown; turns: unknown[] } }>(`/api/speaking/results/${joined.body.participant.id}`, { speakingToken: joined.body.token });
      assert.equal(terminalResult.body.evaluationStatus, "failed");
      assert.equal(terminalResult.body.evaluationRetryable, false);
      assert.equal(terminalResult.body.evaluationManualRetryable, false);
      assert.equal(terminalResult.body.evaluationManualRetryAt, undefined);
      assert.equal(terminalResult.body.result.evaluation, undefined);
      for (const credentials of [{ speakingToken: joined.body.token }, { teacher: "owner" }]) {
        const denied = await api<{ code: string }>(`/api/speaking/results/${joined.body.participant.id}/retry-evaluation`, { method: "POST", ...credentials });
        assert.equal(denied.response.status, 409);
        assert.equal(denied.body.code, "SPEAKING_EVALUATION_RETRY_UNAVAILABLE");
      }
      await api(`/api/speaking/sessions/${joined.body.session.id}/finish`, { method: "POST", speakingToken: joined.body.token });
      assert.equal(evaluationCalls, 5, "cooldown, polling, and explicit retry must not restart a non-retryable job");
      assert.deepEqual(terminalResult.body.result.turns, finish.body.result.turns);
      return;
    }
    assert.ok(finish.body.evaluationManualRetryAt);

    const beforeCooldownTeacherRetry = await api(`/api/speaking/results/${joined.body.participant.id}/retry-evaluation`, { method: "POST", teacher: "owner" });
    assert.equal(beforeCooldownTeacherRetry.response.status, 409);
    state.requestWindows.clear();
    const beforeManualFinish = await api(`/api/speaking/sessions/${joined.body.session.id}/finish`, { method: "POST", speakingToken: joined.body.token });
    assert.equal(beforeManualFinish.response.status, 202);
    assert.equal(evaluationCalls, 5);

    nowMs = Date.parse(finish.body.evaluationManualRetryAt!);
    const available = await api<{ evaluationRetryable?: boolean; evaluationManualRetryable?: boolean }>(`/api/speaking/results/${joined.body.participant.id}`, { speakingToken: joined.body.token });
    assert.equal(available.body.evaluationRetryable, true);
    assert.equal(available.body.evaluationManualRetryable, true);
    state.requestWindows.clear();
    const turnsBeforeRetry = (await api<{ result: { turns: unknown[] } }>(`/api/speaking/results/${joined.body.participant.id}`, { speakingToken: joined.body.token })).body.result.turns.length;
    const manualFinish = await api<{ result: { evaluation?: unknown; turns: unknown[] }; evaluationStatus?: string }>(`/api/speaking/sessions/${joined.body.session.id}/finish`, { method: "POST", speakingToken: joined.body.token });
    assert.equal(manualFinish.response.status, 200);
    assert.equal(manualFinish.body.evaluationStatus, "completed");
    assert.ok(manualFinish.body.result.evaluation);
    assert.equal(manualFinish.body.result.turns.length, turnsBeforeRetry);
    assert.equal(evaluationCalls, 6);

    const teacherResult = await api<{ result: { evaluation?: unknown } }>(`/api/speaking/results/${joined.body.participant.id}`, { teacher: "owner" });
    assert.equal(teacherResult.response.status, 200);
    assert.ok(teacherResult.body.result.evaluation);
  } finally {
    app.emit("speaking:shutdown");
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("Luxury Car Sales test-drive evaluation survives parse, validation, sanitization, persistence, and result APIs", async () => {
  const template = SPEAKING_CORE_LIBRARY.find((item) => item.id === "workplace-luxury-car-test-drive");
  assert.ok(template);
  assert.equal(template.title, "Arranging and Discussing a Test Drive");
  assert.equal(template.rubric.filter((criterion) => criterion.enabled).length, 4);
  const workplaceInput = {
    title: template.title,
    scenario: template.scenario,
    aiRole: template.aiRole,
    studentRole: template.studentRole,
    level: template.level,
    difficulty: template.difficulty,
    nativeLanguage: template.nativeLanguage,
    durationSeconds: template.durationSeconds,
    identifierMode: template.identifierMode,
    mode: template.mode,
    supportSettings: template.supportSettings,
    targetExpressions: template.targetExpressions,
    rubric: template.rubric,
    scenarioResources: template.scenarioResources
  };
  const app = express();
  app.use(express.json());
  const state = createSpeakingRouteState();
  const providers = createSpeakingProviders({ NODE_ENV: "test", SPEAKING_MOCK_MODE: "true" });
  let counter = 0;
  let evaluationCalls = 0;
  const now = "2026-09-15T00:00:00.000Z";
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
    now: () => now,
    id: () => `luxury-car-regression-${++counter}`,
    state,
    providers,
    evaluationProvider: {
      async evaluate(input) {
        evaluationCalls += 1;
        const studentTurns = input.turns.filter((turn) => turn.speaker === "student");
        const enabledIds = input.activity.rubric.filter((criterion) => criterion.enabled).map((criterion) => criterion.id);
        const parsed = parseJsonResponse<{
          scores: Record<string, number | null>;
          evidence: Record<string, string>;
          strengths: string[];
          improvements: string[];
          usefulEnglish: Array<{ said: string; try: string; sourceTurnId: string }>;
          goalCompletion: NonNullable<SpeakingEvaluation["goalCompletion"]>;
          overallMessage: string;
        }>(JSON.stringify({
          scores: Object.fromEntries(enabledIds.map((id) => [id, 4])),
          evidence: Object.fromEntries(enabledIds.map((id) => [id, "予約時間と試乗の流れを明確に説明しました。"])),
          strengths: ["お客様の希望を確認し、丁寧に案内できました。"],
          improvements: ["次は試乗後の次の一歩を、さらに短く確認しましょう。"],
          usefulEnglish: studentTurns[0] ? [{ said: studentTurns[0].text, try: "Let me confirm the test-drive details.", sourceTurnId: studentTurns[0].id }] : [],
          goalCompletion: {
            completed: true,
            requirements: speakingGoalRequirements(input.activity).map((requirement) => ({ requirement, status: "completed", evidenceTurnIds: studentTurns.map((turn) => turn.id) }))
          },
          overallMessage: "試乗の予約と説明ができました。会話の目的をしっかり達成しています。"
        }));
        return {
          ...parsed,
          participantId: input.participantId,
          language: input.activity.nativeLanguage,
          assessmentStatus: "scored" as const,
          createdAt: now
        };
      }
    },
    allowTextInput: true,
    random: () => 0.5
  });
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const api = async <T>(path: string, options: { method?: string; teacher?: string; speakingToken?: string; body?: unknown } = {}) => {
    const headers = new Headers();
    if (options.teacher) headers.set("x-teacher", options.teacher);
    if (options.speakingToken) headers.set("x-speaking-token", options.speakingToken);
    if (options.body !== undefined) headers.set("content-type", "application/json");
    const response = await fetch(`${baseUrl}${path}`, { method: options.method ?? "GET", headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
    const responseText = await response.text();
    let body = {} as T;
    try { body = responseText ? JSON.parse(responseText) as T : body; } catch { /* Express error pages are not part of this assertion. */ }
    return { response, body };
  };

  try {
    const created = await api<{ activity: { id: string; rubric: Array<{ id: string; enabled: boolean }> } }>("/api/speaking/activities", { method: "POST", teacher: "owner", body: workplaceInput });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.activity.rubric.filter((criterion) => criterion.enabled).length, 4);
    const launched = await api<{ session: { id: string; joinCode: string } }>(`/api/speaking/activities/${created.body.activity.id}/sessions`, { method: "POST", teacher: "owner" });
    await api(`/api/speaking/sessions/${launched.body.session.id}/start-session`, { method: "POST", teacher: "owner" });
    const joined = await api<{ token: string; participant: { id: string }; session: { id: string } }>("/api/speaking/join", { method: "POST", body: { code: launched.body.session.joinCode, identifier: "Hana" } });
    await api(`/api/speaking/sessions/${joined.body.session.id}/start`, { method: "POST", speakingToken: joined.body.token });
    for (const text of [
      "Good afternoon. I would like to arrange a test drive for the silver sedan.",
      "My name is Hana, and what time would be convenient?",
      "How long will the drive take, and what should I bring?",
      "I will check that document requirement for you. My family member can join.",
      "The drive was helpful. I would like to compare another option."
    ]) {
      const turn = await api(`/api/speaking/sessions/${joined.body.session.id}/turn`, { method: "POST", speakingToken: joined.body.token, body: { text } });
      assert.equal(turn.response.status, 200);
    }
    const finished = await api<{ result: { evaluation?: SpeakingEvaluation; turns: Array<{ speaker: string; text: string; id: string }> }; evaluationStatus?: string }>(`/api/speaking/sessions/${joined.body.session.id}/finish`, { method: "POST", speakingToken: joined.body.token });
    assert.equal(finished.response.status, 200);
    assert.equal(finished.body.evaluationStatus, "completed");
    assert.equal(evaluationCalls, 1);
    assert.ok(finished.body.result.evaluation);
    assert.equal(finished.body.result.evaluation?.language, "ja");
    assert.equal(finished.body.result.evaluation?.goalCompletion?.completed, true);
    assert.equal(finished.body.result.evaluation?.usefulEnglish[0]?.said, finished.body.result.turns.find((turn) => turn.speaker === "student")?.text);

    const studentResult = await api<{ result: { evaluation?: SpeakingEvaluation }; evaluationStatus?: string }>(`/api/speaking/results/${joined.body.participant.id}`, { speakingToken: joined.body.token });
    assert.equal(studentResult.response.status, 200);
    assert.equal(studentResult.body.evaluationStatus, "completed");
    assert.equal(studentResult.body.result.evaluation?.assessmentStatus, "scored");
    assert.equal(Object.values(studentResult.body.result.evaluation?.scores ?? {}).every((score) => score === 4), true);

    const teacherResults = await api<{ items: Array<{ participant: { id: string }; overallScore?: number; evaluation?: SpeakingEvaluation }> }>(`/api/speaking/sessions/${launched.body.session.id}/results`, { teacher: "owner" });
    assert.equal(teacherResults.response.status, 200);
    const teacherItem = teacherResults.body.items.find((item) => item.participant.id === joined.body.participant.id);
    assert.equal(teacherItem?.overallScore, 100);
    assert.equal(teacherItem?.evaluation?.language, "ja");
  } finally {
    app.emit("speaking:shutdown");
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
