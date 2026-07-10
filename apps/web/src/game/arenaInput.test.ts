import test from "node:test";
import assert from "node:assert/strict";
import { resolveCombatPointerAction } from "./arenaInput.js";

test("primary mouse press fires even while secondary scope is held", () => {
  assert.equal(resolveCombatPointerAction({ button: 0, buttons: 3 }), "fire");
});

test("secondary mouse press starts scope without blocking future fire presses", () => {
  assert.equal(resolveCombatPointerAction({ button: 2, buttons: 2 }), "scope");
});

test("non-combat pointer buttons are ignored", () => {
  assert.equal(resolveCombatPointerAction({ button: 1, buttons: 4 }), "none");
});
