import assert from "node:assert/strict";
import test from "node:test";
import { createChaosWave, DEFAULT_SESSION_SETTINGS, getChaosHazardPosition, type GameSession } from "@quizstrike/shared";
import { pauseSessionForTeacher, resumeSessionForTeacher } from "./teacherPause.js";

const makeSession = (): GameSession => ({
  id: "session-1",
  teacherId: "teacher-1",
  quizSetId: "quiz-1",
  sessionCode: "ABC123",
  status: "active",
  controlState: "running",
  maxPlayers: 40,
  currentRound: 2,
  settings: { ...DEFAULT_SESSION_SETTINGS, gameMode: "flag" },
  players: [],
  roundTransition: undefined,
  startedAt: "2026-08-01T00:00:00.000Z",
  endsAt: "2026-08-01T00:03:00.000Z",
  announcement: { id: "announcement", kind: "round_start", title: "Round", message: "Live", expiresAt: "2026-08-01T00:00:20.000Z" },
  flag: {
    state: "placed",
    teamId: "red",
    position: { x: 0, y: 0, z: 0 },
    placedAtMs: Date.parse("2026-08-01T00:00:10.000Z"),
    progressStartedAtMs: Date.parse("2026-08-01T00:00:12.000Z"),
    expiresAtMs: Date.parse("2026-08-01T00:00:42.000Z")
  },
  createdAt: "2026-08-01T00:00:00.000Z"
});

test("teacher pause is explicit, idempotent, and preserves the match phase", () => {
  const session = makeSession();
  const pausedAt = Date.parse("2026-08-01T00:01:00.000Z");
  assert.deepEqual(pauseSessionForTeacher(session, pausedAt), {
    ok: true,
    changed: true,
    pausedAt: new Date(pausedAt).toISOString()
  });
  assert.equal(session.status, "active");
  assert.equal(session.controlState, "teacher_paused");
  const repeatedPause = pauseSessionForTeacher(session, pausedAt + 1000);
  assert.equal(repeatedPause.ok, true);
  if (repeatedPause.ok) assert.equal(repeatedPause.changed, false);
});

test("resume shifts every deadline by the exact paused duration", () => {
  const session = makeSession();
  const start = Date.parse("2026-08-01T00:01:00.000Z");
  pauseSessionForTeacher(session, start);
  const duration = 45_000;
  const result = resumeSessionForTeacher(session, start + duration);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.pausedDurationMs, duration);
  assert.equal(session.controlState, "running");
  assert.equal(session.teacherPausedAt, undefined);
  assert.equal(session.endsAt, "2026-08-01T00:03:45.000Z");
  assert.equal(session.announcement?.expiresAt, "2026-08-01T00:01:05.000Z");
  assert.equal(session.flag?.placedAtMs, Date.parse("2026-08-01T00:00:55.000Z"));
  assert.equal(session.flag?.expiresAtMs, Date.parse("2026-08-01T00:01:27.000Z"));
});

test("waiting and ended rooms cannot enter teacher pause mode", () => {
  for (const status of ["waiting", "ended"] as const) {
    const session = { ...makeSession(), status };
    assert.deepEqual(pauseSessionForTeacher(session), { ok: false, reason: "not_pausable" });
  }
});

test("Daruma pause preserves the remaining chant and grants a fresh stopping allowance on red-light resume", () => {
  const session = makeSession();
  const nowMs = Date.parse("2026-08-01T00:01:00.000Z");
  const iso = (offset: number) => new Date(nowMs + offset).toISOString();
  session.settings.gameMode = "athletics";
  session.athletics = {
    courseId: "stadium_loop", mode: "zeus", questionsPerLap: 3, questionCount: 3, requiredLaps: 1,
    status: "running", startAt: iso(-10_000), finishOrder: [],
    zeus: { phase: "green", attackIndex: 0, recentTargetIds: [], cycleIndex: 0, chantId: "slow", phaseStartedAt: iso(-3000), phaseEndsAt: iso(3283) }
  };
  pauseSessionForTeacher(session, nowMs);
  resumeSessionForTeacher(session, nowMs + 45_000);
  assert.equal(Date.parse(session.athletics.zeus!.phaseEndsAt!) - (nowMs + 45_000), 3283);
  session.athletics.zeus!.phase = "red";
  session.athletics.zeus!.graceEndsAt = iso(43_000);
  pauseSessionForTeacher(session, nowMs + 45_000);
  resumeSessionForTeacher(session, nowMs + 60_000);
  assert.equal(Date.parse(session.athletics.zeus!.graceEndsAt!) - (nowMs + 60_000), 650);
});

test("athletics resumes with the same warning time, hazard position and effect duration", () => {
  const session = makeSession();
  const pausedAt = Date.parse("2026-08-01T00:01:00.000Z");
  const iso = (offset: number) => new Date(pausedAt + offset).toISOString();
  const hazards = createChaosWave({ seed: 123, waveIndex: 1, nowMs: pausedAt - 3000, playerCount: 2 });
  session.settings.gameMode = "athletics";
  session.athletics = {
    courseId: "stadium_loop", questionsPerLap: 3, questionCount: 3, requiredLaps: 1,
    status: "running", startAt: iso(-60_000), finishOrder: [],
    zeus: { phase: "charging", attackIndex: 1, recentTargetIds: [], nextAttackAt: iso(9000),
      currentAttack: { id: "bolt", tier: "lower", targetIds: ["runner"], warningPositions: { runner: { x: 3, y: 4.21, z: 0 } }, warningStartedAt: iso(-1000), strikeAt: iso(1800), strikeRadius: 1.95, shockwave: false } },
    chaos: { seed: 123, waveIndex: 1, nextWaveAt: iso(8500), activeHazards: hazards,
      currentEvent: { id: "event", type: "low-gravity", label: "LOW GRAVITY", startedAt: iso(-1000), expiresAt: iso(6000) } }
  };
  session.players = [{ id: "runner", gameSessionId: session.id, nickname: "Runner", team: "blue", money: 0, isAlive: true, score: 0, correctAnswers: 0, wrongAnswers: 0, gear: "starter_blaster", joinedAt: iso(-60_000),
    athletics: { questionIndex: 0, checkpointIndex: 0, routeProgress: .1, gateOpen: true, falls: 0, lastSafeCheckpointIndex: 0, checkpointSplitsMs: [], completedLaps: 0, lapSplitsMs: [], status: "racing", zeusFrozen: true, zeusFrozenUntil: iso(2500), dashUntil: iso(500), recoverySettleUntil: iso(300), lastSupportedAtMs: pausedAt - 100 } }];
  const route = [{ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }];
  const before = getChaosHazardPosition(hazards[0]!, route, pausedAt);
  pauseSessionForTeacher(session, pausedAt);
  resumeSessionForTeacher(session, pausedAt + 45_000);
  assert.deepEqual(getChaosHazardPosition(hazards[0]!, route, pausedAt + 45_000), before);
  assert.equal(Date.parse(session.athletics.zeus!.currentAttack!.strikeAt) - (pausedAt + 45_000), 1800);
  assert.equal(Date.parse(session.athletics.zeus!.currentAttack!.warningStartedAt), pausedAt + 44_000);
  assert.equal(Date.parse(session.athletics.chaos!.nextWaveAt) - (pausedAt + 45_000), 8500);
  assert.equal(Date.parse(session.athletics.chaos!.currentEvent!.expiresAt) - (pausedAt + 45_000), 6000);
  const runner = session.players[0]!.athletics!;
  assert.equal(Date.parse(runner.zeusFrozenUntil!) - (pausedAt + 45_000), 2500);
  assert.equal(Date.parse(runner.dashUntil!) - (pausedAt + 45_000), 500);
  assert.equal(Date.parse(runner.recoverySettleUntil!) - (pausedAt + 45_000), 300);
  assert.equal(runner.lastSupportedAtMs, pausedAt + 44_900);
});
