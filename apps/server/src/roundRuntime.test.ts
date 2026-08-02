import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SESSION_SETTINGS,
  type GameEvent,
  type GameSession,
  type GroundArenaPosition
} from "@quizstrike/shared";
import { createRoundRuntime } from "./roundRuntime.js";

const makeSession = (overrides: Partial<GameSession> = {}): GameSession => ({
  id: "session-1",
  teacherId: "teacher-1",
  quizSetId: "quiz-1",
  sessionCode: "ABC123",
  status: "active",
  maxPlayers: DEFAULT_SESSION_SETTINGS.maxPlayers,
  currentRound: 1,
  settings: { ...DEFAULT_SESSION_SETTINGS, gameMode: "classic", roundCount: 2 },
  players: [],
  createdAt: "2026-08-02T00:00:00.000Z",
  ...overrides
});

const makeRuntime = (session: GameSession, initialNowMs = Date.parse("2026-08-02T00:10:00.000Z")) => {
  const nowMs = initialNowMs;
  const broadcasts: GameSession[] = [];
  const events: GameEvent[] = [];
  let announcementId = 0;
  const now = () => new Date(nowMs).toISOString();
  const spawn: GroundArenaPosition = { x: 0, z: 0, facing: 0 };
  const runtime = createRoundRuntime({
    now,
    nowMs: () => nowMs,
    sessions: { values: () => [session] },
    ownsRoom: () => true,
    makeAnnouncement: (kind, title, message, detail, durationMs) => ({
      id: `announcement-${++announcementId}`,
      kind,
      title,
      message,
      ...(detail ? { detail } : {}),
      ...(durationMs === undefined ? {} : { expiresAt: new Date(nowMs + durationMs).toISOString() })
    }),
    appendEvent: (target, event) => {
      const created = { ...event, id: `event-${events.length + 1}`, createdAt: now() } as GameEvent;
      target.events = [...(target.events ?? []), created];
      events.push(created);
      return created;
    },
    broadcastSession: (target) => broadcasts.push(target),
    sessionSpawn: () => spawn,
    selectSessionSpawn: () => spawn,
    getBotSpawn: () => spawn,
    botMemoryById: new Map(),
    botNextAttackAt: new Map(),
    botRespawnAt: new Map(),
    botPreviousPositions: new Map(),
    botAlertsBySession: new Map(),
    purgeSessionDecals: () => undefined,
    saveSession: undefined,
    getQuizSetName: () => "Quiz Set",
    mirrorNormalized: () => undefined,
    saveSessionReport: () => undefined,
    roundResultAnnouncementMs: 100,
    gameOverAnnouncementMs: 100,
    roundPreparationMs: 100,
    zombieSelectionMs: 100,
    zombieHumanMaxEnergy: 100,
    roundStartAnnouncementMs: 100
  });
  return { runtime, broadcasts, events };
};

test("round lifecycle advances a pending round without the bot runtime", () => {
  const currentMs = Date.parse("2026-08-02T00:10:00.000Z");
  const session = makeSession({
    status: "paused",
    roundTransition: {
      nextRound: 1,
      startsAt: new Date(currentMs - 1).toISOString(),
      phase: "preparation"
    }
  });
  const { runtime, broadcasts } = makeRuntime(session, currentMs);

  runtime.advanceRounds();

  assert.equal(session.status, "active");
  assert.equal(session.roundTransition, undefined);
  assert.equal(session.announcement?.kind, "round_start");
  assert.equal(broadcasts.length, 1);
});

test("round lifecycle expires a bot-free active round", () => {
  const currentMs = Date.parse("2026-08-02T00:10:00.000Z");
  const session = makeSession({
    startedAt: new Date(currentMs - 10_000).toISOString(),
    endsAt: new Date(currentMs - 1).toISOString()
  });
  const { runtime, broadcasts } = makeRuntime(session, currentMs);

  runtime.advanceRounds();

  assert.equal(session.status, "paused");
  assert.equal(session.roundTransition?.nextRound, 2);
  assert.equal(session.roundTransition?.phase, "result");
  assert.ok(session.roundTransition?.startsAt);
  assert.equal(session.announcement?.kind, "round_result");
  assert.equal(broadcasts.length, 1);
});
