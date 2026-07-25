import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { CharacterAppearance } from "./CharacterAppearance.js";
import type { CharacterMaterials } from "./CharacterEquipment.js";

export type AthleteBoneName =
  | "root"
  | "torso"
  | "head"
  | "leftArm"
  | "rightArm"
  | "leftLeg"
  | "rightLeg"
  | "leftForearm"
  | "rightForearm"
  | "leftHand"
  | "rightHand"
  | "leftShin"
  | "rightShin";

export interface SharedSkinnedStudent {
  mesh: THREE.SkinnedMesh;
  bones: Record<AthleteBoneName, THREE.Bone>;
}

const BONE_INDEX: Record<AthleteBoneName, number> = {
  root: 0,
  torso: 1,
  head: 2,
  leftArm: 3,
  rightArm: 4,
  leftLeg: 5,
  rightLeg: 6,
  leftForearm: 7,
  rightForearm: 8,
  leftHand: 9,
  rightHand: 10,
  leftShin: 11,
  rightShin: 12
};

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
const SHARED_BODY_CACHE_LIMIT = 32;

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
  bone: AthleteBoneName,
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
  geometry.dispose();
  next.userData.materialIndex = materialIndex;
  return addRigidSkinning(next, BONE_INDEX[bone]);
};

const capsule = (radius: number, length: number, radialSegments = 8) =>
  new THREE.CapsuleGeometry(radius, length, 4, radialSegments);

const joint = (radius: number, widthScale = 1) =>
  new THREE.SphereGeometry(radius, 10, 7).scale(widthScale, 1, 1);

const taperedLimb = (topRadius: number, bottomRadius: number, height: number) =>
  new THREE.CylinderGeometry(topRadius, bottomRadius, height, 10, 1, false);

const torsoGeometry = () => new THREE.LatheGeometry([
  new THREE.Vector2(0.27, -0.38),
  new THREE.Vector2(0.3, -0.3),
  new THREE.Vector2(0.31, -0.16),
  new THREE.Vector2(0.36, 0.08),
  new THREE.Vector2(0.39, 0.22),
  new THREE.Vector2(0.35, 0.34),
  new THREE.Vector2(0.29, 0.39)
], 12);

const pelvisGeometry = () => new THREE.LatheGeometry([
  new THREE.Vector2(0.23, -0.17),
  new THREE.Vector2(0.29, -0.11),
  new THREE.Vector2(0.31, 0.04),
  new THREE.Vector2(0.27, 0.16)
], 10);

const buildSharedBodyGeometry = (palette: THREE.Color[], shoulderBulk: number) => {
  const shoulderRadius = 0.128 * Math.min(1.18, shoulderBulk);
  const pieces = [
    // A continuous tapered chest, waist, neck, and pelvis establish a human torso.
    part(torsoGeometry(), "torso", BODY_MATERIALS.uniform, [0, 1.17, 0], [1, 1, 0.78]),
    part(pelvisGeometry(), "root", BODY_MATERIALS.cloth, [0, 0.78, 0], [1, 1, 0.86]),
    part(new THREE.CylinderGeometry(0.095, 0.105, 0.16, 10), "torso", BODY_MATERIALS.skin, [0, 1.61, 0]),
    part(new THREE.SphereGeometry(0.5, 12, 8), "torso", BODY_MATERIALS.armor, [0, 1.27, -0.245], [0.58, 0.46, 0.16]),
    part(new THREE.TorusGeometry(0.245, 0.025, 6, 16), "torso", BODY_MATERIALS.accent, [0, 1.49, -0.08], [1, 0.74, 1], [Math.PI / 2, 0, 0]),
    part(new THREE.TorusGeometry(0.28, 0.026, 6, 16), "root", BODY_MATERIALS.dark, [0, 0.9, 0], [1, 0.85, 1], [Math.PI / 2, 0, 0]),

    // Sloped shoulders, upper arms, elbows, forearms, mitten hands, and thumbs.
    part(joint(shoulderRadius, 1.08), "leftArm", BODY_MATERIALS.armor, [-0.37, 1.41, 0]),
    part(joint(shoulderRadius, 1.08), "rightArm", BODY_MATERIALS.armor, [0.37, 1.41, 0]),
    part(taperedLimb(0.105, 0.092, 0.34), "leftArm", BODY_MATERIALS.uniform, [-0.39, 1.23, 0]),
    part(taperedLimb(0.105, 0.092, 0.34), "rightArm", BODY_MATERIALS.uniform, [0.39, 1.23, 0]),
    part(joint(0.1), "leftForearm", BODY_MATERIALS.accent, [-0.39, 1.05, 0]),
    part(joint(0.1), "rightForearm", BODY_MATERIALS.accent, [0.39, 1.05, 0]),
    part(taperedLimb(0.09, 0.074, 0.28), "leftForearm", BODY_MATERIALS.uniform, [-0.39, 0.9, -0.005]),
    part(taperedLimb(0.09, 0.074, 0.28), "rightForearm", BODY_MATERIALS.uniform, [0.39, 0.9, -0.005]),
    part(capsule(0.082, 0.065, 8), "leftHand", BODY_MATERIALS.skin, [-0.39, 0.7, -0.015], [0.94, 1, 0.84]),
    part(capsule(0.082, 0.065, 8), "rightHand", BODY_MATERIALS.skin, [0.39, 0.7, -0.015], [0.94, 1, 0.84]),
    part(capsule(0.035, 0.055, 7), "leftHand", BODY_MATERIALS.skin, [-0.32, 0.72, -0.055], [1, 1, 0.9], [0.2, 0, -0.5]),
    part(capsule(0.035, 0.055, 7), "rightHand", BODY_MATERIALS.skin, [0.32, 0.72, -0.055], [1, 1, 0.9], [0.2, 0, 0.5]),
    part(new THREE.TorusGeometry(0.103, 0.018, 5, 12), "leftForearm", BODY_MATERIALS.accent, [-0.39, 0.78, -0.005], [1, 1, 0.82], [Math.PI / 2, 0, 0]),
    part(new THREE.TorusGeometry(0.103, 0.018, 5, 12), "rightForearm", BODY_MATERIALS.accent, [0.39, 0.78, -0.005], [1, 1, 0.82], [Math.PI / 2, 0, 0]),

    // Distinct thighs, knees, calves, ankles, heels, and forward-facing toes.
    part(taperedLimb(0.125, 0.145, 0.36), "leftLeg", BODY_MATERIALS.uniform, [-0.18, 0.55, 0]),
    part(taperedLimb(0.125, 0.145, 0.36), "rightLeg", BODY_MATERIALS.uniform, [0.18, 0.55, 0]),
    part(joint(0.112, 0.94), "leftShin", BODY_MATERIALS.armor, [-0.18, 0.36, -0.02]),
    part(joint(0.112, 0.94), "rightShin", BODY_MATERIALS.armor, [0.18, 0.36, -0.02]),
    part(taperedLimb(0.092, 0.108, 0.28), "leftShin", BODY_MATERIALS.uniform, [-0.18, 0.2, 0]),
    part(taperedLimb(0.092, 0.108, 0.28), "rightShin", BODY_MATERIALS.uniform, [0.18, 0.2, 0]),
    part(new THREE.CylinderGeometry(0.075, 0.08, 0.11, 9), "leftShin", BODY_MATERIALS.dark, [-0.18, 0.075, -0.005]),
    part(new THREE.CylinderGeometry(0.075, 0.08, 0.11, 9), "rightShin", BODY_MATERIALS.dark, [0.18, 0.075, -0.005]),
    part(capsule(0.095, 0.18, 9), "leftShin", BODY_MATERIALS.dark, [-0.18, 0.055, -0.14], [1.05, 1, 1], [Math.PI / 2, 0, 0.025]),
    part(capsule(0.095, 0.18, 9), "rightShin", BODY_MATERIALS.dark, [0.18, 0.055, -0.14], [1.05, 1, 1], [Math.PI / 2, 0, -0.025]),
    part(new THREE.SphereGeometry(0.085, 9, 6), "leftShin", BODY_MATERIALS.dark, [-0.18, 0.075, 0.025], [1, 0.85, 0.9]),
    part(new THREE.SphereGeometry(0.085, 9, 6), "rightShin", BODY_MATERIALS.dark, [0.18, 0.075, 0.025], [1, 0.85, 0.9]),
    part(new THREE.TorusGeometry(0.105, 0.018, 5, 12), "leftShin", BODY_MATERIALS.accent, [-0.18, 0.13, -0.015], [1, 1, 0.85], [Math.PI / 2, 0, 0]),
    part(new THREE.TorusGeometry(0.105, 0.018, 5, 12), "rightShin", BODY_MATERIALS.accent, [0.18, 0.13, -0.015], [1, 1, 0.85], [Math.PI / 2, 0, 0])
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
  if (!merged) throw new Error("Unable to build shared stylized-humanoid geometry.");
  pieces.forEach((piece) => piece.dispose());
  merged.clearGroups();
  merged.addGroup(0, merged.getAttribute("position").count, 0);
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
};

const createBones = (): Record<AthleteBoneName, THREE.Bone> => {
  const root = new THREE.Bone();
  root.name = "HumanoidRoot";

  const torso = new THREE.Bone();
  torso.name = "Spine";
  torso.position.set(0, 1.15, 0);

  const head = new THREE.Bone();
  head.name = "Head";
  head.position.set(0, 0.62, 0);

  const leftArm = new THREE.Bone();
  leftArm.name = "LeftUpperArm";
  leftArm.position.set(-0.39, 0.27, 0);
  const rightArm = new THREE.Bone();
  rightArm.name = "RightUpperArm";
  rightArm.position.set(0.39, 0.27, 0);

  const leftForearm = new THREE.Bone();
  leftForearm.name = "LeftForearm";
  leftForearm.position.set(0, -0.36, 0);
  const rightForearm = new THREE.Bone();
  rightForearm.name = "RightForearm";
  rightForearm.position.set(0, -0.36, 0);

  const leftHand = new THREE.Bone();
  leftHand.name = "LeftHand";
  leftHand.position.set(0, -0.32, -0.01);
  const rightHand = new THREE.Bone();
  rightHand.name = "RightHand";
  rightHand.position.set(0, -0.32, -0.01);

  const leftLeg = new THREE.Bone();
  leftLeg.name = "LeftThigh";
  leftLeg.position.set(-0.18, 0.73, 0);
  const rightLeg = new THREE.Bone();
  rightLeg.name = "RightThigh";
  rightLeg.position.set(0.18, 0.73, 0);

  const leftShin = new THREE.Bone();
  leftShin.name = "LeftShin";
  leftShin.position.set(0, -0.37, -0.01);
  const rightShin = new THREE.Bone();
  rightShin.name = "RightShin";
  rightShin.position.set(0, -0.37, -0.01);

  root.add(torso, leftLeg, rightLeg);
  torso.add(head, leftArm, rightArm);
  leftArm.add(leftForearm);
  rightArm.add(rightForearm);
  leftForearm.add(leftHand);
  rightForearm.add(rightHand);
  leftLeg.add(leftShin);
  rightLeg.add(rightShin);

  // The first seven entries retain the historic skin-index order. New lower-limb
  // and forearm bones append to that order so old animation assumptions stay valid.
  return {
    root,
    torso,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    leftForearm,
    rightForearm,
    leftHand,
    rightHand,
    leftShin,
    rightShin
  };
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
  const paletteKey = `humanoid-v3-headless-${materialArray
    .map((material) => `#${material.color.getHexString()}`)
    .join("-")}-${appearance.silhouette.shoulderBulk.toFixed(2)}`;
  let geometry = sharedBodyGeometries.get(paletteKey);
  if (!geometry) {
    evictUnusedSharedBody();
    geometry = buildSharedBodyGeometry(
      materialArray.map((material) => material.color),
      appearance.silhouette.shoulderBulk
    );
    sharedBodyGeometries.set(paletteKey, geometry);
  }
  let bodyMaterial = sharedBodyMaterials.get(paletteKey);
  if (!bodyMaterial) {
    bodyMaterial = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      vertexColors: true,
      roughness: 0.78,
      metalness: 0.025,
      flatShading: false
    });
    sharedBodyMaterials.set(paletteKey, bodyMaterial);
  }

  const bones = createBones();
  const skeletonBones = Object.values(bones);
  const mesh = new THREE.SkinnedMesh(geometry, bodyMaterial);
  mesh.name = `stylized_humanoid_${appearance.variant}`;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.preserveSharedResources = true;
  mesh.userData.geometryStats = {
    vertices: geometry.getAttribute("position").count,
    triangles: geometry.getAttribute("position").count / 3,
    bones: skeletonBones.length,
    skinnedMeshes: 1,
    bodyMaterials: 1
  };
  mesh.add(bones.root);
  mesh.bind(new THREE.Skeleton(skeletonBones));
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
