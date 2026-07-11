import assert from "node:assert/strict";
import test from "node:test";
import type { PlayerSession } from "@quizstrike/shared";
import { groupScoreboardRows } from "./scoreboardGroups.js";

const player = (id: string, team: "blue" | "red", role: "human" | "zombie" = "human"): PlayerSession => ({
  id,
  gameSessionId: "session-1",
  nickname: id,
  team,
  role,
  money: 0,
  isAlive: true,
  score: 0,
  correctAnswers: 0,
  wrongAnswers: 0,
  gear: "starter_blaster",
  joinedAt: "2026-01-01T00:00:00.000Z"
});

test("Flag Mode groups players by Blue and Red teams even when their default role is human", () => {
  const groups = groupScoreboardRows([player("blue", "blue"), player("red", "red")], "flag");
  assert.deepEqual(groups.map((group) => group.label), ["Red Team", "Blue Team"]);
  assert.equal(groups[0].rows.length, 1);
  assert.equal(groups[1].rows.length, 1);
});

test("Zombie Mode retains Human and Zombie grouping", () => {
  const groups = groupScoreboardRows([player("human", "blue"), player("zombie", "red", "zombie")], "zombie");
  assert.deepEqual(groups.map((group) => group.label), ["Humans", "Zombies"]);
  assert.equal(groups[0].rows.length, 1);
  assert.equal(groups[1].rows.length, 1);
});
