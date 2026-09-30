import assert from "node:assert/strict";
import test from "node:test";
import { gamepadLookDelta, radialStick } from "./gamepadInput";

test("controller look is frame-rate independent at 30, 60 and 120 fps", () => {
  for (const fps of [30, 60, 120]) {
    const yaw = Array.from({ length: fps }, () => gamepadLookDelta(1, 0, 1 / fps).yaw).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(yaw + 3.3) < .00001);
  }
});
test("radial dead zone prevents drift and diagonal axes stay normalized", () => {
  assert.deepEqual(radialStick(.1, .1), { x: 0, y: 0 });
  assert.ok(Math.abs(Math.hypot(...Object.values(radialStick(1, 1))) - 1) < .00001);
  assert.deepEqual(radialStick(Number.NaN, 1), { x: 0, y: 0 });
});
test("stalls are capped and sensitivity applies equally to controller axes", () => {
  assert.deepEqual(gamepadLookDelta(1, 0, 4), gamepadLookDelta(1, 0, .05));
  assert.equal(gamepadLookDelta(1, 0, .01, 2).yaw, 2 * gamepadLookDelta(1, 0, .01).yaw);
});
