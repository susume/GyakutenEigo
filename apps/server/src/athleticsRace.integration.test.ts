import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { io as createSocket, type Socket as ClientSocket } from "socket.io-client";
import { getAthleticsPointAtProgress, getAthleticsRecoveryPosition, getAthleticsRouteTangent } from "@quizstrike/shared";

type ServerRuntime = typeof import("./index.js");
type SessionFixture = {
  id: string;
  sessionCode: string;
  status: "waiting" | "active" | "paused" | "ended";
  settings: { mapId: string; gameMode: string; athleticsCourseId?: string; athleticsCourseLaps?: number };
  players: PlayerFixture[];
  athletics?: { status: string; questionCount: number; questionsPerLap: number; requiredLaps: number; startAt: string; finishOrder: string[] };
};
type PlayerFixture = {
  id: string;
  nickname: string;
  isAlive?: boolean;
  x?: number;
  y?: number;
  z?: number;
  facing?: number;
  questionIndex?: number;
  athletics?: {
    questionIndex: number;
    checkpointIndex: number;
    routeProgress: number;
    gateOpen: boolean;
    status: string;
    falls: number;
    completedLaps: number;
    recoveryActive?: boolean;
    recoveryCorrectAnswers?: number;
    recoveryRequiredAnswers?: number;
    recoverySurfaceId?: string;
    lapTransitionUntil?: string;
  };
  energy?: number;
  respawns?: number;
};
type JoinedPlayer = {
  session: SessionFixture;
  player: PlayerFixture;
  playerToken: string;
  question?: { id: string };
};

let runtime: ServerRuntime;
let baseUrl = "";
let fixtureCounter = 0;

const api = async <T>(path: string, options: { method?: string; teacherToken?: string; playerToken?: string; body?: unknown } = {}) => {
  const headers = new Headers();
  if (options.teacherToken) headers.set("Authorization", `Bearer ${options.teacherToken}`);
  if (options.playerToken) headers.set("X-Player-Token", options.playerToken);
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  return { response, body: (text ? JSON.parse(text) : {}) as T };
};

const createTeacherWithQuiz = async () => {
  fixtureCounter += 1;
  const signup = await api<{ token: string }>("/api/auth/signup", {
    method: "POST",
    body: {
      name: `Athletics Teacher ${fixtureCounter}`,
      email: `athletics-${Date.now()}-${fixtureCounter}@example.test`,
      password: "classroom-pass"
    }
  });
  assert.equal(signup.response.status, 201);
  const quiz = await api<{ quizSet: { id: string } }>("/api/quiz-sets", {
    method: "POST",
    teacherToken: signup.body.token,
    body: { title: `Athletics Quiz ${fixtureCounter}` }
  });
  assert.equal(quiz.response.status, 201);
  for (const [index, prompt] of ["Start-line vocabulary", "Hurdle vocabulary", "Finish-line vocabulary"].entries()) {
    const question = await api(`/api/quiz-sets/${quiz.body.quizSet.id}/questions`, {
      method: "POST",
      teacherToken: signup.body.token,
      body: {
        prompt,
        choiceA: "Correct",
        choiceB: "Wrong one",
        choiceC: "Another wrong one",
        choiceD: "Still wrong",
        correctChoice: "A",
        explanation: `Question ${index + 1} explanation`
      }
    });
    assert.equal(question.response.status, 201);
  }
  return { token: signup.body.token, quizSetId: quiz.body.quizSet.id };
};

const createSession = async (teacher: { token: string; quizSetId: string }, athleticsCourseLaps = 1) => {
  const created = await api<{ session: SessionFixture }>("/api/sessions", {
    method: "POST",
    teacherToken: teacher.token,
    body: {
      quizSetId: teacher.quizSetId,
      settings: { gameMode: "athletics", athleticsCourseLaps, maxPlayers: 8, roundDurationSeconds: 60 }
    }
  });
  assert.equal(created.response.status, 201);
  return created.body.session;
};

const joinSession = async (code: string, nickname: string) => {
  const joined = await api<JoinedPlayer>(`/api/sessions/${code}/join`, {
    method: "POST",
    body: { nickname }
  });
  assert.equal(joined.response.status, 201);
  return joined.body;
};

const waitForSessionState = (socket: ClientSocket) => new Promise<SessionFixture>((resolve, reject) => {
  const timeout = setTimeout(() => {
    socket.off("session_state", onState);
    reject(new Error("Timed out waiting for Athletics session state."));
  }, 8_000);
  const onState = (session: SessionFixture) => {
    clearTimeout(timeout);
    socket.off("session_state", onState);
    resolve(session);
  };
  socket.on("session_state", onState);
});

const connectStudentSocket = (sessionCode: string, student: JoinedPlayer) => {
  const socket = createSocket(baseUrl, { autoConnect: false, transports: ["websocket"], reconnection: false });
  const initialState = waitForSessionState(socket);
  socket.on("connect", () => socket.emit("join_session_room", {
    code: sessionCode,
    playerId: student.player.id,
    playerToken: student.playerToken
  }));
  socket.connect();
  return { socket, initialState };
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const waitUntil = async <T>(read: () => Promise<T>, predicate: (value: T) => boolean, timeoutMs = 12_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    runtime.advanceRounds();
    runtime.advanceBots();
    const value = await read();
    if (predicate(value)) return value;
    await delay(180);
  }
  throw new Error("Timed out waiting for Athletics race progress.");
};

test.before(async () => {
  process.env.QUIZSTRIKE_NO_AUTOSTART = "true";
  process.env.JWT_SECRET = "athletics-integration-secret";
  process.env.DATABASE_URL = " ";
  process.env.NODE_ENV = "test";
  // Manual lifecycle advancement disables the production renewal interval;
  // keep the test room owned for the full multi-lap acceptance window.
  process.env.ROOM_LEASE_MS = "120000";
  runtime = await import("./index.js");
  await new Promise<void>((resolve, reject) => {
    runtime.server.once("error", reject);
    runtime.server.listen(0, "127.0.0.1", resolve);
  });
  const address = runtime.server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  await new Promise<void>((resolve) => runtime.io.close(() => resolve()));
  if (runtime.server.listening) {
    await new Promise<void>((resolve, reject) => runtime.server.close((error) => error ? reject(error) : resolve()));
  }
});

test("Athletics creation, start gate, wrong-answer retry, skip prevention, and DNF report stay authoritative", { timeout: 30_000 }, async () => {
  const teacher = await createTeacherWithQuiz();
  const session = await createSession(teacher);
  assert.equal(session.settings.gameMode, "athletics");
  assert.equal(session.settings.mapId, "athletics_park");
  assert.equal(session.settings.athleticsCourseId, "stadium_loop");
  assert.equal(session.settings.athleticsCourseLaps, 1);

  const alpha = await joinSession(session.sessionCode, "Athletics Alpha");
  const bravo = await joinSession(session.sessionCode, "Athletics Bravo");
  assert.ok(alpha.question?.id);
  assert.ok(bravo.question?.id);
  assert.notEqual(`${alpha.player.x}:${alpha.player.z}`, `${bravo.player.x}:${bravo.player.z}`);

  const started = await api<{ session: SessionFixture }>(`/api/sessions/${session.sessionCode}/start`, {
    method: "POST",
    teacherToken: teacher.token
  });
  assert.equal(started.response.status, 200);
  assert.equal(started.body.session.status, "active");
  assert.equal(started.body.session.athletics?.status, "countdown");
  assert.ok(started.body.session.athletics?.startAt);

  const socketConnection = connectStudentSocket(session.sessionCode, alpha);
  await socketConnection.initialState;
  const beforeGo = started.body.session.players.find((player) => player.id === alpha.player.id)!;
  await delay(3_200);
  socketConnection.socket.emit("player_position", {
    x: (beforeGo.x ?? 0) + 30,
    y: beforeGo.y,
    z: beforeGo.z ?? 0,
    facing: 0
  });
  await delay(100);
  const lockedSnapshot = await api<{ session: SessionFixture }>(`/api/sessions/${session.sessionCode}`, { playerToken: alpha.playerToken });
  const lockedPlayer = lockedSnapshot.body.session.players.find((player) => player.id === alpha.player.id)!;
  assert.equal(lockedPlayer.x, beforeGo.x);
  assert.equal(lockedPlayer.z, beforeGo.z);

  const wrong = await api<{ result: { isCorrect: boolean; nextQuestion?: { id: string }; player: PlayerFixture } }>(
    `/api/sessions/${session.sessionCode}/players/${alpha.player.id}/answer`,
    { method: "POST", playerToken: alpha.playerToken, body: { questionId: alpha.question!.id, selectedChoice: "B" } }
  );
  assert.equal(wrong.response.status, 200);
  assert.equal(wrong.body.result.isCorrect, false);
  assert.equal(wrong.body.result.nextQuestion?.id, alpha.question!.id);
  const penaltyRetry = await api(`/api/sessions/${session.sessionCode}/players/${alpha.player.id}/answer`, {
    method: "POST",
    playerToken: alpha.playerToken,
    body: { questionId: alpha.question!.id, selectedChoice: "A" }
  });
  assert.equal(penaltyRetry.response.status, 409);

  await delay(1_000);
  const correct = await api<{ result: { isCorrect: boolean; player: PlayerFixture } }>(
    `/api/sessions/${session.sessionCode}/players/${alpha.player.id}/answer`,
    { method: "POST", playerToken: alpha.playerToken, body: { questionId: alpha.question!.id, selectedChoice: "A" } }
  );
  assert.equal(correct.response.status, 200);
  assert.equal(correct.body.result.isCorrect, true);
  assert.equal(correct.body.result.player.athletics?.questionIndex, 1);
  assert.equal(correct.body.result.player.athletics?.gateOpen, true);

  const noWeapons = await api(`/api/sessions/${session.sessionCode}/players/${alpha.player.id}/buy`, {
    method: "POST",
    playerToken: alpha.playerToken,
    body: { gearId: "quick_blaster" }
  });
  assert.equal(noWeapons.response.status, 400);

  const progressBeforeFall = beforeGo.athletics?.routeProgress ?? 0;
  // Settling on the visible park floor between the first two landings must
  // enter recovery too; a student must never have to walk back from ground.
  socketConnection.socket.emit("player_position", {
    x: -2,
    y: 4.21,
    z: 113,
    facing: 0
  });
  const recoverySnapshot = await waitUntil(
    async () => (await api<{ session: SessionFixture }>(`/api/sessions/${session.sessionCode}`, { playerToken: alpha.playerToken })).body.session,
    (snapshot) => snapshot.players.find((player) => player.id === alpha.player.id)?.athletics?.recoveryActive === true,
    5_000
  );
  const recoveryPlayer = recoverySnapshot.players.find((player) => player.id === alpha.player.id)!;
  assert.equal(recoveryPlayer.athletics?.falls, 1);
  assert.equal(recoveryPlayer.isAlive, false);
  assert.equal(recoveryPlayer.athletics?.recoveryCorrectAnswers, 0);
  assert.equal(recoveryPlayer.athletics?.recoveryRequiredAnswers, 3);
  assert.ok((recoveryPlayer.athletics?.routeProgress ?? 0) <= progressBeforeFall);

  socketConnection.socket.emit("player_position", {
    x: (recoveryPlayer.x ?? 0) + 100,
    y: recoveryPlayer.y,
    z: (recoveryPlayer.z ?? 0) + 100,
    facing: 1
  });
  await delay(150);
  const frozenSnapshot = await api<{ session: SessionFixture }>(`/api/sessions/${session.sessionCode}`, { playerToken: alpha.playerToken });
  const frozenPlayer = frozenSnapshot.body.session.players.find((player) => player.id === alpha.player.id)!;
  assert.equal(frozenPlayer.x, recoveryPlayer.x);
  assert.equal(frozenPlayer.z, recoveryPlayer.z);
  assert.equal(frozenPlayer.athletics?.recoveryCorrectAnswers, 0);

  // Let the pre-recovery answer-window limiter expire so this test can issue
  // one wrong answer plus the three required correct answers as a single loop.
  await delay(2_600);
  const recoveryQuestion = await api<{ question: { id: string } }>(
    `/api/sessions/${session.sessionCode}/players/${alpha.player.id}/question`,
    { playerToken: alpha.playerToken }
  );
  assert.equal(recoveryQuestion.response.status, 200);
  let recoveryQuestionId = recoveryQuestion.body.question.id;
  const wrongRecovery = await api<{ result: { isCorrect: boolean; nextQuestion?: { id: string }; player: PlayerFixture; respawnProgress?: number; feedback?: string } }>(
    `/api/sessions/${session.sessionCode}/players/${alpha.player.id}/answer`,
    { method: "POST", playerToken: alpha.playerToken, body: { questionId: recoveryQuestionId, selectedChoice: "B" } }
  );
  assert.equal(wrongRecovery.response.status, 200);
  assert.equal(wrongRecovery.body.result.isCorrect, false);
  assert.equal(wrongRecovery.body.result.player.athletics?.recoveryCorrectAnswers, 0);
  assert.equal(wrongRecovery.body.result.respawnProgress, 0);
  assert.match(wrongRecovery.body.result.feedback ?? "", /only correct answers count/i);
  assert.equal(wrongRecovery.body.result.nextQuestion?.id, recoveryQuestionId);

  for (let correctCount = 1; correctCount <= 3; correctCount += 1) {
    const recoveryAnswer = await api<{ result: { isCorrect: boolean; nextQuestion?: { id: string }; player: PlayerFixture; respawned?: boolean; respawnProgress?: number; respawnRequired?: number; rewardLabel?: string } }>(
      `/api/sessions/${session.sessionCode}/players/${alpha.player.id}/answer`,
      { method: "POST", playerToken: alpha.playerToken, body: { questionId: recoveryQuestionId, selectedChoice: "A" } }
    );
    assert.equal(recoveryAnswer.response.status, 200);
    assert.equal(recoveryAnswer.body.result.isCorrect, true);
    assert.equal(recoveryAnswer.body.result.respawnProgress, correctCount);
    if (correctCount < 3) {
      assert.equal(recoveryAnswer.body.result.player.athletics?.recoveryActive, true);
      assert.equal(recoveryAnswer.body.result.player.athletics?.recoveryCorrectAnswers, correctCount);
      assert.equal(recoveryAnswer.body.result.respawned, false);
      assert.ok(recoveryAnswer.body.result.nextQuestion?.id);
      recoveryQuestionId = recoveryAnswer.body.result.nextQuestion!.id;
    } else {
      assert.equal(recoveryAnswer.body.result.respawned, true);
      assert.equal(recoveryAnswer.body.result.respawnRequired, 3);
      assert.match(recoveryAnswer.body.result.rewardLabel ?? "", /Recovery Questions 3 \/ 3/i);
      assert.equal(recoveryAnswer.body.result.player.isAlive, true);
      assert.equal(recoveryAnswer.body.result.player.athletics?.recoveryActive, false);
      assert.ok((recoveryAnswer.body.result.player.energy ?? 0) >= 220);
    }
    await delay(80);
  }

  const recoveredSnapshot = await api<{ session: SessionFixture }>(`/api/sessions/${session.sessionCode}`, { playerToken: alpha.playerToken });
  const recoveredPlayer = recoveredSnapshot.body.session.players.find((player) => player.id === alpha.player.id)!;
  const expectedRecoveryPosition = getAthleticsRecoveryPosition(0, 0);
  assert.ok(Math.abs((recoveredPlayer.x ?? 0) - expectedRecoveryPosition.x) < 0.01);
  assert.ok(Math.abs((recoveredPlayer.z ?? 0) - expectedRecoveryPosition.z) < 0.01);
  assert.ok(Math.abs((recoveredPlayer.facing ?? 0) - expectedRecoveryPosition.facing) < 0.01);
  assert.ok((recoveredPlayer.athletics?.routeProgress ?? 0) <= progressBeforeFall);

  // A recovered racer can immediately move and spend the bounded retry fuel.
  await delay(300);
  const startTangent = getAthleticsRouteTangent(0);
  socketConnection.socket.emit("player_position", {
    x: (recoveredPlayer.x ?? 0) + startTangent.x * 2,
    y: recoveredPlayer.y,
    z: (recoveredPlayer.z ?? 0) + startTangent.z * 2,
    facing: recoveredPlayer.facing ?? 0
  });
  await delay(150);
  const movedSnapshot = await api<{ session: SessionFixture }>(`/api/sessions/${session.sessionCode}`, { playerToken: alpha.playerToken });
  const movedPlayer = movedSnapshot.body.session.players.find((player) => player.id === alpha.player.id)!;
  assert.notEqual(`${movedPlayer.x}:${movedPlayer.z}`, `${recoveredPlayer.x}:${recoveredPlayer.z}`);
  assert.ok((movedPlayer.energy ?? 0) <= (recoveredPlayer.energy ?? 0));

  // A client-supplied summit position cannot advance the route or checkpoint.
  const skipPoint = getAthleticsPointAtProgress(0.8);
  socketConnection.socket.emit("player_position", { ...skipPoint, y: 4.21, facing: 0 });
  await delay(150);
  const noSkip = await api<{ session: SessionFixture }>(`/api/sessions/${session.sessionCode}`, { playerToken: alpha.playerToken });
  const noSkipPlayer = noSkip.body.session.players.find((player) => player.id === alpha.player.id)!;
  assert.equal(noSkipPlayer.athletics?.questionIndex, 1);
  assert.ok((noSkipPlayer.athletics?.checkpointIndex ?? 0) <= (movedPlayer.athletics?.checkpointIndex ?? 0));
  assert.ok((noSkipPlayer.athletics?.routeProgress ?? 0) < 0.1, "a summit position must not skip the opening section");

  // A second fall re-enters the same short flow instead of granting another
  // refill or leaving the racer at ground level.
  const energyBeforeSecondFall = noSkipPlayer.energy ?? 0;
  socketConnection.socket.emit("player_position", {
    x: noSkipPlayer.x ?? 0,
    y: -2,
    z: noSkipPlayer.z ?? 0,
    facing: noSkipPlayer.facing ?? 0
  });
  const secondRecoverySnapshot = await waitUntil(
    async () => (await api<{ session: SessionFixture }>(`/api/sessions/${session.sessionCode}`, { playerToken: alpha.playerToken })).body.session,
    (snapshot) => {
      const player = snapshot.players.find((candidate) => candidate.id === alpha.player.id);
      return player?.athletics?.recoveryActive === true && (player.athletics?.falls ?? 0) >= 2;
    },
    5_000
  );
  const secondRecoveryPlayer = secondRecoverySnapshot.players.find((player) => player.id === alpha.player.id)!;
  assert.equal(secondRecoveryPlayer.athletics?.recoveryCorrectAnswers, 0);
  assert.ok((secondRecoveryPlayer.energy ?? 0) <= energyBeforeSecondFall);
  assert.ok((secondRecoveryPlayer.athletics?.routeProgress ?? 0) <= (noSkipPlayer.athletics?.routeProgress ?? 0) + 0.001);

  socketConnection.socket.disconnect();
  const rejoined = await api<JoinedPlayer>(`/api/sessions/${session.sessionCode}/players/${alpha.player.id}/rejoin`, { playerToken: alpha.playerToken });
  assert.equal(rejoined.response.status, 200);
  assert.equal(rejoined.body.player.athletics?.questionIndex, 1);
  assert.equal(rejoined.body.player.athletics?.gateOpen, true);

  const ended = await api<{ report: { rows: Array<{ nickname: string; raceStatus?: string; raceCheckpoint?: number; raceFalls?: number }> } }>(
    `/api/sessions/${session.sessionCode}/end`,
    { method: "POST", teacherToken: teacher.token }
  );
  assert.equal(ended.response.status, 200);
  const alphaReport = ended.body.report.rows.find((row) => row.nickname === "Athletics Alpha")!;
  assert.equal(alphaReport.raceStatus, "dnf");
  assert.equal(alphaReport.raceCheckpoint, 0);
  assert.equal(typeof alphaReport.raceFalls, "number");
});

test("two-lap race keeps players independent, preserves the timer, and finishes only after the final lap", { timeout: 30_000 }, async () => {
  const teacher = await createTeacherWithQuiz();
  const session = await createSession(teacher, 2);
  assert.equal(session.settings.athleticsCourseLaps, 2);

  const human = await joinSession(session.sessionCode, "Lap Observer");
  const bots = await api<{ bots: PlayerFixture[] }>(`/api/sessions/${session.sessionCode}/bots`, {
    method: "POST",
    teacherToken: teacher.token,
    body: { count: 1, difficulty: "advanced" }
  });
  assert.equal(bots.response.status, 201);
  const botId = bots.body.bots[0]!.id;

  const started = await api<{ session: SessionFixture }>(`/api/sessions/${session.sessionCode}/start`, {
    method: "POST",
    teacherToken: teacher.token
  });
  assert.equal(started.response.status, 200);
  assert.equal(started.body.session.athletics?.requiredLaps, 2);
  assert.equal(started.body.session.athletics?.questionsPerLap, 2);
  const officialStartAt = Date.parse(started.body.session.athletics!.startAt);

  const afterFirstLap = await waitUntil(
    async () => (await api<{ session: SessionFixture }>(`/api/sessions/${session.sessionCode}`, { playerToken: human.playerToken })).body.session,
    (snapshot) => (snapshot.players.find((player) => player.id === botId)?.athletics?.completedLaps ?? 0) >= 1
  );
  const botAfterFirstLap = afterFirstLap.players.find((player) => player.id === botId)!;
  const humanAfterFirstLap = afterFirstLap.players.find((player) => player.id === human.player.id)!;
  assert.equal(botAfterFirstLap.athletics?.status, "racing");
  assert.equal(humanAfterFirstLap.athletics?.completedLaps, 0);

  const rejoined = await api<JoinedPlayer>(`/api/sessions/${session.sessionCode}/players/${human.player.id}/rejoin`, { playerToken: human.playerToken });
  assert.equal(rejoined.response.status, 200);
  assert.equal(rejoined.body.player.athletics?.completedLaps, 0);

  let lastSnapshot: SessionFixture | undefined;
  const afterFinish = await waitUntil(
    async () => {
      lastSnapshot = (await api<{ session: SessionFixture }>(`/api/sessions/${session.sessionCode}`, { playerToken: human.playerToken })).body.session;
      return lastSnapshot;
    },
    (snapshot) => snapshot.players.find((player) => player.id === botId)?.athletics?.status === "finished",
    30_000
  ).catch((error: unknown) => {
    const bot = lastSnapshot?.players.find((player) => player.id === botId);
    throw new Error(`${error instanceof Error ? error.message : "Athletics race progress failed."} Last bot state: ${JSON.stringify({ bot, athletics: lastSnapshot?.athletics, status: lastSnapshot?.status })}`);
  });
  const finishedBot = afterFinish.players.find((player) => player.id === botId)!;
  assert.equal(finishedBot.athletics?.completedLaps, 2);
  assert.equal(afterFinish.athletics?.finishOrder.filter((playerId) => playerId === botId).length, 1);
  assert.ok(Date.now() >= officialStartAt);
});

test("three-lap race completes every lap without duplicating or underflowing energy", { timeout: 75_000 }, async () => {
  const teacher = await createTeacherWithQuiz();
  const session = await createSession(teacher, 3);
  const human = await joinSession(session.sessionCode, "Three Lap Observer");
  const bots = await api<{ bots: PlayerFixture[] }>(`/api/sessions/${session.sessionCode}/bots`, {
    method: "POST",
    teacherToken: teacher.token,
    body: { count: 1, difficulty: "advanced" }
  });
  assert.equal(bots.response.status, 201);
  const botId = bots.body.bots[0]!.id;

  const started = await api<{ session: SessionFixture }>(`/api/sessions/${session.sessionCode}/start`, {
    method: "POST",
    teacherToken: teacher.token
  });
  assert.equal(started.response.status, 200);
  assert.equal(started.body.session.athletics?.requiredLaps, 3);
  assert.equal(started.body.session.athletics?.questionsPerLap, 1);

  let lastSnapshot: SessionFixture | undefined;
  const afterFinish = await waitUntil(
    async () => {
      lastSnapshot = (await api<{ session: SessionFixture }>(`/api/sessions/${session.sessionCode}`, { playerToken: human.playerToken })).body.session;
      return lastSnapshot;
    },
    (snapshot) => snapshot.players.find((player) => player.id === botId)?.athletics?.status === "finished",
    30_000
  ).catch((error: unknown) => {
    const bot = lastSnapshot?.players.find((player) => player.id === botId);
    throw new Error(`${error instanceof Error ? error.message : "Athletics race progress failed."} Last bot state: ${JSON.stringify({ bot, athletics: lastSnapshot?.athletics, status: lastSnapshot?.status })}`);
  });
  const finishedBot = afterFinish.players.find((player) => player.id === botId)!;
  assert.equal(finishedBot.athletics?.completedLaps, 3);
  assert.equal(afterFinish.athletics?.finishOrder.filter((playerId) => playerId === botId).length, 1);
  assert.ok((finishedBot.energy ?? -1) >= 0);
});
