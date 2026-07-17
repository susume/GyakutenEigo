import assert from "node:assert/strict";
import test from "node:test";
import { resolveArenaQuality } from "./gamePreferences";

test("auto quality protects frame rate while preserving the medium art pass", () => {
  assert.equal(resolveArenaQuality("auto", 2), "performance");
  assert.equal(resolveArenaQuality("auto", 1), "balanced");
});

test("explicit quality preference is preserved", () => {
  assert.equal(resolveArenaQuality("performance", 3), "performance");
  assert.equal(resolveArenaQuality("high", 1), "high");
});
