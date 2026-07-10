import test from "node:test";
import assert from "node:assert/strict";
import {
  getIncomingHitDirection,
  shouldAutoOpenRespawnPractice
} from "./studentCombatFeedback.js";

test("getIncomingHitDirection maps attacker position relative to player facing", () => {
  const target = { x: 0, z: 0, facing: 0 };

  assert.equal(getIncomingHitDirection({ attacker: { x: 0, z: 10 }, target }), "front");
  assert.equal(getIncomingHitDirection({ attacker: { x: 10, z: 0 }, target }), "right");
  assert.equal(getIncomingHitDirection({ attacker: { x: 0, z: -10 }, target }), "back");
  assert.equal(getIncomingHitDirection({ attacker: { x: -10, z: 0 }, target }), "left");
});

test("getIncomingHitDirection follows the player's current facing", () => {
  assert.equal(
    getIncomingHitDirection({
      attacker: { x: 10, z: 0 },
      target: { x: 0, z: 0, facing: Math.PI / 2 }
    }),
    "front"
  );
});

test("shouldAutoOpenRespawnPractice only opens on a fresh practice-enabled knockout", () => {
  assert.equal(shouldAutoOpenRespawnPractice({ wasAlive: true, isAlive: false, canPractice: true }), true);
  assert.equal(shouldAutoOpenRespawnPractice({ wasAlive: false, isAlive: false, canPractice: true }), false);
  assert.equal(shouldAutoOpenRespawnPractice({ wasAlive: true, isAlive: false, canPractice: false }), false);
  assert.equal(shouldAutoOpenRespawnPractice({ wasAlive: true, isAlive: true, canPractice: true }), false);
});
