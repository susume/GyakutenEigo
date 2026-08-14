import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import * as THREE from "three";
import { ARENA_PLAYER_EYE_HEIGHT, ARENA_SCALE } from "@quizstrike/shared";
import { blocks, cylinders } from "./templeRunoffMap";
import {
  TEMPLE_RUNOFF_ARCHITECTURE_SCALE,
  TEMPLE_RUNOFF_IMPORTED_ASSETS,
  hideTempleRunoffFallback,
  showTempleRunoffLoadFailureFallback
} from "./templeRunoffImportedAssets";
import { TEMPLE_RUNOFF_REVIEW_VIEWPOINTS } from "./templeRunoffReviewViewpoints";

test("Temple Runoff declares a compact reusable GLB architecture layer", () => {
  assert.equal(TEMPLE_RUNOFF_IMPORTED_ASSETS.length, 6);
  assert.equal(TEMPLE_RUNOFF_ARCHITECTURE_SCALE, 1);
  assert.ok(TEMPLE_RUNOFF_IMPORTED_ASSETS.every((asset) => asset.scale === TEMPLE_RUNOFF_ARCHITECTURE_SCALE));

  const paths = TEMPLE_RUNOFF_IMPORTED_ASSETS.map((asset) => asset.path);
  assert.equal(new Set(paths).size, 4, "six placements should resolve through four URL cache keys");
  assert.equal(paths.filter((path) => path.endsWith("temple-gatehouse.glb")).length, 2);
  assert.equal(paths.filter((path) => path.endsWith("sluice-headwall.glb")).length, 2);

  const gatehouses = TEMPLE_RUNOFF_IMPORTED_ASSETS.filter((asset) => asset.path.endsWith("temple-gatehouse.glb"));
  assert.deepEqual(gatehouses.map((asset) => asset.position), [[-204, 8, -92], [204, 8, 92]]);
  assert.deepEqual(gatehouses.map((asset) => asset.rotationY ?? 0), [0, Math.PI]);

  const sluices = TEMPLE_RUNOFF_IMPORTED_ASSETS.filter((asset) => asset.path.endsWith("sluice-headwall.glb"));
  assert.deepEqual(sluices.map((asset) => asset.position[0]), [-190, 190]);
  assert.deepEqual(sluices.map((asset) => asset.rotationY ?? 0), [0, Math.PI]);
});

test("Temple Runoff GLBs are embedded, browser-sized binary assets", () => {
  for (const path of new Set(TEMPLE_RUNOFF_IMPORTED_ASSETS.map((asset) => asset.path))) {
    const file = resolve(process.cwd(), "public", path.replace(/^\/assets\//, "assets/"));
    const stats = statSync(file);
    const magic = readFileSync(file).subarray(0, 4).toString("ascii");
    assert.equal(magic, "glTF", `${path} is not a binary GLB`);
    assert.ok(stats.size < 700_000, `${path} exceeds the per-asset web budget`);
  }
});

test("every hidden Temple proxy remains authoritative and has a critical fallback", () => {
  const fallbackBlocks = new Set(TEMPLE_RUNOFF_IMPORTED_ASSETS.flatMap((asset) => [...(asset.fallbackBlockIds ?? [])]));
  const fallbackCylinders = new Set(TEMPLE_RUNOFF_IMPORTED_ASSETS.flatMap((asset) => [...(asset.fallbackCylinderIds ?? [])]));
  const hiddenBlocks = blocks.filter((block) => block.visual === false);
  const hiddenCylinders = cylinders.filter((cylinder) => cylinder.visual === false);

  assert.deepEqual(
    hiddenBlocks.map((block) => block.id).sort(),
    ["blue-temple-gatehouse", "east-sluice-mouth", "red-temple-gatehouse", "west-sluice-mouth"]
  );
  hiddenBlocks.forEach((block) => {
    assert.equal(block.collides, true, `${block.id} must retain simple collision`);
    assert.ok(fallbackBlocks.has(block.id), `${block.id} needs a GLB fallback owner`);
  });
  hiddenCylinders.forEach((cylinder) => {
    assert.equal(cylinder.collides, true, `${cylinder.id} must retain simple collision`);
    assert.ok(fallbackCylinders.has(cylinder.id), `${cylinder.id} needs a GLB fallback owner`);
  });
});

test("critical load failures reveal readable proxies and successful loads hide procedural visuals", () => {
  const bridge = TEMPLE_RUNOFF_IMPORTED_ASSETS.find((asset) => asset.id === "temple-runoff-sun-bridge");
  const rainGod = TEMPLE_RUNOFF_IMPORTED_ASSETS.find((asset) => asset.id === "temple-runoff-rain-god-shrine");
  assert.ok(bridge && rainGod);
  const scene = new THREE.Scene();
  const deckFallback = new THREE.Group();
  deckFallback.name = "modular_sun-bridge-deck";
  scene.add(deckFallback);
  const rainProxy = new THREE.Mesh(new THREE.CylinderGeometry(), new THREE.MeshBasicMaterial());
  rainProxy.name = "collision_proxy_rain-god-statue";
  rainProxy.visible = false;
  scene.add(rainProxy);

  hideTempleRunoffFallback(scene, bridge);
  assert.equal(deckFallback.visible, false);
  showTempleRunoffLoadFailureFallback(scene, bridge);
  showTempleRunoffLoadFailureFallback(scene, rainGod);
  assert.equal(deckFallback.visible, true);
  assert.equal(rainProxy.visible, true);
});

test("the Sun Bridge GLB keeps only its clean deck mesh", () => {
  const bridge = TEMPLE_RUNOFF_IMPORTED_ASSETS.find((asset) => asset.id === "temple-runoff-sun-bridge");
  assert.ok(bridge);
  assert.deepEqual(bridge.visibleMeshNames, ["temple_temple_sun_stone"]);
  assert.deepEqual(bridge.fallbackBlockIds, ["sun-bridge-deck"]);
});

test("Temple review viewpoints cover all requested landmarks at FPS eye height", () => {
  assert.deepEqual(
    TEMPLE_RUNOFF_REVIEW_VIEWPOINTS.map((viewpoint) => viewpoint.id),
    ["blue-temple", "red-temple", "sun-bridge", "lower-canal", "rain-god", "jungle-ruins", "upper-terrace", "sluice-tunnels"]
  );
  for (const viewpoint of TEMPLE_RUNOFF_REVIEW_VIEWPOINTS) {
    assert.ok(Math.abs(viewpoint.position[0]) <= 235 * ARENA_SCALE);
    assert.ok(Math.abs(viewpoint.position[2]) <= 200 * ARENA_SCALE);
    assert.ok(viewpoint.position[1] >= ARENA_PLAYER_EYE_HEIGHT, `${viewpoint.id} is not at player eye height`);
  }
});
