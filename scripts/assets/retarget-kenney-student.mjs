import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { createStudentBones } from "../../apps/web/src/game/characters/SharedSkinnedStudent.ts";

// Run with: node node_modules/tsx/dist/cli.mjs scripts/assets/retarget-kenney-student.mjs
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(result => { this.result = `data:${blob.type};base64,${Buffer.from(result).toString("base64")}`; this.onloadend?.(); }); }
};
const source = resolve("apps/web/public/assets/community/kenney-protagonist");
const destination = resolve("apps/web/public/assets/community/quizstrike-student");
const bytes = await readFile(join(source, "character.glb"));
const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
gltf.scene.updateMatrixWorld(true);
let original;
gltf.scene.traverse(object => { if (object.isSkinnedMesh) original = object; });
if (!original) throw new Error("Missing Kenney skinned body");
original.skeleton.update();
const geometry = original.geometry.index ? original.geometry.toNonIndexed() : original.geometry.clone();
const sourceBones = original.skeleton.bones;
const bones = createStudentBones();
const targetBones = Object.values(bones);
bones.root.updateMatrixWorld(true);
const facing = new THREE.Matrix4().makeRotationY(Math.PI);
const sourcePoint = name => {
  const bone = sourceBones.find(item => item.name === name);
  if (!bone) throw new Error(`Missing source joint ${name}`);
  return bone.getWorldPosition(new THREE.Vector3()).applyMatrix4(facing);
};
const entries = {
  Hips: ["root", [0, .76, 0]],
  Spine: ["torso", [0, .97, 0]],
  Chest: ["torso", [0, 1.15, 0]],
  UpperChest: ["torso", [0, 1.38, 0]],
  Neck: ["torso", [0, 1.64, 0]],
  Head: ["head", [0, 1.77, 0]],
  LeftArm: ["leftArm", [-.39, 1.42, 0], "LeftForeArm", "leftForearm"],
  RightArm: ["rightArm", [.39, 1.42, 0], "RightForeArm", "rightForearm"],
  LeftForeArm: ["leftForearm", [-.39, 1.06, 0], "LeftHand", "leftHand"],
  RightForeArm: ["rightForearm", [.39, 1.06, 0], "RightHand", "rightHand"],
  LeftHand: ["leftHand", [-.39, .74, -.01], "LeftHandIndex1"],
  RightHand: ["rightHand", [.39, .74, -.01], "RightHandIndex1"],
  LeftUpLeg: ["leftLeg", [-.18, .73, 0], "LeftLeg", "leftShin"],
  RightUpLeg: ["rightLeg", [.18, .73, 0], "RightLeg", "rightShin"],
  LeftLeg: ["leftShin", [-.18, .36, -.01], "LeftFoot"],
  RightLeg: ["rightShin", [.18, .36, -.01], "RightFoot"],
  LeftFoot: ["leftShin", [-.18, .06, -.01]],
  RightFoot: ["rightShin", [.18, .06, -.01]]
};
const transforms = new Map();
for (const [name, [target, anchor, child, targetChild]] of Object.entries(entries)) {
  const from = sourcePoint(name), to = new THREE.Vector3(...anchor);
  const sourceDirection = child ? sourcePoint(child).sub(from) : new THREE.Vector3(0, 1, 0);
  const targetDirection = targetChild ? bones[targetChild].getWorldPosition(new THREE.Vector3()).sub(to)
    : child ? new THREE.Vector3(0, /Hand$/.test(name) ? -.06 : -.3, 0) : new THREE.Vector3(0, 1, 0);
  const stretch = child ? targetDirection.length() / sourceDirection.length() : 1;
  sourceDirection.normalize(); targetDirection.normalize();
  transforms.set(name, { from, to, direction: sourceDirection, stretch,
    rotation: new THREE.Quaternion().setFromUnitVectors(sourceDirection, targetDirection),
    index: targetBones.indexOf(bones[target]), target });
}
const semantic = bone => {
  let joint = bone;
  while (joint && !transforms.has(joint.name)) joint = joint.parent;
  return joint?.name ?? "Hips";
};
const pos = geometry.getAttribute("position"), skinIndex = geometry.getAttribute("skinIndex"), weights = geometry.getAttribute("skinWeight");
const positions = [], indices = [], skinWeights = [], regions = [];
const point = new THREE.Vector3(), relative = new THREE.Vector3(), retargeted = new THREE.Vector3();
let removed = 0;
const dominant = vertex => {
  let slot = 0;
  for (let i = 1; i < 4; i++) if (weights.getComponent(vertex, i) > weights.getComponent(vertex, slot)) slot = i;
  return semantic(sourceBones[skinIndex.getComponent(vertex, slot)]);
};
for (let base = 0; base < pos.count; base += 3) {
  // Keep existing custom heads and selected footwear on their original sockets.
  if ([0, 1, 2].some(offset => /^(Head|LeftFoot|RightFoot)$/.test(dominant(base + offset)))) { removed++; continue; }
  for (let i = base; i < base + 3; i++) {
    point.fromBufferAttribute(pos, i);
    // FBX-derived GLB geometry includes a bind-space axis correction. Bake its rest skin first.
    const vertex = original.geometry.index ? original.geometry.index.getX(i) : i;
    original.applyBoneTransform(vertex, point);
    point.applyMatrix4(original.matrixWorld).applyMatrix4(facing);
    retargeted.set(0, 0, 0);
    const mergedWeights = new Map();
    for (let slot = 0; slot < 4; slot++) {
      const weight = weights.getComponent(i, slot);
      if (weight <= 0) continue;
      const transform = transforms.get(semantic(sourceBones[skinIndex.getComponent(i, slot)]));
      relative.copy(point).sub(transform.from);
      relative.addScaledVector(transform.direction, relative.dot(transform.direction) * (transform.stretch - 1));
      relative.applyQuaternion(transform.rotation).add(transform.to);
      retargeted.addScaledVector(relative, weight);
      mergedWeights.set(transform.index, (mergedWeights.get(transform.index) ?? 0) + weight);
    }
    positions.push(...retargeted.toArray());
    const sorted = [...mergedWeights].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = sorted.reduce((total, item) => total + item[1], 0);
    for (let slot = 0; slot < 4; slot++) { indices.push(sorted[slot]?.[0] ?? 0); skinWeights.push((sorted[slot]?.[1] ?? 0) / sum); }
    const joint = dominant(i);
    // One draw, vertex-colored jersey, trousers, skin and gloves; no per-player atlas.
    regions.push(/^(Spine|Chest|UpperChest|LeftArm|RightArm)$/.test(joint) ? 0
      : /ForeArm|Neck/.test(joint) ? 2 : /Hand/.test(joint) ? 3 : 1);
  }
}
const output = new THREE.BufferGeometry();
output.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
output.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(indices, 4));
output.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeights, 4));
output.setAttribute("qs_region", new THREE.Float32BufferAttribute(regions, 1));
output.computeVertexNormals(); output.computeBoundingBox(); output.computeBoundingSphere();
const mesh = new THREE.SkinnedMesh(output, new THREE.MeshStandardMaterial({ roughness: .85, color: "#ffffff" }));
mesh.name = "quizstrike_community_student";
mesh.add(bones.root); mesh.bind(new THREE.Skeleton(targetBones));
const result = Buffer.from(await new GLTFExporter().parseAsync(mesh, { binary: true }));
await mkdir(destination, { recursive: true });
await writeFile(join(destination, "student.glb"), result);
await copyFile(join(source, "LICENSE.txt"), join(destination, "LICENSE.txt"));
await writeFile(join(destination, "provenance.json"), JSON.stringify({
  source: "https://kenney.nl/assets/animated-characters-protagonists", license: "CC0-1.0",
  inputSha256: createHash("sha256").update(bytes).digest("hex"),
  sha256: createHash("sha256").update(result).digest("hex"),
  modifications: ["Retargeted rest geometry and skin weights to QuizStrike's 13-bone gameplay skeleton", "Removed source head and feet for existing customization", "Semantic vertex regions replace texture atlas"],
  importer: "scripts/assets/retarget-kenney-student.mjs", triangles: positions.length / 9, removedTriangles: removed, bytes: result.length
}, null, 2) + "\n");
console.log(`Retargeted body: ${positions.length / 9} triangles, ${result.length} bytes`);
