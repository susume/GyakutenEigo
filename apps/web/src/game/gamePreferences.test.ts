import assert from "node:assert/strict";
import test from "node:test";
import { resolveArenaQuality } from "./gamePreferences";

test("auto quality selects balanced on high-density screens", () => {
  assert.equal(resolveArenaQuality("auto", 2), "balanced");
  assert.equal(resolveArenaQuality("auto", 1), "high");
});

test("explicit quality preference is preserved", () => {
  assert.equal(resolveArenaQuality("performance", 3), "performance");
  assert.equal(resolveArenaQuality("high", 1), "high");
});
