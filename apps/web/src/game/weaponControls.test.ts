import test from "node:test";
import assert from "node:assert/strict";
import {
  cycleHeavyGunZoom,
  getWeaponFov,
  normalizeWeaponZoom,
  shouldResetWeaponZoom
} from "./weaponControls.js";

test("Heavy Snowball Launcher cycles normal, 3x, 7x, then normal zoom", () => {
  assert.equal(cycleHeavyGunZoom(0), 1);
  assert.equal(cycleHeavyGunZoom(1), 2);
  assert.equal(cycleHeavyGunZoom(2), 0);
});

test("Heavy Snowball Launcher FOV gets tighter at each zoom level", () => {
  const normal = getWeaponFov("power_blaster", 0);
  const threeTimes = getWeaponFov("power_blaster", 1);
  const sevenTimes = getWeaponFov("power_blaster", 2);
  const magnification = (fov: number) => Math.tan((normal * Math.PI) / 360) / Math.tan((fov * Math.PI) / 360);
  assert.equal(normal, 72);
  assert.ok(Math.abs(magnification(threeTimes) - 3) < 0.01);
  assert.ok(Math.abs(magnification(sevenTimes) - 7) < 0.01);
});

test("invalid Heavy Gun zoom input normalizes to a safe state", () => {
  assert.equal(normalizeWeaponZoom("power_blaster", Number.NaN), 0);
  assert.equal(cycleHeavyGunZoom(Number.NaN), 1);
  assert.equal(normalizeWeaponZoom("starter_blaster", 2), 0);
});

test("zoom safely resets on weapon switch, knockout, round end, and menu pause", () => {
  assert.equal(normalizeWeaponZoom("starter_blaster", 2), 0);
  for (const state of [
    { gearId: "starter_blaster", isAlive: true, roundActive: true, inputPaused: false, pointerLocked: true },
    { gearId: "power_blaster", isAlive: false, roundActive: true, inputPaused: false, pointerLocked: true },
    { gearId: "power_blaster", isAlive: true, roundActive: false, inputPaused: false, pointerLocked: true },
    { gearId: "power_blaster", isAlive: true, roundActive: true, inputPaused: true, pointerLocked: true },
  ]) {
    assert.equal(shouldResetWeaponZoom(state), true);
  }
  assert.equal(shouldResetWeaponZoom({
    gearId: "power_blaster",
    isAlive: true,
    roundActive: true,
    inputPaused: false,
    pointerLocked: false
  }), false);
});
