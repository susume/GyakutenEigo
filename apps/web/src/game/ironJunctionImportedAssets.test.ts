import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { IRON_JUNCTION_IMPORTED_ASSETS, settleIronJunctionFallbacks } from "./ironJunctionImportedAssets.js";

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

test("Low retains the complete central train and failed carriage groups retain readable cover", () => {
  const train = IRON_JUNCTION_IMPORTED_ASSETS.filter(asset => asset.fallbackBlockIds?.includes("junction-locomotive"));
  assert.equal(train.length, 2);
  assert.ok(train.every(asset => asset.minimumDetail === 0));
  for (const complete of [false, true]) {
    const scene = new THREE.Scene();
    const root = new THREE.Group(); scene.add(root);
    const body = new THREE.Group(); body.name = "modular_junction-locomotive"; scene.add(body);
    const detail = new THREE.Group(); detail.name = "detail_junction-locomotive"; scene.add(detail);
    for (const asset of train) { const model = new THREE.Group(); model.name = asset.id; root.add(model); }
    const loaded = new Set(complete ? train.map(asset => asset.id) : [train[0].id]);
    settleIronJunctionFallbacks(scene, root, train, loaded);
    assert.equal(body.visible, !complete);
    assert.equal(detail.visible, !complete);
    assert.equal(root.children.length, complete ? 2 : 0, "partial models must not replace a full cover proxy");
  }
});
