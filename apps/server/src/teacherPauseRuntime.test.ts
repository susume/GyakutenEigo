import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SESSION_SETTINGS, PlayerQuestionGate, type GameSession } from "@quizstrike/shared";
import { PlayerPositionHistory } from "./playerPositionHistory.js";
import { shiftTeacherPauseRuntimeTimers } from "./teacherPauseRuntime.js";

const session: GameSession = {
  id: "paused-session",
  teacherId: "teacher",
  quizSetId: "quiz",
  sessionCode: "PAUSED",
  status: "active",
  maxPlayers: 2,
  currentRound: 1,
  settings: DEFAULT_SESSION_SETTINGS,
  players: [{
    id: "paused-player",
    gameSessionId: "paused-session",
    nickname: "Paused",
    team: "blue",
    money: 0,
    isAlive: true,
    score: 0,
    correctAnswers: 0,
    wrongAnswers: 0,
    gear: "starter_blaster",
    joinedAt: "2026-08-01T00:00:00.000Z"
  }],
  createdAt: "2026-08-01T00:00:00.000Z"
};

test("resuming one room shifts only that room's ephemeral timers", () => {
  const maps = {
    playerMoveTimestamps: new Map([["paused-player", 100], ["other-player", 200]]),
    playerNextFireAt: new Map([["paused-player", 300], ["other-player", 400]]),
    botRespawnAt: new Map([["paused-player", 500], ["other-player", 600]]),
    botNextAttackAt: new Map([["paused-player", 700], ["other-player", 800]])
  };
  const questionGate = new PlayerQuestionGate();
  questionGate.issue("paused-player", "q1", 100);
  questionGate.issue("other-player", "q1", 100);
  const positionHistory = new PlayerPositionHistory(100);
  positionHistory.record("paused-player", { x: 1, z: 0 }, 100);
  positionHistory.record("other-player", { x: 2, z: 0 }, 100);
  const memories = new Map([
    ["paused-player", { lastSeenAtMs: 100, targetCommitUntilMs: 200 }],
    ["other-player", { lastSeenAtMs: 300, targetCommitUntilMs: 400 }]
  ]);
  const alerts = new Map([
    ["PAUSED", new Map([["blue" as const, { createdAtMs: 100 }]])],
    ["OTHER", new Map([["blue" as const, { createdAtMs: 200 }]])]
  ]);

  shiftTeacherPauseRuntimeTimers({
    session,
    deltaMs: 100,
    ...maps,
    playerQuestionGate: questionGate,
    playerPositionHistory: positionHistory,
    botMemoryById: memories,
    botAlertsBySession: alerts
  });

  assert.deepEqual([...maps.playerMoveTimestamps], [["paused-player", 200], ["other-player", 200]]);
  assert.deepEqual([...maps.playerNextFireAt], [["paused-player", 400], ["other-player", 400]]);
  const pausedAnswer = questionGate.consume("paused-player", "q1", 300);
  const otherAnswer = questionGate.consume("other-player", "q1", 300);
  assert.equal(pausedAnswer.ok, true);
  assert.equal(otherAnswer.ok, true);
  if (pausedAnswer.ok) assert.equal(pausedAnswer.responseTimeMs, 100);
  if (otherAnswer.ok) assert.equal(otherAnswer.responseTimeMs, 200);
  assert.deepEqual(positionHistory.rewind("paused-player", 250), { x: 1, y: undefined, z: 0 });
  assert.equal(positionHistory.rewind("other-player", 250), undefined);
  assert.equal(memories.get("paused-player")?.lastSeenAtMs, 200);
  assert.equal(memories.get("other-player")?.lastSeenAtMs, 300);
  assert.equal(alerts.get("PAUSED")?.get("blue")?.createdAtMs, 200);
  assert.equal(alerts.get("OTHER")?.get("blue")?.createdAtMs, 200);
});
