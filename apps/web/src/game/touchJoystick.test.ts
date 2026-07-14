import assert from "node:assert/strict";
import test from "node:test";
import { resolveTouchJoystickVector } from "./touchJoystick.js";

const bounds = { left: 100, top: 200, width: 120, height: 120 };

test("touch joystick resolves all four movement directions", () => {
  const forward = resolveTouchJoystickVector(160, 200, bounds);
  const backward = resolveTouchJoystickVector(160, 320, bounds);
  const left = resolveTouchJoystickVector(100, 260, bounds);
  const right = resolveTouchJoystickVector(220, 260, bounds);

  assert.ok(forward.forward > 0.99);
  assert.ok(backward.forward < -0.99);
  assert.ok(left.right < -0.99);
  assert.ok(right.right > 0.99);
});

test("touch joystick preserves diagonal direction while clamping its radius", () => {
  const diagonal = resolveTouchJoystickVector(220, 200, bounds);

  assert.ok(diagonal.forward > 0.69);
  assert.ok(diagonal.right > 0.69);
  assert.ok(Math.hypot(diagonal.stickX, diagonal.stickY) <= 40.81);
});
