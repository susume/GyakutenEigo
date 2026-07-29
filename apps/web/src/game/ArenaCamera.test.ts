import test from "node:test";
import assert from "node:assert/strict";
import {
  FPS_CROUCH_EYE_HEIGHT,
  FPS_JUMP_APEX_HEIGHT,
  FPS_STANDING_EYE_HEIGHT,
  canFpsBodyClearObstacle,
  findFpsSupportSurfaceY,
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

test("FPS body collider can move while its feet rest on an object", () => {
  const objectTopY = 3;
  const supported = getFpsBodyVerticalBounds(
    objectTopY + FPS_STANDING_EYE_HEIGHT,
    FPS_STANDING_EYE_HEIGHT
  );
  const embedded = getFpsBodyVerticalBounds(
    objectTopY + FPS_STANDING_EYE_HEIGHT - 0.2,
    FPS_STANDING_EYE_HEIGHT
  );

  assert.equal(canFpsBodyClearObstacle(supported, objectTopY), true);
  assert.equal(canFpsBodyClearObstacle(embedded, objectTopY), false);
});

test("FPS falling movement lands on the highest crossed object surface", () => {
  const surfaces = [
    { min: { x: -2, z: -2 }, max: { x: 2, y: 2, z: 2 } },
    { min: { x: -1, z: -1 }, max: { x: 1, y: 3, z: 1 } }
  ];

  assert.equal(findFpsSupportSurfaceY(surfaces, 0, 0, 0.45, 3.3, 2.8), 3);
  assert.equal(findFpsSupportSurfaceY(surfaces, 2.6, 0, 0.45, 3.3, 2.8), undefined);
});
