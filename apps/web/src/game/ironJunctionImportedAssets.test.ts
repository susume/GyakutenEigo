import assert from "node:assert/strict";
import test from "node:test";
import { IRON_JUNCTION_IMPORTED_ASSETS } from "./ironJunctionImportedAssets.js";

test("Iron Junction keeps a small map-specific imported asset manifest", () => {
  assert.equal(IRON_JUNCTION_IMPORTED_ASSETS.length, 6);
  assert.equal(new Set(IRON_JUNCTION_IMPORTED_ASSETS.map((asset) => asset.id)).size, 6);
  assert.ok(IRON_JUNCTION_IMPORTED_ASSETS.every((asset) => asset.path.startsWith("/assets/arena/iron-junction/")));
  assert.ok(IRON_JUNCTION_IMPORTED_ASSETS.filter((asset) => asset.minimumDetail === 0).length >= 2);
  assert.ok(IRON_JUNCTION_IMPORTED_ASSETS.some((asset) => asset.id.includes("locomotive")));
  assert.ok(IRON_JUNCTION_IMPORTED_ASSETS.some((asset) => asset.id.includes("crane")));
  assert.ok(IRON_JUNCTION_IMPORTED_ASSETS.some((asset) => asset.id.includes("control-tower")));
  assert.ok(IRON_JUNCTION_IMPORTED_ASSETS.some((asset) => asset.fallbackObjectNames?.includes("iron_junction_control_landmark")));
});
