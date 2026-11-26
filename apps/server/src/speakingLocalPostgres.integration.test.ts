import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer, type AddressInfo } from "node:net";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { SPEAKING_LOCAL_TRANSCRIPT_CONTENT_TYPE, type SpeakingParticipant, type SpeakingSession, type SpeakingTurn } from "@quizstrike/shared";

const databaseUrl = process.env.SPEAKCHECK_TEST_DATABASE_URL;

test("a PostgreSQL-backed pilot survives API restart, retries and rollback", {
  skip: !databaseUrl && "Set SPEAKCHECK_TEST_DATABASE_URL to a migrated, disposable local PostgreSQL database.",
  timeout: 90_000
}, async () => {
  assert.ok(databaseUrl);
  const url = new URL(databaseUrl);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  const email = `speaking-restart-${randomUUID()}@example.test`;
  const secret = randomUUID();
  let api: ChildProcess | undefined;
  let origin = "";
  let output = "";

  async function stop() {
    if (!api || api.exitCode !== null || api.signalCode !== null) return;
    const closed = once(api, "exit");
    api.kill("SIGKILL");
    await closed;
  }

  async function request<T>(path: string, status: number, options?: RequestInit): Promise<T> {
    const response = await fetch(origin + path, { ...options, signal: AbortSignal.timeout(10_000) });
    const body = await response.text();
    assert.equal(response.status, status, `${options?.method ?? "GET"} ${path}`);
    return JSON.parse(body) as T;
  }

  async function start(pilotEnabled: boolean) {
    const reservation = createServer().listen(0, "127.0.0.1");
    await once(reservation, "listening");
    const { port } = reservation.address() as AddressInfo;
    await new Promise<void>((resolve) => reservation.close(() => resolve()));
    origin = `http://127.0.0.1:${port}`;
    output = "";
    api = spawn(process.execPath, ["--import", "tsx", fileURLToPath(new URL("./start.ts", import.meta.url))], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PORT: String(port),
        NODE_ENV: "test",
        DATABASE_URL: databaseUrl,
        JWT_SECRET: secret,
        RUNTIME_STORE: "in-memory",
        QUIZSTRIKE_NO_AUTOSTART: "false",
        SPEAKING_MOCK_MODE: "true",
        SPEAKING_LOCAL_TRANSCRIPTION_ENABLED: String(pilotEnabled),
        SPEAKING_LOCAL_TRANSCRIPTION_ALLOW_EXTERNAL_AI: "false",
        SPEAKING_LATENCY_DEBUG: "true"
      }
    });
    api.stdout?.on("data", (chunk: Buffer) => { output = (output + chunk.toString()).slice(-4_000); });
    api.stderr?.on("data", (chunk: Buffer) => { output = (output + chunk.toString()).slice(-4_000); });
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline && api.exitCode === null && api.signalCode === null) {
      const health = await fetch(origin + "/api/health", { signal: AbortSignal.timeout(1_000) }).catch(() => undefined);
      if (health?.ok) {
        assert.equal((await health.json()).storage, "postgres");
        return;
      }
      await delay(100);
    }
    assert.fail(`The test API did not start: ${output}`);
  }

  const speaking = "/api/speaking";
  const post = <T>(path: string, status: number, body?: object, headers: Record<string, string> = {}) =>
    request<T>(path, status, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: body && JSON.stringify(body) });

  try {
    await start(true);
    const { token: teacherToken } = await post<{ token: string }>("/api/auth/signup", 201, { name: "Synthetic QA Teacher", email, password: randomUUID() });
    const teacher = { Authorization: `Bearer ${teacherToken}` };
    const { activity } = await post<{ activity: { id: string } }>(speaking + "/activities", 201, {
      title: "Synthetic restart check", scenario: "Talk about books.", aiRole: "Classmate", studentRole: "Student",
      level: "beginner", difficulty: "easy", nativeLanguage: "en", durationSeconds: 240, identifierMode: "anonymous",
      mode: "assessment", targetExpressions: [],
      rubric: [{ id: "communication", name: "Communication", description: "Share an idea.", enabled: true }]
    }, teacher);
    const launchPath = `${speaking}/activities/${activity.id}/sessions`;
    const { session } = await post<{ session: SpeakingSession }>(launchPath, 201, { localTranscription: true }, teacher);
    const path = `${speaking}/sessions/${session.id}`;
    assert.equal(session.localTranscription, true);
    const join = async () => {
      const { participant, token } = await post<{ participant: SpeakingParticipant; token: string }>(speaking + "/join", 201, { code: session.joinCode });
      return { participant, headers: { "X-Speaking-Token": token } };
    };
    const first = await join();
    const second = await join();
    await post(path + "/local-readiness", 200, { status: "ready" }, first.headers);
    await post(path + "/local-readiness", 200, { status: "ready" }, second.headers);
    await post(path + "/start-session", 200, undefined, teacher);
    await post(path + "/start", 200, undefined, first.headers);
    await post(path + "/start", 200, undefined, second.headers);

    type TurnPair = { studentTurn: SpeakingTurn; aiTurn: SpeakingTurn };
    const submit = (headers: Record<string, string>, requestId: string, status = 200, text = "I like reading books.") =>
      post<TurnPair>(path + "/turn", status, { text, uncertain: true }, {
        ...headers, "Content-Type": SPEAKING_LOCAL_TRANSCRIPT_CONTENT_TYPE, "X-Speaking-Turn-Id": requestId
      });
    const saved = await submit(first.headers, "completed-turn");
    assert.equal(saved.studentTurn.clientTranscribed, true);
    assert.equal(saved.studentTurn.transcriptionUncertain, true);
    await submit(second.headers, "evaluation-turn");
    await post(path + "/pause", 200, undefined, teacher);
    await stop();

    // Model the database at two interruption points so recovery does not depend
    // on how fast the mock provider responds on this machine.
    const now = new Date();
    const interrupted = await prisma.speakingTurn.create({ data: {
      participantId: first.participant.id, sessionId: session.id, requestId: "interrupted-turn",
      speaker: "student", text: "I read after school.", clientTranscribed: true, createdAt: now
    } });
    await prisma.speakingParticipant.update({ where: { id: second.participant.id }, data: { status: "evaluating", finishedAt: now } });
    await prisma.speakingEvaluationJob.create({ data: {
      participantId: second.participant.id, status: "running", attempt: 1,
      startedAt: new Date(now.getTime() - 60_000), leaseUntil: new Date(now.getTime() - 1_000)
    } });

    await start(true);
    const resumedSession = await request<{ session: SpeakingSession; participant: SpeakingParticipant; turns: SpeakingTurn[] }>(path, 200, { headers: first.headers });
    assert.equal(resumedSession.session.status, "paused");
    assert.equal(resumedSession.session.localTranscription, true);
    assert.equal(resumedSession.participant.localSpeechReadiness, "ready");
    assert.equal(resumedSession.turns.find((turn) => turn.id === saved.studentTurn.id)?.transcriptionUncertain, true);
    await post(path + "/resume", 200, undefined, teacher);

    const replay = await submit(first.headers, "completed-turn", 200, "A different answer.");
    assert.deepEqual([replay.studentTurn.id, replay.aiTurn.id, replay.studentTurn.text], [saved.studentTurn.id, saved.aiTurn.id, saved.studentTurn.text]);
    const recovered = await submit(first.headers, "interrupted-turn", 200, "A different answer.");
    assert.equal(recovered.studentTurn.id, interrupted.id);
    assert.equal(recovered.studentTurn.text, "I read after school.");
    assert.equal(await prisma.speakingTurn.count({ where: { participantId: first.participant.id, requestId: { in: ["interrupted-turn", "interrupted-turn:ai"] } } }), 2);

    // Wait on stored state so a result request cannot trigger recovery itself.
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline && !await prisma.speakingEvaluation.findUnique({ where: { participantId: second.participant.id } })) await delay(100);
    const evaluation = await prisma.speakingEvaluation.findUniqueOrThrow({ where: { participantId: second.participant.id } });
    const job = await prisma.speakingEvaluationJob.findUniqueOrThrow({ where: { participantId: second.participant.id } });
    assert.equal(job.status, "completed");
    assert.equal(job.attempt, 2);
    await stop();

    await start(false);
    await post(launchPath, 503, { localTranscription: true }, teacher);
    await submit(first.headers, "rollback-turn", 503);
    const resultPath = `${speaking}/results/${second.participant.id}`;
    const preserved = await request<{ result: { evaluation: { overallMessage: string } } }>(resultPath, 200, { headers: second.headers });
    assert.equal(preserved.result.evaluation.overallMessage, evaluation.overallMessage);
    const ordinary = await post<{ session: SpeakingSession }>(launchPath, 201, {}, teacher);
    assert.notEqual(ordinary.session.localTranscription, true);
  } finally {
    await stop();
    try {
      await prisma.user.deleteMany({ where: { email } });
    } finally {
      await prisma.$disconnect();
    }
  }
});
