import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { getArenaBounds } from "@quizstrike/shared";
import { addLunarRelayArtPass } from "./LunarRelayArtPass.js";

test("Lunar Relay retains its landmarks within a bounded geometry budget at every quality", () => {
  const bounds = getArenaBounds("lunar_relay");
  const playable = new THREE.Box3(new THREE.Vector3(-bounds.limitX, 0, -bounds.limitZ), new THREE.Vector3(bounds.limitX, 80, bounds.limitZ));
  const starsByQuality: number[] = [];
  for (const detail of [0, 1, 2]) {
    const scene = new THREE.Scene();
    const root = addLunarRelayArtPass(scene, (parent, geometry, color) => {
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color })); parent.add(mesh); return mesh;
    }, detail);
    assert.ok(root.getObjectByName("lunar_relay_ringed_planet"));
    assert.ok(root.getObjectByName("lunar_relay_orbital_dish"));
    const stars = root.getObjectByName("lunar_relay_stars") as THREE.Points;
    starsByQuality.push(stars.geometry.getAttribute("position").count);
    root.updateMatrixWorld(true);
    let triangles = 0;
    root.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const instances = mesh as THREE.InstancedMesh;
      triangles += (mesh.geometry.index?.count ?? mesh.geometry.getAttribute("position").count) / 3 * (instances.isInstancedMesh ? instances.count : 1);
      if (mesh.name === "lunar_relay_exterior_rocks") {
        mesh.geometry.computeBoundingBox();
        for (let i = 0; i < instances.count; i++) {
          const matrix = new THREE.Matrix4(); instances.getMatrixAt(i, matrix); matrix.premultiply(mesh.matrixWorld);
          assert.equal(mesh.geometry.boundingBox!.clone().applyMatrix4(matrix).intersectsBox(playable), false);
        }
      }
    });
    assert.ok(triangles < (detail === 0 ? 8000 : 18000), `${detail}: ${triangles} art triangles`);
    root.traverse(object => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      if (Array.isArray(mesh.material)) mesh.material.forEach(material => material.dispose());
      else mesh.material?.dispose();
    });
  }
  assert.deepEqual(starsByQuality, [100, 200, 320]);
});
