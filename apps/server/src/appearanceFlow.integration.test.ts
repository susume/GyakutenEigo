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
};

type PlayerFixture = {
  id: string;
  nickname: string;
  connectionState?: string;
  appearance?: AppearanceFixture;
};

type AppearanceFixture = {
  characterPreset: string;
  helmetStyle: string;
  helmetColor: string;
  backpackStyle: string;
  backpackColor: string;
  eyewearStyle: string;
  eyewearColor: string;
  clothingPrimaryColor: string;
  clothingSecondaryColor: string;
  shoeStyle: string;
  shoeColor: string;
  decalAssetId?: string;
  appearanceVersion: 1;
};

type JoinedPlayer = {
  session: SessionFixture;
  player: PlayerFixture;
  playerToken: string;
};

const defaultAppearance: AppearanceFixture = {
  characterPreset: "assault",
  helmetStyle: "visor",
  helmetColor: "#f4f7fb",
  backpackStyle: "flat_pack",
  backpackColor: "#18324c",
  eyewearStyle: "none",
  eyewearColor: "#343b4a",
  clothingPrimaryColor: "#174a78",
  clothingSecondaryColor: "#18324c",
  shoeStyle: "boots",
  shoeColor: "#343b4a",
  appearanceVersion: 1
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
      correctChoice: "A"
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

test.before(async () => {
  process.env.QUIZSTRIKE_NO_AUTOSTART = "true";
  process.env.JWT_SECRET = "phase-three-integration-secret";
  process.env.DATABASE_URL = " ";
  process.env.NODE_ENV = "test";
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
      presetsOnly: false,
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

  const appearance = { ...defaultAppearance, decalAssetId: uploaded.assetId };
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

  const publicState = await api<{ session: SessionFixture }>(`/api/sessions/${session.sessionCode}`);
  assert.equal(publicState.response.status, 200);
  assert.equal(
    publicState.body.session.players.find((player) => player.id === alpha.player.id)?.appearance?.decalAssetId,
    uploaded.assetId
  );

  const rejoined = await api<{ player: PlayerFixture }>(
    `/api/sessions/${session.sessionCode}/players/${alpha.player.id}/rejoin`,
    { playerToken: alpha.playerToken }
  );
  assert.equal(rejoined.response.status, 200);
  assert.deepEqual(rejoined.body.player.appearance, appearance);

  const started = await api(`/api/sessions/${session.sessionCode}/start`, {
    method: "POST",
    teacherToken: teacher.token
  });
  assert.equal(started.response.status, 200);

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

test("a 40-student room keeps bounded appearance state and rejects student 41", { timeout: 30_000 }, async () => {
  const teacher = await createTeacherWithQuiz();
  const session = await createSession(teacher, {
    maxPlayers: 40,
    characterCustomization: {
      enabled: true,
      uploadsEnabled: false,
      aiEnabled: false,
      presetsOnly: false,
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
    const appearance: AppearanceFixture = {
      ...defaultAppearance,
      characterPreset: index % 2 === 0 ? "support" : "engineer",
      helmetStyle: index % 2 === 0 ? "headset" : "rounded",
      clothingPrimaryColor: index % 2 === 0 ? "#176b5b" : "#6b3f8c"
    };
    return api(
      `/api/sessions/${session.sessionCode}/players/${student.player.id}/appearance`,
      { method: "PUT", playerToken: student.playerToken, body: { appearance } }
    );
  }));
  assert.ok(saves.every((save) => save.response.status === 200));

  const state = await api<{ session: SessionFixture }>(`/api/sessions/${session.sessionCode}`);
  assert.equal(state.response.status, 200);
  assert.equal(state.body.session.players.length, 40);
  assert.ok(state.body.session.players.every((player) => player.appearance?.appearanceVersion === 1));
  assert.equal(state.text.includes("data:image"), false);
  assert.equal(state.text.includes(onePixelPng.toString("base64")), false);

  const returning = students[17]!;
  const rejoined = await api<{ player: PlayerFixture }>(
    `/api/sessions/${session.sessionCode}/players/${returning.player.id}/rejoin`,
    { playerToken: returning.playerToken }
  );
  assert.equal(rejoined.response.status, 200);
  assert.equal(rejoined.body.player.appearance?.characterPreset, "engineer");

  const ended = await api(`/api/sessions/${session.sessionCode}/end`, {
    method: "POST",
    teacherToken: teacher.token
  });
  assert.equal(ended.response.status, 200);
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
      presetsOnly: false,
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
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.equal(activeSocketIds.size, connected.length, `${activeSocketIds.size} of ${connected.length} clients received active state.`);
  const startFanoutMs = performance.now() - startSentAt;

  const movementSenders = new Set<string>();
  let movementPayloadBytes = 0;
  connected[0]!.socket.on("player_position", (payload: { playerId?: string }) => {
    movementPayloadBytes += Buffer.byteLength(JSON.stringify(payload));
    if (payload.playerId) movementSenders.add(payload.playerId);
  });
  for (let index = 1; index < connected.length; index += 1) {
    const student = students[index]!;
    connected[index]!.socket.emit("player_position", {
      code: session.sessionCode,
      playerId: student.player.id,
      playerToken: student.playerToken,
      x: index * 0.15,
      z: index * -0.1,
      facing: index * 0.05
    });
  }
  const movementDeadline = Date.now() + 3000;
  while (movementSenders.size < 39 && Date.now() < movementDeadline) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.ok(movementSenders.size >= 35, `Only ${movementSenders.size} movement senders reached the observer.`);

  const reconnectTarget = connected.at(-1)!;
  reconnectTarget.socket.disconnect();
  await new Promise((resolve) => setTimeout(resolve, 5200));
  const disconnectedState = await api<{ session: SessionFixture }>(
    `/api/sessions/${session.sessionCode}`
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
    observedMovementPayloadBytes: movementPayloadBytes
  }));

  connected.forEach(({ socket }) => socket.disconnect());
  reconnected.socket.disconnect();
  await api(`/api/sessions/${session.sessionCode}/end`, { method: "POST", teacherToken: teacher.token });
});
