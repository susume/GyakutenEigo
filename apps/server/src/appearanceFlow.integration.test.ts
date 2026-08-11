import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { io as createSocket, type Socket as ClientSocket } from "socket.io-client";

type ServerRuntime = typeof import("./index.js");

type TeacherFixture = {
  token: string;
  quizSetId: string;
};

type SessionFixture = {
  id: string;
  sessionCode: string;
  players: PlayerFixture[];
  status?: "waiting" | "active" | "paused" | "ended";
  controlState?: "running" | "teacher_paused";
  teacherPausedAt?: string;
  learningPulse?: unknown;
};

type PlayerFixture = {
  id: string;
  nickname: string;
  team?: "red" | "blue";
  role?: "human" | "zombie";
  isAlive?: boolean;
  snowballs?: number;
  energy?: number;
  connectionState?: string;
  cosmeticXp?: number;
  x?: number;
  y?: number;
  z?: number;
  facing?: number;
  appearance?: AppearanceFixture;
};

type AppearanceFixture = {
  headStyleId: string;
  backAccessoryId: string;
  footwearId: string;
  victoryPoseId: string;
  decalAssetId?: string;
  appearanceVersion: 7;
};

type JoinedPlayer = {
  session: SessionFixture;
  player: PlayerFixture;
  playerToken: string;
  cosmeticProgressToken: string;
  question?: { id: string; correctChoice?: string; explanation?: string };
};

const defaultAppearance: AppearanceFixture = {
  headStyleId: "boy_short_hair",
  backAccessoryId: "none",
  footwearId: "runners",
  victoryPoseId: "champion",
  appearanceVersion: 7
};

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nS0AAAAASUVORK5CYII=",
  "base64"
);

let runtime: ServerRuntime;
let baseUrl = "";
let fixtureCounter = 0;

const api = async <T>(
  path: string,
  options: {
    method?: string;
    teacherToken?: string;
    playerToken?: string;
    body?: unknown;
  } = {}
) => {
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
  return { response, body: (text ? JSON.parse(text) : {}) as T, text };
};

const createTeacherWithQuiz = async (): Promise<TeacherFixture> => {
  fixtureCounter += 1;
  const signup = await api<{ token: string }>("/api/auth/signup", {
    method: "POST",
    body: {
      name: `Phase Three ${fixtureCounter}`,
      email: `phase-three-${Date.now()}-${fixtureCounter}@example.test`,
      password: "classroom-pass"
    }
  });
  assert.equal(signup.response.status, 201);

  const quiz = await api<{ quizSet: { id: string } }>("/api/quiz-sets", {
    method: "POST",
    teacherToken: signup.body.token,
    body: { title: `Integration Quiz ${fixtureCounter}` }
  });
  assert.equal(quiz.response.status, 201);

  const question = await api("/api/quiz-sets/" + quiz.body.quizSet.id + "/questions", {
    method: "POST",
    teacherToken: signup.body.token,
    body: {
      prompt: "Which answer is correct?",
      choiceA: "This one",
      choiceB: "Not this one",
      choiceC: "Still no",
      choiceD: "Nope",
      correctChoice: "A",
      explanation: "Teacher-only explanation"
    }
  });
  assert.equal(question.response.status, 201);
  return { token: signup.body.token, quizSetId: quiz.body.quizSet.id };
};

const createSession = async (
  teacher: TeacherFixture,
  settings: Record<string, unknown>
): Promise<SessionFixture> => {
  const created = await api<{ session: SessionFixture }>("/api/sessions", {
    method: "POST",
    teacherToken: teacher.token,
    body: { quizSetId: teacher.quizSetId, settings }
  });
  assert.equal(created.response.status, 201);
  return created.body.session;
};

const joinSession = async (code: string, nickname: string): Promise<JoinedPlayer> => {
  const joined = await api<JoinedPlayer>(`/api/sessions/${code}/join`, {
    method: "POST",
    body: { nickname }
  });
  assert.equal(joined.response.status, 201);
  return joined.body;
};

const waitForSessionState = (
  socket: ClientSocket,
  predicate: (session: SessionFixture & { status?: string }) => boolean,
  timeoutMs = 5000
) => new Promise<SessionFixture & { status?: string }>((resolve, reject) => {
  const timeout = setTimeout(() => {
    socket.off("session_state", onState);
    reject(new Error("Timed out waiting for Socket.IO session state."));
  }, timeoutMs);
  const onState = (session: SessionFixture & { status?: string }) => {
    if (!predicate(session)) return;
    clearTimeout(timeout);
    socket.off("session_state", onState);
    resolve(session);
  };
  socket.on("session_state", onState);
});

const connectStudentSocket = (
  sessionCode: string,
  student: JoinedPlayer
): { socket: ClientSocket; initialState: Promise<SessionFixture & { status?: string }> } => {
  const socket = createSocket(baseUrl, { autoConnect: false, transports: ["websocket"], reconnection: false });
  const initialState = Promise.race([
    waitForSessionState(socket, () => true, 10_000),
    new Promise<never>((_resolve, reject) => {
      socket.once("connect_error", (error) => reject(new Error(`Socket connection failed: ${error.message}`)));
    })
  ]);
  socket.on("connect", () => {
    socket.emit("join_session_room", {
      code: sessionCode,
      playerId: student.player.id,
      playerToken: student.playerToken
    });
  });
  socket.connect();
  return { socket, initialState };
};

const connectTeacherSocket = (
  sessionCode: string,
  teacherToken: string
): { socket: ClientSocket; initialState: Promise<SessionFixture> } => {
  const socket = createSocket(baseUrl, { autoConnect: false, transports: ["websocket"], reconnection: false });
  const initialState = waitForSessionState(socket, () => true, 10_000);
  socket.on("connect", () => {
    socket.emit("join_session_room", { code: sessionCode, teacherToken });
  });
  socket.connect();
  return { socket, initialState };
};

test.before(async () => {
  process.env.QUIZSTRIKE_NO_AUTOSTART = "true";
  process.env.JWT_SECRET = "phase-three-integration-secret";
  process.env.DATABASE_URL = " ";
  process.env.NODE_ENV = "test";
  process.env.QUIZSTRIKE_TEST_ROUND_PREPARATION_MS = "100";
  process.env.QUIZSTRIKE_TEST_ZOMBIE_SELECTION_MS = "100";
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
    await new Promise<void>((resolve, reject) => {
      runtime.server.close((error) => error ? reject(error) : resolve());
    });
  }
});

test("real HTTP appearance flow enforces identity, room scope, locking, and cleanup", { timeout: 30_000 }, async () => {
  const teacher = await createTeacherWithQuiz();
  const session = await createSession(teacher, {
    maxPlayers: 8,
    characterCustomization: {
      enabled: true,
      uploadsEnabled: true,
      aiEnabled: false,
      persistAcrossSessions: false
    }
  });
  const alpha = await joinSession(session.sessionCode, "Alpha Student");
  const bravo = await joinSession(session.sessionCode, "Bravo Student");

  const impersonation = await api(
    `/api/sessions/${session.sessionCode}/players/${alpha.player.id}/appearance`,
    { method: "PUT", playerToken: bravo.playerToken, body: { appearance: defaultAppearance } }
  );
  assert.equal(impersonation.response.status, 401);

  const progressionLocked = await api(
    `/api/sessions/${session.sessionCode}/players/${alpha.player.id}/appearance`,
    {
      method: "PUT",
      playerToken: alpha.playerToken,
      body: { appearance: { ...defaultAppearance, victoryPoseId: "power" } }
    }
  );
  assert.equal(progressionLocked.response.status, 403);

  const upload = await fetch(
    `${baseUrl}/api/sessions/${session.sessionCode}/players/${alpha.player.id}/decals`,
    {
      method: "POST",
      headers: { "Content-Type": "image/png", "X-Player-Token": alpha.playerToken },
      body: onePixelPng
    }
  );
  assert.equal(upload.status, 201);
  const uploaded = await upload.json() as { assetId: string; bytes: number };
  assert.equal(uploaded.bytes, onePixelPng.length);

  const gallery = await api<{
    assets: Array<{ assetId: string; nickname: string; byteLength: number; bytes?: unknown }>;
    totalBytes: number;
  }>(`/api/sessions/${session.sessionCode}/decals`, { teacherToken: teacher.token });
  assert.equal(gallery.response.status, 200);
  assert.equal(gallery.body.assets.length, 1);
  assert.equal(gallery.body.assets[0]?.assetId, uploaded.assetId);
  assert.equal(gallery.body.assets[0]?.nickname, "Alpha Student");
  assert.equal(gallery.body.assets[0]?.bytes, undefined);
  assert.equal(gallery.body.totalBytes, onePixelPng.length);

  const roomAsset = await fetch(`${baseUrl}/api/sessions/${session.sessionCode}/decals/${uploaded.assetId}`, {
    headers: { "X-Player-Token": bravo.playerToken }
  });
  assert.equal(roomAsset.status, 200);
  assert.deepEqual(Buffer.from(await roomAsset.arrayBuffer()), onePixelPng);

  const otherSession = await createSession(teacher, { maxPlayers: 4 });
  const outsider = await joinSession(otherSession.sessionCode, "Outside Student");
  const crossRoomAsset = await fetch(`${baseUrl}/api/sessions/${session.sessionCode}/decals/${uploaded.assetId}`, {
    headers: { "X-Player-Token": outsider.playerToken }
  });
  assert.equal(crossRoomAsset.status, 401);

  const appearance = {
    ...defaultAppearance,
    footwearId: "army_boots",
    decalAssetId: uploaded.assetId
  };
  const colourInjection = await api(
    `/api/sessions/${session.sessionCode}/players/${alpha.player.id}/appearance`,
    {
      method: "PUT",
      playerToken: alpha.playerToken,
      body: { appearance: { ...defaultAppearance, clothingPrimaryColor: "#6b3f8c" } }
    }
  );
  assert.equal(colourInjection.response.status, 400);

  const saved = await api<{ player: PlayerFixture }>(
    `/api/sessions/${session.sessionCode}/players/${alpha.player.id}/appearance`,
    { method: "PUT", playerToken: alpha.playerToken, body: { appearance } }
  );
  assert.equal(saved.response.status, 200);
  assert.deepEqual(saved.body.player.appearance, appearance);

  const rateLimited = await api(
    `/api/sessions/${session.sessionCode}/players/${alpha.player.id}/appearance`,
    { method: "PUT", playerToken: alpha.playerToken, body: { appearance } }
  );
  assert.equal(rateLimited.response.status, 429);

  const publicState = await api<{ session: SessionFixture }>(`/api/sessions/${session.sessionCode}`, { playerToken: alpha.playerToken });
  assert.equal(publicState.response.status, 200);
  assert.equal(
    publicState.body.session.players.find((player) => player.id === alpha.player.id)?.appearance?.decalAssetId,
    uploaded.assetId
  );
  assert.equal(
    publicState.body.session.players.find((player) => player.id === alpha.player.id)?.appearance?.footwearId,
    "army_boots"
  );

  const rejoined = await api<JoinedPlayer>(
    `/api/sessions/${session.sessionCode}/players/${alpha.player.id}/rejoin`,
    { playerToken: alpha.playerToken }
  );
  assert.equal(rejoined.response.status, 200);
  assert.deepEqual(rejoined.body.player.appearance, appearance);
  assert.ok(rejoined.body.question?.id);

  const started = await api(`/api/sessions/${session.sessionCode}/start`, {
    method: "POST",
    teacherToken: teacher.token
  });
  assert.equal(started.response.status, 200);

  const rejoinedDuringPreparation = await api<JoinedPlayer>(
    `/api/sessions/${session.sessionCode}/players/${alpha.player.id}/rejoin`,
    { playerToken: alpha.playerToken }
  );
  assert.equal(rejoinedDuringPreparation.response.status, 200);
  assert.ok(rejoinedDuringPreparation.body.question?.id);

  const locked = await api(
    `/api/sessions/${session.sessionCode}/players/${alpha.player.id}/appearance`,
    { method: "PUT", playerToken: alpha.playerToken, body: { appearance } }
  );
  assert.equal(locked.response.status, 423);

  const ended = await api(`/api/sessions/${session.sessionCode}/end`, {
    method: "POST",
    teacherToken: teacher.token
  });
  assert.equal(ended.response.status, 200);

  const purgedGallery = await api<{ assets: unknown[]; totalBytes: number }>(
    `/api/sessions/${session.sessionCode}/decals`,
    { teacherToken: teacher.token }
  );
  assert.equal(purgedGallery.response.status, 200);
  assert.deepEqual(purgedGallery.body.assets, []);
  assert.equal(purgedGallery.body.totalBytes, 0);

  const purgedAsset = await fetch(`${baseUrl}/api/sessions/${session.sessionCode}/decals/${uploaded.assetId}`, {
    headers: { Authorization: `Bearer ${teacher.token}` }
  });
  assert.equal(purgedAsset.status, 404);
});

test("live sessions admit late and returning students while teachers can remove players securely", { timeout: 30_000 }, async () => {
  const teacher = await createTeacherWithQuiz();
  const otherTeacher = await createTeacherWithQuiz();
  const session = await createSession(teacher, {
    maxPlayers: 8,
    gameMode: "classic",
    mapId: "iron_junction",
    roundDurationSeconds: 120
  });
  const alpha = await joinSession(session.sessionCode, "Live Alpha");
  await joinSession(session.sessionCode, "Live Bravo");

  const started = await api(`/api/sessions/${session.sessionCode}/start`, {
    method: "POST",
    teacherToken: teacher.token
  });
  assert.equal(started.response.status, 200);

  const late = await joinSession(session.sessionCode, "Late Student");
  assert.equal(late.session.players.length, 3);
  assert.equal(late.player.isAlive, true);
  assert.ok(late.player.team === "red" || late.player.team === "blue");
  assert.ok(late.question?.id);

  const alphaSocket = connectStudentSocket(session.sessionCode, alpha);
  await alphaSocket.initialState;
  alphaSocket.socket.disconnect();
  await new Promise((resolve) => setTimeout(resolve, 100));

  const returning = await api<JoinedPlayer>(`/api/sessions/${session.sessionCode}/join`, {
    method: "POST",
    body: { nickname: "Live Alpha" }
  });
  assert.equal(returning.response.status, 200);
  assert.equal(returning.body.player.id, alpha.player.id);
  assert.equal(returning.body.player.connectionState, "connected");

  const lateSocket = connectStudentSocket(session.sessionCode, late);
  await lateSocket.initialState;
  const removedNotice = new Promise<{ message?: string }>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for the removal notice.")), 5_000);
    lateSocket.socket.once("player_removed", (payload) => {
      clearTimeout(timeout);
      resolve(payload);
    });
  });

  const anonymousRemoval = await api(
    `/api/sessions/${session.sessionCode}/players/${late.player.id}`,
    { method: "DELETE" }
  );
  assert.equal(anonymousRemoval.response.status, 401);

  const otherTeacherRemoval = await api(
    `/api/sessions/${session.sessionCode}/players/${late.player.id}`,
    { method: "DELETE", teacherToken: otherTeacher.token }
  );
  assert.equal(otherTeacherRemoval.response.status, 404);

  const removed = await api<{ session: SessionFixture; removedPlayerId: string }>(
    `/api/sessions/${session.sessionCode}/players/${late.player.id}`,
    { method: "DELETE", teacherToken: teacher.token }
  );
  assert.equal(removed.response.status, 200);
  assert.equal(removed.body.removedPlayerId, late.player.id);
  assert.equal(removed.body.session.players.some((player) => player.id === late.player.id), false);
  assert.match((await removedNotice).message ?? "", /teacher removed you/i);

  const staleRejoin = await api(
    `/api/sessions/${session.sessionCode}/players/${late.player.id}/rejoin`,
    { playerToken: late.playerToken }
  );
  assert.equal(staleRejoin.response.status, 404);

  const joinedAgain = await joinSession(session.sessionCode, "Late Student");
  assert.notEqual(joinedAgain.player.id, late.player.id);
  lateSocket.socket.disconnect();

  const zombieSession = await createSession(teacher, {
    maxPlayers: 8,
    gameMode: "zombie",
    mapId: "temple_runoff",
    roundDurationSeconds: 120,
    initialZombieCount: 1
  });
  await joinSession(zombieSession.sessionCode, "Zombie Seed A");
  await joinSession(zombieSession.sessionCode, "Zombie Seed B");
  const zombieStarted = await api(`/api/sessions/${zombieSession.sessionCode}/start`, {
    method: "POST",
    teacherToken: teacher.token
  });
  assert.equal(zombieStarted.response.status, 200);
  const zombieLate = await joinSession(zombieSession.sessionCode, "Zombie Late");
  assert.equal(zombieLate.player.role, zombieLate.player.team === "red" ? "zombie" : "human");
  assert.equal(zombieLate.player.snowballs === 0, zombieLate.player.role === "human");

  const flagSession = await createSession(teacher, {
    maxPlayers: 8,
    gameMode: "flag",
    mapId: "desert_citadel",
    roundDurationSeconds: 120
  });
  await joinSession(flagSession.sessionCode, "Flag Seed");
  const flagStarted = await api(`/api/sessions/${flagSession.sessionCode}/start`, {
    method: "POST",
    teacherToken: teacher.token
  });
  assert.equal(flagStarted.response.status, 200);
  const flagLate = await joinSession(flagSession.sessionCode, "Flag Late");
  assert.equal(flagLate.player.isAlive, true);

  await Promise.all([
    api(`/api/sessions/${session.sessionCode}/end`, { method: "POST", teacherToken: teacher.token }),
    api(`/api/sessions/${zombieSession.sessionCode}/end`, { method: "POST", teacherToken: teacher.token }),
    api(`/api/sessions/${flagSession.sessionCode}/end`, { method: "POST", teacherToken: teacher.token })
  ]);
});

test("teacher pause is owner-only, blocks student commands, and is authoritative on reconnect", { timeout: 30_000 }, async () => {
  const teacher = await createTeacherWithQuiz();
  const otherTeacher = await createTeacherWithQuiz();
  const session = await createSession(teacher, {
    maxPlayers: 4,
    gameMode: "classic",
    roundDurationSeconds: 120
  });
  const student = await joinSession(session.sessionCode, "Pause Student");

  const connected = connectStudentSocket(session.sessionCode, student);
  const teacherConnection = connectTeacherSocket(session.sessionCode, teacher.token);
  await connected.initialState;
  const teacherInitialState = await teacherConnection.initialState;
  assert.equal("learningPulse" in teacherInitialState, true);
  const started = await api(`/api/sessions/${session.sessionCode}/start`, {
    method: "POST",
    teacherToken: teacher.token
  });
  assert.equal(started.response.status, 200);

  const anonymousPause = await api(`/api/sessions/${session.sessionCode}/pause`, { method: "POST" });
  assert.equal(anonymousPause.response.status, 401);
  const otherTeacherPause = await api(`/api/sessions/${session.sessionCode}/pause`, {
    method: "POST",
    teacherToken: otherTeacher.token
  });
  assert.equal(otherTeacherPause.response.status, 404);

  const paused = await api<{ session: SessionFixture; changed: boolean }>(`/api/sessions/${session.sessionCode}/pause`, {
    method: "POST",
    teacherToken: teacher.token
  });
  assert.equal(paused.response.status, 200);
  assert.equal(paused.body.changed, true);
  assert.equal(paused.body.session.controlState, "teacher_paused");
  assert.ok(paused.body.session.teacherPausedAt);

  const repeatedPause = await api<{ changed: boolean }>(`/api/sessions/${session.sessionCode}/pause`, {
    method: "POST",
    teacherToken: teacher.token
  });
  assert.equal(repeatedPause.response.status, 200);
  assert.equal(repeatedPause.body.changed, false);

  const beforePlayer = paused.body.session.players.find((player) => player.id === student.player.id)!;
  connected.socket.emit("player_position", {
    x: (beforePlayer.x ?? 0) + 20,
    y: beforePlayer.y,
    z: beforePlayer.z ?? 0,
    facing: beforePlayer.facing ?? 0
  });
  const pausedFireError = new Promise<{ error?: string }>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for paused fire rejection.")), 5_000);
    connected.socket.once("error_message", (payload) => {
      clearTimeout(timeout);
      resolve(payload);
    });
  });
  connected.socket.emit("fire_action", {
    requestId: `paused-fire-${Date.now()}`,
    x: beforePlayer.x ?? 0,
    y: beforePlayer.y,
    z: beforePlayer.z ?? 0,
    facing: beforePlayer.facing ?? 0
  });
  assert.match((await pausedFireError).error ?? "", /paused by the teacher/i);

  const blockedAnswer = await api(`/api/sessions/${session.sessionCode}/players/${student.player.id}/answer`, {
    method: "POST",
    playerToken: student.playerToken,
    body: { questionId: student.question?.id, selectedChoice: "A" }
  });
  assert.equal(blockedAnswer.response.status, 409);
  const blockedPurchase = await api(`/api/sessions/${session.sessionCode}/players/${student.player.id}/buy`, {
    method: "POST",
    playerToken: student.playerToken,
    body: { gearId: "starter_blaster" }
  });
  assert.equal(blockedPurchase.response.status, 409);

  await new Promise((resolve) => setTimeout(resolve, 100));
  const studentSnapshot = await api<{ session: SessionFixture }>(`/api/sessions/${session.sessionCode}`, {
    playerToken: student.playerToken
  });
  assert.equal(studentSnapshot.response.status, 200);
  const afterPlayer = studentSnapshot.body.session.players.find((player) => player.id === student.player.id)!;
  assert.equal(afterPlayer.x, beforePlayer.x);
  assert.equal(afterPlayer.z, beforePlayer.z);
  assert.equal("learningPulse" in studentSnapshot.body.session, false);

  connected.socket.disconnect();
  const reconnected = connectStudentSocket(session.sessionCode, student);
  const reconnectState = await reconnected.initialState;
  assert.equal(reconnectState.controlState, "teacher_paused");
  assert.equal("learningPulse" in reconnectState, false);

  const resumed = await api<{ session: SessionFixture; changed: boolean }>(`/api/sessions/${session.sessionCode}/resume`, {
    method: "POST",
    teacherToken: teacher.token
  });
  assert.equal(resumed.response.status, 200);
  assert.equal(resumed.body.changed, true);
  assert.equal(resumed.body.session.controlState, "running");
  assert.equal(resumed.body.session.teacherPausedAt, undefined);

  const publicPlayerState = new Promise<Record<string, unknown>>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for public player state.")), 5_000);
    reconnected.socket.once("player_state", (payload) => {
      clearTimeout(timeout);
      resolve(payload);
    });
  });
  const teacherPlayerState = new Promise<{ learningPulse?: { answersSubmitted?: number } }>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for teacher learning pulse.")), 5_000);
    teacherConnection.socket.once("player_state", (payload) => {
      clearTimeout(timeout);
      resolve(payload);
    });
  });
  const acceptedAnswer = await api(`/api/sessions/${session.sessionCode}/players/${student.player.id}/answer`, {
    method: "POST",
    playerToken: student.playerToken,
    body: { questionId: student.question?.id, selectedChoice: "A" }
  });
  assert.equal(acceptedAnswer.response.status, 200);
  assert.equal("learningPulse" in await publicPlayerState, false);
  assert.equal((await teacherPlayerState).learningPulse?.answersSubmitted, 1);
  reconnected.socket.disconnect();
  teacherConnection.socket.disconnect();

  await api(`/api/sessions/${session.sessionCode}/end`, { method: "POST", teacherToken: teacher.token });
});

test("a 40-student room keeps bounded appearance state and rejects student 41", { timeout: 30_000 }, async () => {
  const teacher = await createTeacherWithQuiz();
  const session = await createSession(teacher, {
    maxPlayers: 40,
    characterCustomization: {
      enabled: true,
      uploadsEnabled: false,
      aiEnabled: false,
      persistAcrossSessions: false
    }
  });

  const students = await Promise.all(
    Array.from({ length: 40 }, (_, index) => joinSession(session.sessionCode, `Student ${index + 1}`))
  );
  assert.equal(new Set(students.map((student) => student.player.id)).size, 40);

  const overflow = await api(`/api/sessions/${session.sessionCode}/join`, {
    method: "POST",
    body: { nickname: "Student 41" }
  });
  assert.equal(overflow.response.status, 400);

  const saves = await Promise.all(students.map((student, index) => {
    const footwear = ["runners", "army_boots", "skate_shoes", "basketball_shoes", "sandals", "barefoot"];
    const appearance: AppearanceFixture = {
      ...defaultAppearance,
      headStyleId: index % 2 === 0 ? "fox" : "panda",
      backAccessoryId: index % 2 === 0 ? "utility_pack" : "none",
      footwearId: footwear[index % footwear.length]
    };
    return api(
      `/api/sessions/${session.sessionCode}/players/${student.player.id}/appearance`,
      { method: "PUT", playerToken: student.playerToken, body: { appearance } }
    );
  }));
  assert.ok(saves.every((save) => save.response.status === 200));

  const state = await api<{ session: SessionFixture }>(`/api/sessions/${session.sessionCode}`, { playerToken: students[0]!.playerToken });
  assert.equal(state.response.status, 200);
  assert.equal(state.body.session.players.length, 40);
  assert.ok(state.body.session.players.every((player) => player.appearance?.appearanceVersion === 7));
  assert.equal(state.text.includes("data:image"), false);
  assert.equal(state.text.includes(onePixelPng.toString("base64")), false);

  const returning = students[17]!;
  const rejoined = await api<{ player: PlayerFixture }>(
    `/api/sessions/${session.sessionCode}/players/${returning.player.id}/rejoin`,
    { playerToken: returning.playerToken }
  );
  assert.equal(rejoined.response.status, 200);
  assert.equal(rejoined.body.player.appearance?.headStyleId, "panda");
  assert.equal(rejoined.body.player.appearance?.backAccessoryId, "none");
  assert.equal(rejoined.body.player.appearance?.footwearId, "barefoot");

  const ended = await api(`/api/sessions/${session.sessionCode}/end`, {
    method: "POST",
    teacherToken: teacher.token
  });
  assert.equal(ended.response.status, 200);
});

test("signed cosmetic progress carries quiz-earned XP into a new classroom", { timeout: 30_000 }, async () => {
  const teacher = await createTeacherWithQuiz();
  const unrelatedQuiz = await api<{ quizSet: { id: string } }>("/api/quiz-sets", {
    method: "POST",
    teacherToken: teacher.token,
    body: { title: "Unrelated quiz set" }
  });
  assert.equal(unrelatedQuiz.response.status, 201);
  const unrelatedQuestion = await api<{ question: { id: string } }>(`/api/quiz-sets/${unrelatedQuiz.body.quizSet.id}/questions`, {
    method: "POST",
    teacherToken: teacher.token,
    body: {
      prompt: "This question belongs to another set.",
      choiceA: "A",
      choiceB: "B",
      choiceC: "C",
      choiceD: "D",
      correctChoice: "A"
    }
  });
  assert.equal(unrelatedQuestion.response.status, 201);
  const firstSession = await createSession(teacher, { maxPlayers: 4, gameMode: "classic" });
  const learner = await joinSession(firstSession.sessionCode, "Progress Learner");
  const otherLearner = await joinSession(firstSession.sessionCode, "Other Learner");
  assert.ok(learner.question?.id);
  assert.equal("correctChoice" in learner.question, false);
  assert.equal("explanation" in learner.question, false);

  const unauthenticatedReport = await api(
    `/api/sessions/${firstSession.sessionCode}/players/${learner.player.id}/learning-report`
  );
  assert.equal(unauthenticatedReport.response.status, 401);
  const teacherReport = await api(
    `/api/sessions/${firstSession.sessionCode}/players/${learner.player.id}/learning-report`,
    { teacherToken: teacher.token }
  );
  assert.equal(teacherReport.response.status, 401);
  const impersonatedReport = await api(
    `/api/sessions/${firstSession.sessionCode}/players/${learner.player.id}/learning-report`,
    { playerToken: otherLearner.playerToken }
  );
  assert.equal(impersonatedReport.response.status, 401);

  const prematureReport = await api(
    `/api/sessions/${firstSession.sessionCode}/players/${learner.player.id}/learning-report`,
    { playerToken: learner.playerToken }
  );
  assert.equal(prematureReport.response.status, 409);

  const started = await api(`/api/sessions/${firstSession.sessionCode}/start`, {
    method: "POST",
    teacherToken: teacher.token
  });
  assert.equal(started.response.status, 200);

  const answered = await api<{
    cosmeticProgressToken: string;
    result: { player: PlayerFixture };
  }>(`/api/sessions/${firstSession.sessionCode}/players/${learner.player.id}/answer`, {
    method: "POST",
    playerToken: learner.playerToken,
    body: { questionId: learner.question!.id, selectedChoice: "A" }
  });
  assert.equal(answered.response.status, 200);
  assert.equal(answered.body.result.player.cosmeticXp, 100);
  assert.ok(answered.body.cosmeticProgressToken);

  const editedQuestion = await api(`/api/questions/${learner.question!.id}`, {
    method: "PUT",
    teacherToken: teacher.token,
    body: { correctChoice: "B", explanation: "Edited after the answer" }
  });
  assert.equal(editedQuestion.response.status, 200);

  const ended = await api(`/api/sessions/${firstSession.sessionCode}/end`, {
    method: "POST",
    teacherToken: teacher.token
  });
  assert.equal(ended.response.status, 200);
  const learningReport = await api<{
    learningReport: {
      studentName: string;
      sessionId: string;
      playerId: string;
      quizSet?: { id: string; title: string; questions: Array<Record<string, unknown>> };
      attempts: Array<{
        questionId: string;
        selectedChoice: string;
        correctChoice: string;
        isCorrect: boolean;
      }>;
    };
  }>(`/api/sessions/${firstSession.sessionCode}/players/${learner.player.id}/learning-report`, {
    playerToken: learner.playerToken
  });
  assert.equal(learningReport.response.status, 200);
  assert.equal(learningReport.body.learningReport.studentName, "Progress Learner");
  assert.equal(learningReport.body.learningReport.sessionId, firstSession.id);
  assert.equal(learningReport.body.learningReport.playerId, learner.player.id);
  assert.equal(learningReport.body.learningReport.quizSet?.id, teacher.quizSetId);
  assert.equal(learningReport.body.learningReport.quizSet?.questions.length, 1);
  assert.equal(
    learningReport.body.learningReport.quizSet?.questions.some((question) => question.id === unrelatedQuestion.body.question.id),
    false
  );
  assert.equal("correctChoice" in learningReport.body.learningReport.quizSet!.questions[0]!, false);
  assert.equal("explanation" in learningReport.body.learningReport.quizSet!.questions[0]!, false);
  assert.equal(learningReport.body.learningReport.attempts.length, 1);
  assert.equal(learningReport.body.learningReport.attempts[0]?.questionId, learner.question!.id);
  assert.equal(learningReport.body.learningReport.attempts[0]?.selectedChoice, "A");
  assert.equal(learningReport.body.learningReport.attempts[0]?.correctChoice, "A");
  assert.equal(learningReport.body.learningReport.attempts[0]?.isCorrect, true);
  assert.equal("moneyAwarded" in learningReport.body.learningReport.attempts[0]!, false);
  assert.equal("responseTimeMs" in learningReport.body.learningReport.attempts[0]!, false);
  assert.equal("context" in learningReport.body.learningReport.attempts[0]!, false);

  const secondSession = await createSession(teacher, { maxPlayers: 4 });
  const restored = await api<JoinedPlayer>(`/api/sessions/${secondSession.sessionCode}/join`, {
    method: "POST",
    body: {
      nickname: "Progress Learner",
      cosmeticProgressToken: answered.body.cosmeticProgressToken
    }
  });
  assert.equal(restored.response.status, 201);
  assert.equal(restored.body.player.cosmeticXp, 100);

  const crossSessionImpersonation = await api(
    `/api/sessions/${secondSession.sessionCode}/players/${restored.body.player.id}/learning-report`,
    { playerToken: learner.playerToken }
  );
  assert.equal(crossSessionImpersonation.response.status, 401);
  const secondEnded = await api(`/api/sessions/${secondSession.sessionCode}/end`, {
    method: "POST",
    teacherToken: teacher.token
  });
  assert.equal(secondEnded.response.status, 200);
  const secondReport = await api<{
    learningReport: {
      sessionId: string;
      playerId: string;
      attempts: unknown[];
      quizSet?: { id: string; questions: unknown[] };
    };
  }>(`/api/sessions/${secondSession.sessionCode}/players/${restored.body.player.id}/learning-report`, {
    playerToken: restored.body.playerToken
  });
  assert.equal(secondReport.response.status, 200);
  assert.equal(secondReport.body.learningReport.sessionId, secondSession.id);
  assert.equal(secondReport.body.learningReport.playerId, restored.body.player.id);
  assert.deepEqual(secondReport.body.learningReport.attempts, []);
  assert.equal(secondReport.body.learningReport.quizSet?.id, teacher.quizSetId);
});

test("40 authenticated Socket.IO clients receive bounded room state and movement fan-out", { timeout: 30_000 }, async (context) => {
  const teacher = await createTeacherWithQuiz();
  const session = await createSession(teacher, {
    maxPlayers: 40,
    gameMode: "classic",
    roundDurationSeconds: 120,
    characterCustomization: {
      enabled: true,
      uploadsEnabled: false,
      aiEnabled: false,
      persistAcrossSessions: false
    }
  });
  const students = await Promise.all(
    Array.from({ length: 40 }, (_, index) => joinSession(session.sessionCode, `Socket ${index + 1}`))
  );

  const unauthorized = createSocket(baseUrl, { transports: ["websocket"], reconnection: false });
  let unauthorizedReceivedState = false;
  unauthorized.on("session_state", () => { unauthorizedReceivedState = true; });
  await new Promise<void>((resolve, reject) => {
    unauthorized.once("connect_error", reject);
    unauthorized.once("connect", () => {
      unauthorized.emit("join_session_room", {
        code: session.sessionCode,
        playerId: students[0]!.player.id,
        playerToken: students[1]!.playerToken
      });
      setTimeout(resolve, 250);
    });
  });
  assert.equal(unauthorizedReceivedState, false);
  unauthorized.disconnect();

  const connectionStartedAt = performance.now();
  const connected = students.map((student) => connectStudentSocket(session.sessionCode, student));
  const initialStates = await Promise.all(connected.map((client) => client.initialState));
  const connectionMs = performance.now() - connectionStartedAt;
  assert.ok(initialStates.every((state) => state.players.length === 40));
  const largestInitialStateBytes = Math.max(...initialStates.map((state) => Buffer.byteLength(JSON.stringify(state))));
  assert.ok(largestInitialStateBytes < 128 * 1024, `Initial state was ${largestInitialStateBytes} bytes.`);
  assert.ok(initialStates.every((state) => !JSON.stringify(state).includes("data:image")));

  assert.ok(connected.every(({ socket }) => socket.connected));
  const activeSocketIds = new Set<string>();
  connected.forEach(({ socket }) => {
    socket.on("session_state", (state: SessionFixture & { status?: string }) => {
      if (state.status === "active") activeSocketIds.add(socket.id ?? "missing-id");
    });
  });
  const startSentAt = performance.now();
  const started = await api(`/api/sessions/${session.sessionCode}/start`, {
    method: "POST",
    teacherToken: teacher.token
  });
  assert.equal(started.response.status, 200);
  const activeDeadline = Date.now() + 5000;
  while (activeSocketIds.size < connected.length && Date.now() < activeDeadline) {
    runtime.advanceRounds();
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.equal(activeSocketIds.size, connected.length, `${activeSocketIds.size} of ${connected.length} clients received active state.`);
  const startFanoutMs = performance.now() - startSentAt;

  const movementSenders = new Set<string>();
  let movementPayloadBytes = 0;
  let movementBatchCount = 0;
  let observedCrouching = false;
  let observedJumping = false;
  connected[0]!.socket.on("player_positions", (payloads: Array<{
    playerId?: string;
    crouching?: boolean;
    jumping?: boolean;
  }>) => {
    movementBatchCount += 1;
    movementPayloadBytes += Buffer.byteLength(JSON.stringify(payloads));
    for (const payload of payloads) {
      if (payload.playerId) movementSenders.add(payload.playerId);
      observedCrouching ||= payload.crouching === true;
      observedJumping ||= payload.jumping === true;
    }
  });
  for (let index = 1; index < connected.length; index += 1) {
    const student = students[index]!;
    connected[index]!.socket.emit("player_position", {
      code: session.sessionCode,
      playerId: student.player.id,
      playerToken: student.playerToken,
      x: index * 0.15,
      z: index * -0.1,
      facing: index * 0.05,
      crouching: index === 1,
      jumping: index === 2
    });
  }
  const movementDeadline = Date.now() + 3000;
  while (movementSenders.size < 39 && Date.now() < movementDeadline) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.ok(movementSenders.size >= 35, `Only ${movementSenders.size} movement senders reached the observer.`);
  assert.ok(movementBatchCount <= 4, `Movement fan-out used ${movementBatchCount} socket events instead of bounded batches.`);
  assert.equal(observedCrouching, true, "The observer did not receive a crouching posture.");
  assert.equal(observedJumping, true, "The observer did not receive a jumping posture.");

  const reconnectTarget = connected.at(-1)!;
  reconnectTarget.socket.disconnect();
  await new Promise((resolve) => setTimeout(resolve, 5200));
  const disconnectedState = await api<{ session: SessionFixture }>(
    `/api/sessions/${session.sessionCode}`,
    { playerToken: students.at(-1)!.playerToken }
  );
  assert.equal(
    disconnectedState.body.session.players.find((player) => player.id === students.at(-1)!.player.id)?.connectionState,
    "disconnected"
  );
  const reconnectStartedAt = performance.now();
  const reconnected = connectStudentSocket(session.sessionCode, students.at(-1)!);
  const reconnectedState = await reconnected.initialState;
  const reconnectMs = performance.now() - reconnectStartedAt;
  assert.equal(
    reconnectedState.players.find((player) => player.id === students.at(-1)!.player.id)?.connectionState,
    "connected"
  );

  context.diagnostic(JSON.stringify({
    clients: connected.length,
    connectionMs: Math.round(connectionMs),
    startFanoutMs: Math.round(startFanoutMs),
    reconnectMs: Math.round(reconnectMs),
    largestInitialStateBytes,
    observedMovementSenders: movementSenders.size,
    movementBatchCount,
    observedMovementPayloadBytes: movementPayloadBytes
  }));

  connected.forEach(({ socket }) => socket.disconnect());
  reconnected.socket.disconnect();
  await api(`/api/sessions/${session.sessionCode}/end`, { method: "POST", teacherToken: teacher.token });
});
