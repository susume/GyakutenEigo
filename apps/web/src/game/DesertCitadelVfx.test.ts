import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { addDesertCitadelVfx, getDesertCitadelVfxCount } from "./DesertCitadelVfx";

test("Desert Citadel waterworks VFX scales with quality without exceeding the budget", () => {
  assert.deepEqual([0, 1, 2].map(getDesertCitadelVfxCount), [1, 2, 3]);
  const scene = new THREE.Scene();
  const vfx = addDesertCitadelVfx(scene, 2);
  assert.equal(vfx.activeEffects, 5);
  assert.equal(scene.getObjectByName("desert_citadel_waterworks_vfx")?.children.length, 5);
  vfx.update(0.8);
  vfx.dispose();
  assert.equal(scene.getObjectByName("desert_citadel_waterworks_vfx"), undefined);
});
