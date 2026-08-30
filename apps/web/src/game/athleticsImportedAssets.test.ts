import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import * as THREE from "three";
import {
  ATHLETICS_IMPORTED_ASSETS,
  hideAthleticsImportedAssetFallback
} from "./athleticsImportedAssets";

test("Athletics declares a small, lazy attraction asset set", () => {
  assert.equal(ATHLETICS_IMPORTED_ASSETS.length, 10);
  assert.equal(new Set(ATHLETICS_IMPORTED_ASSETS.map((asset) => asset.path)).size, 8);
  assert.ok(ATHLETICS_IMPORTED_ASSETS.every((asset) => asset.path.endsWith(".glb")));
  assert.ok(ATHLETICS_IMPORTED_ASSETS.every((asset) => asset.minimumDetail >= 0));
  assert.ok(ATHLETICS_IMPORTED_ASSETS.every((asset) => asset.fallbackObjectNames?.length));

  const ferris = ATHLETICS_IMPORTED_ASSETS.find((asset) => asset.id === "athletics-ferris-wheel");
  assert.deepEqual(ferris?.position, [-78, 69, 43]);
  assert.equal(ferris?.scale, 52);
  assert.equal(ferris?.rotationY, Math.PI / 2);

  const supports = ATHLETICS_IMPORTED_ASSETS.filter((asset) => asset.id.includes("coaster-support"));
  assert.equal(supports.length, 2);
  assert.ok(supports.every((asset) => asset.minimumDetail === 1));
});

test("Athletics GLB outputs are embedded binary files within the scenery budget", () => {
  const paths = new Set(ATHLETICS_IMPORTED_ASSETS.map((asset) => asset.path));
  let totalBytes = 0;
  for (const path of paths) {
    const file = resolve(process.cwd(), "public", path.replace(/^\/assets\//, "assets/"));
    const stats = statSync(file);
    totalBytes += stats.size;
    assert.equal(readFileSync(file).subarray(0, 4).toString("ascii"), "glTF", `${path} is not a binary GLB`);
    assert.ok(stats.size < 1_000_000, `${path} exceeds the per-asset web budget`);
  }
  assert.ok(totalBytes < 1_200_000, "Athletics scenery should remain a small deferred payload");
});

test("a successful Athletics import hides only its named fallback scenery", () => {
  const scene = new THREE.Scene();
  const ferrisFallback = new THREE.Group();
  ferrisFallback.name = "athletics-fallback-ferris-wheel";
  scene.add(ferrisFallback);
  const coasterFallback = new THREE.Group();
  coasterFallback.name = "athletics-fallback-coaster";
  scene.add(coasterFallback);

  const ferris = ATHLETICS_IMPORTED_ASSETS.find((asset) => asset.id === "athletics-ferris-wheel");
  assert.ok(ferris);
  hideAthleticsImportedAssetFallback(scene, ferris);
  assert.equal(ferrisFallback.visible, false);
  assert.equal(coasterFallback.visible, true);
});
