import test from "node:test";
import assert from "node:assert/strict";
import {
  FPS_CROUCH_EYE_HEIGHT,
  FPS_JUMP_APEX_HEIGHT,
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
  const jumping = getFpsBodyVerticalBounds(FPS_STANDING_EYE_HEIGHT + FPS_JUMP_APEX_HEIGHT, FPS_STANDING_EYE_HEIGHT);

  assert.ok(jumping.minY > grounded.minY);
  assert.ok(FPS_JUMP_APEX_HEIGHT > 3.2, "jump must clear the 3-unit citadel parapets");
  assert.ok(FPS_JUMP_APEX_HEIGHT < 4, "jump must not skip 5-unit combat cover");
  assert.equal(canFpsBodyClearObstacle(jumping, 3), true);
  assert.equal(canFpsBodyClearObstacle(grounded, 3), false);
});
