import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { CommunityStudentBodyLibrary } from "./CommunityStudentBody";
import { createSharedSkinnedStudent } from "./SharedSkinnedStudent";
import { resolveCharacterAppearance } from "./CharacterAppearance";
import type { CharacterMaterials } from "./CharacterEquipment";

test("shipped public body adopts the gameplay rig, shares variants, and preserves selected footwear", async () => {
  const bytes = await readFile(new URL("../../../public/assets/community/quizstrike-student/student.glb", import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
  let loads = 0;
  const library = new CommunityStudentBodyLibrary(async () => { loads++; return gltf; });
  const material = new THREE.MeshStandardMaterial({ color: "#42baff" });
  const materials = Object.fromEntries(["uniform", "armor", "cloth", "accent", "dark", "visor", "skin"].map(key => [key, material])) as unknown as CharacterMaterials;
  const appearance = resolveCharacterAppearance({ team: "blue", playerId: "test", gear: "starter_blaster" });
  const first = createSharedSkinnedStudent(appearance, materials), second = createSharedSkinnedStudent(appearance, materials);
  const skeleton = first.mesh.skeleton;
  const owner = new THREE.Group();
  await Promise.all([library.attach(first.mesh, owner, materials, appearance.customization.footwearId), library.attach(second.mesh, new THREE.Group(), materials, appearance.customization.footwearId)]);
  assert.equal(owner.userData.characterModelSource, "kenney-retargeted");
  assert.equal(loads, 1);
  assert.equal(first.mesh.skeleton, skeleton);
  assert.equal(first.mesh.geometry, second.mesh.geometry);
  assert.equal(skeleton.bones.length, 13);
  assert.ok(first.mesh.geometry.getAttribute("position").count > 852 * 3, "custom shoes retained");
  const joints = first.mesh.geometry.getAttribute("skinIndex"), weights = first.mesh.geometry.getAttribute("skinWeight");
  for (let i = 0; i < joints.count; i++) {
    assert.ok([0, 1, 2, 3].every(c => joints.getComponent(i, c) < 13));
    assert.ok(Math.abs([0, 1, 2, 3].reduce((sum, c) => sum + weights.getComponent(i, c), 0) - 1) < .001);
  }
  const bounds = first.mesh.geometry.boundingBox!;
  assert.ok(bounds.max.y < 1.8 && bounds.min.y >= -.08, JSON.stringify(bounds));
  assert.ok(bounds.max.x < .8 && bounds.min.x > -.8);
  const departed = createSharedSkinnedStudent(appearance, materials), departedOwner = new THREE.Group();
  departedOwner.userData.disposed = true;
  const originalGeometry = departed.mesh.geometry;
  await library.attach(departed.mesh, departedOwner, materials, appearance.customization.footwearId);
  assert.equal(departed.mesh.geometry, originalGeometry, "late adoption must not modify a departed avatar");
  assert.equal(departedOwner.userData.characterModelSource, undefined);
  departed.mesh.skeleton.dispose();
  library.dispose(); skeleton.dispose(); second.mesh.skeleton.dispose(); material.dispose();
});
