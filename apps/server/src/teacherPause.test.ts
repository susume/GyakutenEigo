import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SESSION_SETTINGS, type GameSession } from "@quizstrike/shared";
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
