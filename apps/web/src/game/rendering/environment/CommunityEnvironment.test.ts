import assert from "node:assert/strict";
import test from "node:test";
import { communityBackdropKit } from "./CommunityEnvironment";

test("community foliage is decorative, cacheable and outside playable bounds", () => {
  const kit = communityBackdropKit(200, 160);
  assert.equal(kit.vegetation.length, 8);
  assert.equal(new Set(kit.vegetation.map((asset) => asset.path)).size, 1);
  assert.ok(kit.vegetation.every((asset) => Math.abs(asset.position[0]) > 200 + 10 && asset.minimumDetail === 1));
  assert.equal(kit.budget.targetTriangles, 8 * 186);
  assert.equal(kit.budget.targetDrawCalls, 8 * 2);
});
