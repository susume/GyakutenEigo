import assert from "node:assert/strict";
import test from "node:test";
import { resolveProjectileTarget } from "@quizstrike/shared";
import { PlayerPositionHistory } from "./playerPositionHistory.js";

test("player position history returns the oldest sample inside the rewind window", () => {
  const history = new PlayerPositionHistory(350);
  history.record("moving-student", { x: 0, z: 0 }, 1000);
  history.record("moving-student", { x: 3, y: 2, z: 0 }, 1180);
  history.record("moving-student", { x: 7, y: 2, z: 0 }, 1360);

  assert.deepEqual(history.rewind("moving-student", 1400), { x: 3, y: 2, z: 0 });
});

test("player position history is bounded and can be cleared", () => {
  const history = new PlayerPositionHistory(350, 3);
  for (let index = 0; index < 8; index += 1) {
    history.record("student", { x: index, z: 0 }, 1000 + index * 10);
  }
  assert.deepEqual(history.rewind("student", 1080), { x: 5, y: undefined, z: 0 });
  assert.equal(history.rewind("student", 1500), undefined);
  history.clear("student");
  assert.equal(history.rewind("student", 1080), undefined);
});

test("a human target crossing the shot line is validated against recent movement", () => {
  const history = new PlayerPositionHistory(350);
  history.record("target", { x: 5, y: 0, z: 0 }, 1000);
  history.record("target", { x: 5, y: 0, z: 4 }, 1250);
  const previous = history.rewind("target", 1300)!;

  assert.deepEqual(resolveProjectileTarget({
    attacker: { id: "attacker", team: "blue", isAlive: true, x: 0, y: 0, z: 0, facing: -Math.PI / 2 },
    candidates: [{
      id: "target",
      team: "red",
      isAlive: true,
      isBot: false,
      x: 5,
      y: 0,
      z: 4,
      previousX: previous.x,
      previousY: previous.y,
      previousZ: previous.z
    }],
    obstacles: [],
    range: 10,
    hitRadius: 0.6
  }), { ok: true, targetId: "target" });
});
