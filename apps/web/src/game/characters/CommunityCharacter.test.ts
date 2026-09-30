import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { CommunityCharacterInstance } from "./CommunityCharacterPool";

test("imported and compressed CC0 prefab decodes, shares geometry and isolates animation skeletons", async () => {
  const bytes = await readFile(new URL("../../../public/assets/community/kenney-protagonist/character.glb", import.meta.url));
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
  assert.deepEqual(gltf.animations.map((clip) => clip.name).sort(), ["idle", "jump", "run"]);
  gltf.scene.updateMatrixWorld(true);
  const left = clone(gltf.scene), right = clone(gltf.scene);
  right.updateMatrixWorld(true);
  const meshes = (root: THREE.Object3D) => { const items: THREE.SkinnedMesh[] = []; root.traverse((object) => { if (object instanceof THREE.SkinnedMesh) items.push(object); }); return items; };
  const a = meshes(left)[0], b = meshes(right)[0];
  assert.ok(a && b);
  assert.equal(a.geometry, b.geometry);
  assert.notEqual(a.skeleton, b.skeleton);
  assert.notEqual(a.skeleton.bones[0], b.skeleton.bones[0]);
  const instance = new CommunityCharacterInstance(left, gltf.animations, () => undefined);
  instance.root.position.set(10, 4, 7);
  for (let i = 0; i < 60; i++) instance.update(1 / 60, 1);
  assert.deepEqual(instance.root.position.toArray(), [10, 4, 7]);
  assert.ok(new THREE.Box3().setFromObject(right).getSize(new THREE.Vector3()).y > 1.9);
  instance.dispose(); instance.dispose();
});
