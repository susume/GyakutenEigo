import assert from "node:assert/strict";
import test from "node:test";
import {
  ATHLETICS_BATTLE_RADIUS, ATHLETICS_BATTLE_RANGE, ATHLETICS_BATTLE_SPEED,
  getAthleticsBattleBlastPosition, getAthleticsBattleBodyContact, type AthleticsBattleBlast
} from "./athleticsBattle.js";
import { ATHLETICS_PLAYER_RADIUS } from "./athleticsRace.js";

const eye = { x: 0, y: 4.21, z: -12 };

test("blasts follow the launch ray at constant speed and stop at their maximum range", () => {
  const blast: AthleticsBattleBlast = {
    id: "straight", playerId: "shooter", origin: { x: 3, y: 4, z: 5 },
    direction: { x: 0, y: 0.6, z: -0.8 }, launchedAt: 1000, distance: 0
  };
  for (const elapsed of [-10, 0, 100, 500, 1000, 2000, 10_000]) {
    const distance = Math.min(ATHLETICS_BATTLE_RANGE, Math.max(0, elapsed) * ATHLETICS_BATTLE_SPEED / 1000);
    assert.deepEqual(getAthleticsBattleBlastPosition(blast, 1000 + elapsed), {
      x: 3, y: 4 + distance * 0.6, z: 5 - distance * 0.8
    });
  }
});

test("a direct hit sweeps to the first body contact without an oversized hit zone", () => {
  const radius = ATHLETICS_PLAYER_RADIUS + ATHLETICS_BATTLE_RADIUS;
  const contact = getAthleticsBattleBodyContact({ x: 0, y: 2, z: 0 }, { x: 0, y: 2, z: -24 }, eye)!;
  assert.ok(Math.abs(contact - (12 - radius) / 24) < 1e-8);
  assert.equal(getAthleticsBattleBodyContact({ x: radius + 0.01, y: 2, z: 0 }, { x: radius + 0.01, y: 2, z: -24 }, eye), undefined);
  assert.notEqual(getAthleticsBattleBodyContact({ x: radius - 0.01, y: 2, z: 0 }, { x: radius - 0.01, y: 2, z: -24 }, eye), undefined);
});

test("rounded shoulders reject shots through the old box corners", () => {
  assert.equal(getAthleticsBattleBodyContact({ x: 0.6, y: eye.y + 0.5, z: 0 }, { x: 0.6, y: eye.y + 0.5, z: -24 }, eye), undefined);
  assert.equal(getAthleticsBattleBodyContact({ x: 0.6, y: 0, z: 0 }, { x: 0.6, y: 0, z: -24 }, eye), undefined);
});

test("vertical and diagonal shots contact the capsule while shots above or below miss", () => {
  assert.notEqual(getAthleticsBattleBodyContact({ x: 0, y: 10, z: -12 }, { x: 0, y: -2, z: -12 }, eye), undefined);
  assert.notEqual(getAthleticsBattleBodyContact({ x: 0, y: -2, z: -12 }, { x: 0, y: 10, z: -12 }, eye), undefined);
  assert.notEqual(getAthleticsBattleBodyContact({ x: 3, y: 8, z: 0 }, { x: -3, y: -4, z: -24 }, eye), undefined);
  assert.equal(getAthleticsBattleBodyContact({ x: 0, y: 5, z: 0 }, { x: 0, y: 5, z: -24 }, eye), undefined);
  assert.equal(getAthleticsBattleBodyContact({ x: 0, y: -0.3, z: 0 }, { x: 0, y: -0.3, z: -24 }, eye), undefined);
});

test("collision respects crouching, flight distance and zero-length segments", () => {
  const crouched = { ...eye, y: 2.65 };
  assert.equal(getAthleticsBattleBodyContact({ x: 0, y: 4.21, z: 0 }, { x: 0, y: 4.21, z: -24 }, crouched, true), undefined);
  assert.notEqual(getAthleticsBattleBodyContact({ x: 0, y: 1.5, z: 0 }, { x: 0, y: 1.5, z: -24 }, crouched, true), undefined);
  assert.equal(getAthleticsBattleBodyContact({ x: 0, y: 2, z: 0 }, { x: 0, y: 2, z: -10 }, eye), undefined, "a target is not hit before the projectile reaches them");
  assert.equal(getAthleticsBattleBodyContact(eye, eye, eye), 0);
  assert.equal(getAthleticsBattleBodyContact({ x: 2, y: 2, z: -12 }, { x: 2, y: 2, z: -12 }, eye), undefined);
});
