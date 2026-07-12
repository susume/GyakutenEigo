import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SESSION_SETTINGS, type GameSession, type PlayerSession } from "@quizstrike/shared";
import { getModeScoreSummary, getReadyRoomTitle, getSessionResultText } from "./sessionPresentation";

const player = (overrides: Partial<PlayerSession>): PlayerSession => ({
  id: "player",
  gameSessionId: "session",
  nickname: "Learner",
  team: "blue",
  money: 0,
  isAlive: true,
  health: 100,
  score: 0,
  correctAnswers: 0,
  wrongAnswers: 0,
  gear: "starter_blaster",
  joinedAt: "2026-07-12T00:00:00.000Z",
  ...overrides
});

const zombieSession = (overrides: Partial<GameSession> = {}): GameSession => ({
  id: "session",
  teacherId: "teacher",
  quizSetId: "quiz",
  sessionCode: "ABC123",
  status: "ended",
  maxPlayers: 20,
  settings: { ...DEFAULT_SESSION_SETTINGS, gameMode: "zombie" },
  currentRound: 1,
  players: [player({ role: "human" }), player({ id: "zombie", nickname: "Zombie", team: "red", role: "zombie" })],
  events: [],
  createdAt: "2026-07-12T00:00:00.000Z",
  ...overrides
});

test("Zombie presentation uses the authoritative survivor result and role counts", () => {
  const session = zombieSession({
    events: [{ id: "end", type: "end", message: "Humans survived until time expired.", createdAt: "2026-07-12T00:01:00.000Z" }]
  });
  assert.equal(getSessionResultText(session), "Humans survived until time expired.");
  assert.equal(getModeScoreSummary(session), "Humans 1 – Zombies 1");
});

test("Zombie presentation falls back to conversion result when no Humans remain", () => {
  assert.equal(getSessionResultText(zombieSession({ players: [player({ role: "zombie" })] })), "Zombies converted everyone.");
});

test("Zombie waiting room does not expose team terminology", () => {
  const session = zombieSession({ status: "waiting" });
  assert.equal(getReadyRoomTitle(session, session.players[0]), "Zombie Mode Ready Room");
});
