import assert from "node:assert/strict";
import test from "node:test";
import { shouldAddBaseBeacons, shouldScatterEdgeRocks } from "./arenaMapBuilder.js";

test("Desert Citadel keeps visible geometry fully authored instead of scattering edge rocks", () => {
  assert.equal(shouldScatterEdgeRocks(2, "desert_citadel"), false);
  assert.equal(shouldScatterEdgeRocks(1, "desert_citadel"), false);
  assert.equal(shouldScatterEdgeRocks(2, "iron_junction"), true);
  assert.equal(shouldScatterEdgeRocks(2, "temple_runoff"), false);
});

test("only Iron Junction keeps the generic team-base beacons", () => {
  assert.equal(shouldAddBaseBeacons("desert_citadel"), false);
  assert.equal(shouldAddBaseBeacons("iron_junction"), true);
  assert.equal(shouldAddBaseBeacons("temple_runoff"), false);
});
