import test from "node:test";
import assert from "node:assert/strict";
import {
  FPS_CROUCH_EYE_HEIGHT,
  FPS_STANDING_EYE_HEIGHT,
  canFpsBodyClearObstacle,
  getFpsBodyVerticalBounds
} from "./ArenaCamera.js";

test("FPS camera eye height matches the scaled arena character proportions", () => {
  assert.ok(FPS_STANDING_EYE_HEIGHT > 3.6);
  assert.ok(FPS_CROUCH_EYE_HEIGHT > 2.2);
  assert.ok(FPS_CROUCH_EYE_HEIGHT < FPS_STANDING_EYE_HEIGHT);
});

test("FPS body collider rises while jumping so low obstacles can be cleared", () => {
  const grounded = getFpsBodyVerticalBounds(FPS_STANDING_EYE_HEIGHT, FPS_STANDING_EYE_HEIGHT);
  const jumping = getFpsBodyVerticalBounds(FPS_STANDING_EYE_HEIGHT + 1.1, FPS_STANDING_EYE_HEIGHT);

  assert.ok(jumping.minY > grounded.minY);
  assert.equal(canFpsBodyClearObstacle(jumping, 0.75), true);
  assert.equal(canFpsBodyClearObstacle(grounded, 0.75), false);
});
