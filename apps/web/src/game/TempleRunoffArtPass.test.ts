import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { addTempleRunoffArtPass, getTempleRunoffVegetationCount } from "./TempleRunoffArtPass";

const addStaticMesh = (parent: THREE.Object3D, geometry: THREE.BufferGeometry, color: string) => {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color }));
  parent.add(mesh);
  return mesh;
};

test("Temple Runoff scales instanced vegetation by quality and cleans up its art groups", () => {
  assert.deepEqual([0, 1, 2].map(getTempleRunoffVegetationCount), [0, 38, 64]);
  const scene = new THREE.Scene();
  const art = addTempleRunoffArtPass(scene, addStaticMesh, 2, true);

  assert.equal(art.instancedDraws, 3);
  assert.ok(scene.getObjectByName("temple_runoff_rain_god_landmark"));
  assert.equal(scene.getObjectByName("temple_runoff_instanced_vegetation")?.children.length, 3);
  art.update(1.2);
  art.dispose();
  assert.equal(scene.getObjectByName("temple_runoff_rain_god_landmark"), undefined);
  assert.equal(scene.getObjectByName("temple_runoff_instanced_vegetation"), undefined);
});
