import test from "node:test";
import assert from "node:assert/strict";
import { isFireKeyboardEvent, isScopeKeyboardEvent, resolveCombatPointerAction, shouldFireFromTouchGesture } from "./arenaInput.js";

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
  assert.equal(isScopeKeyboardEvent({ code: "KeyE", key: "e" }), false);
});

test("a short touch tap fires while a look swipe does not", () => {
  assert.equal(shouldFireFromTouchGesture({ distance: 7, durationMs: 180 }), true);
  assert.equal(shouldFireFromTouchGesture({ distance: 42, durationMs: 180 }), false);
});
