import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { getArenaBounds, type SessionMapId } from "@quizstrike/shared";
import { addCombatMapScenery } from "./CombatMapScenery";

const maps: SessionMapId[] = ["desert_citadel", "iron_junction", "temple_runoff"];
const addMesh = (parent: THREE.Object3D, geometry: THREE.BufferGeometry, color: string) => {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color })); parent.add(mesh); return mesh;
};

for (const map of maps) test(`${map}: scenery stays outside every playable lane at all quality levels`, () => {
  const bounds = getArenaBounds(map);
  const playable = new THREE.Box3(new THREE.Vector3(-bounds.limitX + .001, -1000, -bounds.limitZ + .001),
    new THREE.Vector3(bounds.limitX - .001, 1000, bounds.limitZ - .001));
  for (const detail of [0, 1, 2]) {
    const scene = new THREE.Scene();
    const root = addCombatMapScenery(scene, map, bounds, detail, addMesh);
    root.updateMatrixWorld(true);
    let triangles = 0;
    let instancedDraws = 0;
    root.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const instance = mesh as THREE.InstancedMesh;
      const count = instance.isInstancedMesh ? instance.count : 1;
      if (instance.isInstancedMesh) instancedDraws++;
      triangles += (mesh.geometry.index?.count ?? mesh.geometry.getAttribute("position").count) / 3 * count;
      mesh.geometry.computeBoundingBox();
      for (let i = 0; i < count; i++) {
        const matrix = new THREE.Matrix4();
        if (instance.isInstancedMesh) instance.getMatrixAt(i, matrix);
        matrix.premultiply(mesh.matrixWorld);
        const footprint = mesh.geometry.boundingBox!.clone().applyMatrix4(matrix);
        assert.equal(footprint.intersectsBox(playable), false, `${mesh.name} intrudes into ${map} at detail ${detail}`);
      }
    });
    assert.ok(triangles < (detail === 0 ? 6000 : 16000), `${map} scenery triangle budget: ${triangles}`);
    assert.ok(instancedDraws <= 3, `${map} scenery must stay instanced`);
  }
});
