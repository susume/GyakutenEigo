import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { CharacterAppearance } from "./CharacterAppearance.js";
import type { CharacterMaterials } from "./CharacterEquipment.js";

type AthleteBoneName = "root" | "torso" | "head" | "leftArm" | "rightArm" | "leftLeg" | "rightLeg";

export interface SharedSkinnedStudent {
  mesh: THREE.SkinnedMesh;
  bones: Record<AthleteBoneName, THREE.Bone>;
}

const BODY_MATERIALS = {
  uniform: 0,
  armor: 1,
  cloth: 2,
  accent: 3,
  dark: 4,
  visor: 5,
  skin: 6
} as const;

const sharedBodyGeometries = new Map<string, THREE.BufferGeometry>();
const sharedBodyMaterials = new Map<string, THREE.MeshStandardMaterial>();
const sharedBodyReferences = new Map<string, number>();
const SHARED_BODY_CACHE_LIMIT = 64;

const evictUnusedSharedBody = () => {
  if (sharedBodyGeometries.size < SHARED_BODY_CACHE_LIMIT) return;
  const unusedKey = [...sharedBodyGeometries.keys()].find((key) => (sharedBodyReferences.get(key) ?? 0) === 0);
  if (!unusedKey) return;
  sharedBodyGeometries.get(unusedKey)?.dispose();
  sharedBodyMaterials.get(unusedKey)?.dispose();
  sharedBodyGeometries.delete(unusedKey);
  sharedBodyMaterials.delete(unusedKey);
  sharedBodyReferences.delete(unusedKey);
};

const addRigidSkinning = (geometry: THREE.BufferGeometry, boneIndex: number) => {
  const count = geometry.getAttribute("position").count;
  const indices = new Uint16Array(count * 4);
  const weights = new Float32Array(count * 4);
  for (let index = 0; index < count; index += 1) {
    indices[index * 4] = boneIndex;
    weights[index * 4] = 1;
  }
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weights, 4));
  return geometry;
};

const part = (
  geometry: THREE.BufferGeometry,
  boneIndex: number,
  materialIndex: number,
  position: [number, number, number],
  scale: [number, number, number] = [1, 1, 1],
  rotation: [number, number, number] = [0, 0, 0]
) => {
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(...scale)
  );
  const next = geometry.toNonIndexed().applyMatrix4(matrix);
  next.userData.materialIndex = materialIndex;
  return addRigidSkinning(next, boneIndex);
};

const buildSharedBodyGeometry = (palette: THREE.Color[], shoeStyle: CharacterAppearance["customization"]["shoeStyle"]) => {
  const box = () => new THREE.BoxGeometry(1, 1, 1);
  const torso = () => new THREE.CylinderGeometry(0.42, 0.34, 0.78, 8);
  const limb = () => new THREE.CylinderGeometry(0.13, 0.105, 0.62, 8);
  const joint = () => new THREE.SphereGeometry(0.14, 8, 6);
  const shoeY = shoeStyle === "trainers" ? -0.06 : -0.02;
  const shoeScale: [number, number, number] = shoeStyle === "trainers" ? [0.29, 0.12, 0.39] : [0.27, 0.16, 0.36];
  const pieces = [
    part(torso(), 1, BODY_MATERIALS.uniform, [0, 1.2, 0], [1, 1, 0.82]),
    part(torso(), 1, BODY_MATERIALS.armor, [0, 1.22, -0.055], [1.04, 0.84, 0.72]),
    part(torso(), 0, BODY_MATERIALS.cloth, [0, 0.75, 0], [0.82, 0.36, 0.8]),
    part(box(), 1, BODY_MATERIALS.accent, [0, 1.28, -0.345], [0.52, 0.08, 0.035]),
    part(box(), 0, BODY_MATERIALS.dark, [0, 0.92, -0.285], [0.58, 0.07, 0.035]),
    part(new THREE.SphereGeometry(0.5, 12, 8), 2, BODY_MATERIALS.skin, [0, 1.72, -0.02], [0.35, 0.42, 0.34]),
    part(new THREE.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.72), 2, BODY_MATERIALS.armor, [0, 1.84, 0.005], [0.41, 0.22, 0.38]),
    part(box(), 2, BODY_MATERIALS.accent, [0, 1.81, -0.3], [0.42, 0.07, 0.035]),
    part(box(), 2, BODY_MATERIALS.visor, [0, 1.72, -0.34], [0.25, 0.075, 0.025]),
    part(joint(), 2, BODY_MATERIALS.dark, [-0.12, 1.72, -0.31], [0.22, 0.28, 0.14]),
    part(joint(), 2, BODY_MATERIALS.dark, [0.12, 1.72, -0.31], [0.22, 0.28, 0.14]),
    part(joint(), 1, BODY_MATERIALS.accent, [-0.46, 1.4, 0], [1.15, 0.9, 1.15]),
    part(joint(), 1, BODY_MATERIALS.accent, [0.46, 1.4, 0], [1.15, 0.9, 1.15]),
    part(limb(), 3, BODY_MATERIALS.uniform, [-0.48, 0.97, -0.02], [1, 0.92, 1], [-0.16, 0, -0.08]),
    part(joint(), 3, BODY_MATERIALS.dark, [-0.48, 0.66, -0.04], [0.85, 0.85, 0.85]),
    part(limb(), 4, BODY_MATERIALS.uniform, [0.48, 0.97, -0.02], [1, 0.94, 1], [-0.32, 0, 0.08]),
    part(joint(), 4, BODY_MATERIALS.dark, [0.48, 0.66, -0.04], [0.85, 0.85, 0.85]),
    part(limb(), 5, BODY_MATERIALS.uniform, [-0.2, 0.36, 0], [1.08, 1.02, 1.08]),
    part(box(), 5, BODY_MATERIALS.armor, [-0.2, 0.17, -0.02], [0.2, 0.2, 0.2]),
    part(box(), 5, BODY_MATERIALS.dark, [-0.2, shoeY, -0.08], shoeScale, [0.04, 0, 0]),
    part(box(), 5, BODY_MATERIALS.accent, [-0.2, -0.08, -0.25], [0.28, 0.045, 0.16]),
    part(limb(), 6, BODY_MATERIALS.uniform, [0.2, 0.36, 0], [1.08, 1.02, 1.08]),
    part(box(), 6, BODY_MATERIALS.armor, [0.2, 0.17, -0.02], [0.2, 0.2, 0.2]),
    part(box(), 6, BODY_MATERIALS.dark, [0.2, shoeY, -0.08], shoeScale, [0.04, 0, 0]),
    part(box(), 6, BODY_MATERIALS.accent, [0.2, -0.08, -0.25], [0.28, 0.045, 0.16])
  ];
  pieces.forEach((piece) => {
    const color = palette[piece.userData.materialIndex] ?? palette[0];
    const colors = new Float32Array(piece.getAttribute("position").count * 3);
    for (let index = 0; index < colors.length; index += 3) {
      colors[index] = color.r;
      colors[index + 1] = color.g;
      colors[index + 2] = color.b;
    }
    piece.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  });
  const merged = mergeGeometries(pieces, false);
  if (!merged) throw new Error("Unable to build shared student-athlete geometry.");
  merged.clearGroups();
  merged.addGroup(0, merged.getAttribute("position").count, 0);
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
};

const createBones = () => {
  const root = new THREE.Bone();
  root.name = "athlete_root";
  const torso = new THREE.Bone();
  torso.name = "athlete_torso";
  torso.position.set(0, 1.2, 0);
  const head = new THREE.Bone();
  head.name = "athlete_head";
  head.position.set(0, 0.52, -0.02);
  const leftArm = new THREE.Bone();
  leftArm.name = "athlete_arm_l";
  leftArm.position.set(-0.48, 0.02, -0.02);
  const rightArm = new THREE.Bone();
  rightArm.name = "athlete_arm_r";
  rightArm.position.set(0.48, 0.02, -0.02);
  const leftLeg = new THREE.Bone();
  leftLeg.name = "athlete_leg_l";
  leftLeg.position.set(-0.2, 0.62, 0);
  const rightLeg = new THREE.Bone();
  rightLeg.name = "athlete_leg_r";
  rightLeg.position.set(0.2, 0.62, 0);
  root.add(torso, leftLeg, rightLeg);
  torso.add(head, leftArm, rightArm);
  return { root, torso, head, leftArm, rightArm, leftLeg, rightLeg };
};

export const createSharedSkinnedStudent = (
  appearance: CharacterAppearance,
  materials: CharacterMaterials
): SharedSkinnedStudent => {
  const materialArray = [
    materials.uniform,
    materials.armor,
    materials.cloth,
    materials.accent,
    materials.dark,
    materials.visor,
    materials.skin
  ];
  const paletteKey = `${materialArray.map((material) => `#${material.color.getHexString()}`).join("-")}-${appearance.customization.shoeStyle}`;
  let geometry = sharedBodyGeometries.get(paletteKey);
  if (!geometry) {
    evictUnusedSharedBody();
    geometry = buildSharedBodyGeometry(materialArray.map((material) => material.color), appearance.customization.shoeStyle);
    sharedBodyGeometries.set(paletteKey, geometry);
  }
  let bodyMaterial = sharedBodyMaterials.get(paletteKey);
  if (!bodyMaterial) {
    bodyMaterial = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      vertexColors: true,
      roughness: 0.76,
      metalness: 0.05,
      flatShading: true
    });
    sharedBodyMaterials.set(paletteKey, bodyMaterial);
  }
  const bones = createBones();
  const mesh = new THREE.SkinnedMesh(geometry, bodyMaterial);
  mesh.name = `student_athlete_${appearance.variant}`;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.preserveSharedResources = true;
  mesh.add(bones.root);
  mesh.bind(new THREE.Skeleton(Object.values(bones)));
  mesh.frustumCulled = false;
  sharedBodyReferences.set(paletteKey, (sharedBodyReferences.get(paletteKey) ?? 0) + 1);
  let released = false;
  mesh.userData.releaseSharedStudentBody = () => {
    if (released) return;
    released = true;
    sharedBodyReferences.set(paletteKey, Math.max(0, (sharedBodyReferences.get(paletteKey) ?? 1) - 1));
  };
  return { mesh, bones };
};
