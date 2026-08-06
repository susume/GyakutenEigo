import assert from "node:assert/strict";
import test from "node:test";
import { shouldScatterEdgeRocks } from "./arenaMapBuilder.js";

test("Desert Citadel keeps visible geometry fully authored instead of scattering edge rocks", () => {
  assert.equal(shouldScatterEdgeRocks(2, true), false);
  assert.equal(shouldScatterEdgeRocks(1, true), false);
  assert.equal(shouldScatterEdgeRocks(2, false), true);
});
