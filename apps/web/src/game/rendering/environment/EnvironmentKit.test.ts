import assert from "node:assert/strict";
import test from "node:test";
import {
  ATHLETICS_ENVIRONMENT_KIT,
  getEnvironmentKit,
  getEnvironmentKitAssets
} from "./EnvironmentKit";

test("Athletics environment kit is categorized and detail-gated", () => {
  assert.equal(getEnvironmentKit(ATHLETICS_ENVIRONMENT_KIT.id), ATHLETICS_ENVIRONMENT_KIT);
  assert.equal(ATHLETICS_ENVIRONMENT_KIT.architecture.length, 2);
  assert.equal(ATHLETICS_ENVIRONMENT_KIT.terrain.length, 5);
  assert.equal(ATHLETICS_ENVIRONMENT_KIT.props.length, 3);
  assert.equal(getEnvironmentKitAssets(ATHLETICS_ENVIRONMENT_KIT, 0).length, 4);
  assert.equal(getEnvironmentKitAssets(ATHLETICS_ENVIRONMENT_KIT, 1).length, 10);
  assert.equal(getEnvironmentKitAssets(ATHLETICS_ENVIRONMENT_KIT, 2).length, 10);
});

test("Athletics asset pack keeps the unique download set small", () => {
  const assets = getEnvironmentKitAssets(ATHLETICS_ENVIRONMENT_KIT);
  assert.equal(assets.length, 10);
  assert.equal(new Set(assets.map((asset) => asset.path)).size, 8);
  const fallbackNames = assets.flatMap((asset) => [...(asset.fallbackObjectNames ?? [])]);
  assert.equal(new Set(fallbackNames).size, fallbackNames.length, "each placement owns an independent fallback target");
  assert.ok(assets.every((asset) => asset.category));
  assert.ok(assets.every((asset) => asset.fallbackObjectNames?.length));
  assert.ok(ATHLETICS_ENVIRONMENT_KIT.budget.targetDrawCalls < 200);
  assert.ok(ATHLETICS_ENVIRONMENT_KIT.budget.targetTriangles < 400_000);
});

test("unknown environment kits fall back to procedural map art", () => {
  assert.equal(getEnvironmentKit("missing-kit"), undefined);
});
