import test from "node:test";
import assert from "node:assert/strict";
import {
  ATHLETICS_CROUCH_SPEED,
  ATHLETICS_RUN_SPEED,
  isFireKeyboardEvent,
  isScopeKeyboardEvent,
  resolveAthleticsCrouching,
  resolveAthleticsMovementSpeed,
  resolveCombatPointerAction,
  shouldFireFromTouchGesture
} from "./arenaInput.js";

test("primary mouse press fires even while secondary scope is held", () => {
  assert.equal(resolveCombatPointerAction({ button: 0, buttons: 3 }), "fire");
});

test("secondary mouse press starts scope without blocking future fire presses", () => {
  assert.equal(resolveCombatPointerAction({ button: 2, buttons: 2 }), "scope");
});

test("non-combat pointer buttons are ignored", () => {
  assert.equal(resolveCombatPointerAction({ button: 1, buttons: 4 }), "none");
});

test("F is the keyboard fire shortcut", () => {
  assert.equal(isFireKeyboardEvent({ code: "KeyF", key: "f" }), true);
  assert.equal(isFireKeyboardEvent({ code: "KeyQ", key: "q" }), false);
});

test("C is the keyboard scope shortcut", () => {
  assert.equal(isScopeKeyboardEvent({ code: "KeyC", key: "c" }), true);
  assert.equal(isScopeKeyboardEvent({ code: "KeyC", key: "c", repeat: true }), false);
  assert.equal(isScopeKeyboardEvent({ code: "KeyE", key: "e" }), false);
});

test("a short touch tap fires while a look swipe does not", () => {
  assert.equal(shouldFireFromTouchGesture({ distance: 7, durationMs: 180 }), true);
  assert.equal(shouldFireFromTouchGesture({ distance: 42, durationMs: 180 }), false);
});

test("Athletics moves at full speed by default and Shift only changes posture", () => {
  assert.equal(resolveAthleticsMovementSpeed({ crouching: false, hasMovementEnergy: true }), ATHLETICS_RUN_SPEED);
  assert.equal(resolveAthleticsMovementSpeed({ crouching: true, hasMovementEnergy: true }), ATHLETICS_CROUCH_SPEED);
  assert.equal(resolveAthleticsMovementSpeed({ crouching: false, hasMovementEnergy: true, gearSpeedMultiplier: 1.2 }), ATHLETICS_RUN_SPEED * 1.2);
  assert.equal(resolveAthleticsCrouching({ shiftPressed: false }), false);
  assert.equal(resolveAthleticsCrouching({ shiftPressed: true }), true);
  assert.equal(resolveAthleticsCrouching({ shiftPressed: false, touchCrouch: true }), true);
  assert.equal(resolveAthleticsMovementSpeed({ crouching: false, hasMovementEnergy: false }), 0);
});
