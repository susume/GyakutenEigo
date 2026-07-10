import test from "node:test";
import assert from "node:assert/strict";
import {
  CHARACTER_STRESS_COUNTS,
  createCharacterDebugSession,
  summarizeCharacterDebugSession
} from "./CharacterDebugScenarios.js";

test("createCharacterDebugSession creates balanced stress-test players inside the arena", () => {
  const session = createCharacterDebugSession({ count: 40, tick: 12 });

  assert.equal(session.players.length, 40);
  assert.equal(session.players.filter((player) => player.team === "blue").length, 20);
  assert.equal(session.players.filter((player) => player.team === "red").length, 20);
  assert.ok(session.players.every((player) => Number.isFinite(player.x) && Number.isFinite(player.z)));
  assert.ok(session.players.every((player) => Number.isFinite(player.facing)));
});

test("createCharacterDebugSession clamps unsupported stress counts to supported presets", () => {
  assert.equal(createCharacterDebugSession({ count: 3 }).players.length, 10);
  assert.equal(createCharacterDebugSession({ count: 999 }).players.length, 60);
  assert.deepEqual(CHARACTER_STRESS_COUNTS, [10, 20, 40, 60]);
});

test("summarizeCharacterDebugSession reports team, alive, and gear coverage", () => {
  const summary = summarizeCharacterDebugSession(createCharacterDebugSession({ count: 20 }));

  assert.deepEqual(summary.teams, { blue: 10, red: 10 });
  assert.equal(summary.total, 20);
  assert.equal(summary.alive, 18);
  assert.ok(summary.gearTypes >= 4);
});
