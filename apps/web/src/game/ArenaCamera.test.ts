import test from "node:test";
import assert from "node:assert/strict";
import {
  DESERT_CITADEL_STAIR_FLIGHTS,
  IRON_JUNCTION_STAIR_FLIGHTS,
  TEMPLE_RUNOFF_STAIR_FLIGHTS
} from "@quizstrike/shared";
import {
  FPS_CROUCH_EYE_HEIGHT,
  FPS_JUMP_AIRTIME_SECONDS,
  FPS_JUMP_APEX_HEIGHT,
  FPS_MAX_AUTO_STEP_HEIGHT,
  FPS_STANDING_EYE_HEIGHT,
  canFpsBodyAutoStepOnto,
  canFpsBodyClearObstacle,
  findFpsSupportSurfaceY,
  getFpsBodyVerticalBounds,
  intersectsFpsBody,
  smoothFpsGroundedCameraY
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

test("FPS jump keeps its useful apex without floaty hang time", () => {
  assert.ok(FPS_JUMP_APEX_HEIGHT > 3.2);
  assert.ok(FPS_JUMP_AIRTIME_SECONDS >= 0.8);
  assert.ok(FPS_JUMP_AIRTIME_SECONDS < 0.9);
});

test("grounded camera eases over physical stair steps without changing collision height", () => {
  const firstFrame = smoothFpsGroundedCameraY(4.2, 4.87, 1 / 60);
  assert.ok(firstFrame > 4.2);
  assert.ok(firstFrame < 4.87);
  let renderedY = firstFrame;
  for (let frame = 0; frame < 30; frame += 1) {
    renderedY = smoothFpsGroundedCameraY(renderedY, 4.87, 1 / 60);
  }
  assert.ok(Math.abs(renderedY - 4.87) < 0.001);
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

test("grounded FPS body walks onto authored stair risers but not regular cover", () => {
  const grounded = getFpsBodyVerticalBounds(FPS_STANDING_EYE_HEIGHT, FPS_STANDING_EYE_HEIGHT);

  assert.equal(canFpsBodyAutoStepOnto(grounded, 0.67), true);
  assert.equal(canFpsBodyAutoStepOnto(grounded, FPS_MAX_AUTO_STEP_HEIGHT + 0.09), false);
  assert.equal(canFpsBodyAutoStepOnto(grounded, 3), false);
});

test("every authored map stair rise fits the FPS automatic step allowance", () => {
  const flights = [
    ...DESERT_CITADEL_STAIR_FLIGHTS,
    ...IRON_JUNCTION_STAIR_FLIGHTS,
    ...TEMPLE_RUNOFF_STAIR_FLIGHTS
  ];

  for (const flight of flights) {
    const rise = Math.abs(flight.endY - flight.startY) / flight.steps;
    const body = getFpsBodyVerticalBounds(
      Math.min(flight.startY, flight.endY) + FPS_STANDING_EYE_HEIGHT,
      FPS_STANDING_EYE_HEIGHT
    );
    assert.equal(
      canFpsBodyAutoStepOnto(body, Math.min(flight.startY, flight.endY) + rise),
      true,
      `${flight.id} rise ${rise.toFixed(3)} must remain walkable`
    );
  }
});

test("FPS falling movement lands on the highest crossed object surface", () => {
  const surfaces = [
    { min: { x: -2, z: -2 }, max: { x: 2, y: 2, z: 2 } },
    { min: { x: -1, z: -1 }, max: { x: 1, y: 3, z: 1 } }
  ];

  assert.equal(findFpsSupportSurfaceY(surfaces, 0, 0, 0.45, 3.3, 2.8), 3);
  assert.equal(findFpsSupportSurfaceY(surfaces, 2.6, 0, 0.45, 3.3, 2.8), undefined);
});

test("rotated Athletics footprints keep client support and body collision aligned", () => {
  const surface = {
    min: { x: -5, y: 0, z: -5 },
    max: { x: 5, y: 1, z: 5 },
    footprint: { x: 0, z: 0, width: 10, depth: 2, rotationY: Math.PI / 4 }
  };
  const bodyOnLongAxis = { min: { x: 1.6, y: 0.2, z: -2.4 }, max: { x: 2.4, y: 0.9, z: -1.6 } };
  const bodyOutsideRotatedFootprint = { min: { x: 2.8, y: 0.2, z: -0.4 }, max: { x: 3.6, y: 0.9, z: 0.4 } };

  assert.equal(intersectsFpsBody(surface, bodyOnLongAxis), true);
  assert.equal(intersectsFpsBody(surface, bodyOutsideRotatedFootprint), false);
  assert.equal(findFpsSupportSurfaceY([surface], 2, -2, 0.45, 0.7, 1.1), 1);
  assert.equal(findFpsSupportSurfaceY([surface], 3.2, 0, 0.45, 0.7, 1.1), undefined);
});
