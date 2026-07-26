import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { PlayerFootwearId } from "@quizstrike/shared";
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
  const next = (geometry.index ? geometry.toNonIndexed() : geometry.clone()).applyMatrix4(matrix);
  geometry.dispose();
  next.userData.materialIndex = materialIndex;
  return addRigidSkinning(next, BONE_INDEX[bone]);
};

const capsule = (radius: number, length: number, radialSegments = 8) =>
  new THREE.CapsuleGeometry(radius, length, 4, radialSegments);

const joint = (radius: number, widthScale = 1) =>
  new THREE.SphereGeometry(radius, 10, 7).scale(widthScale, 1, 1);

const taperedLimb = (topRadius: number, bottomRadius: number, height: number) =>
  new THREE.CylinderGeometry(topRadius, bottomRadius, height, 12, 2, false);

const torsoGeometry = () => new THREE.LatheGeometry([
  new THREE.Vector2(0.255, -0.37),
  new THREE.Vector2(0.285, -0.32),
  new THREE.Vector2(0.31, -0.2),
  new THREE.Vector2(0.355, 0.02),
  new THREE.Vector2(0.39, 0.2),
  new THREE.Vector2(0.37, 0.31),
  new THREE.Vector2(0.3, 0.37)
], 14);

const pelvisGeometry = () => new THREE.LatheGeometry([
  new THREE.Vector2(0.225, -0.18),
  new THREE.Vector2(0.27, -0.14),
  new THREE.Vector2(0.305, 0),
  new THREE.Vector2(0.29, 0.12),
  new THREE.Vector2(0.255, 0.17)
], 12);

const waistbandGeometry = () => new THREE.LatheGeometry([
  new THREE.Vector2(0.245, -0.07),
  new THREE.Vector2(0.285, -0.045),
  new THREE.Vector2(0.295, 0.035),
  new THREE.Vector2(0.265, 0.075)
], 12);

const chestPanelGeometry = () => {
  const shape = new THREE.Shape();
  shape.moveTo(-0.19, -0.24);
  shape.quadraticCurveTo(-0.235, -0.18, -0.23, -0.08);
  shape.lineTo(-0.205, 0.16);
  shape.quadraticCurveTo(-0.18, 0.24, -0.1, 0.26);
  shape.quadraticCurveTo(0, 0.285, 0.1, 0.26);
  shape.quadraticCurveTo(0.18, 0.24, 0.205, 0.16);
  shape.lineTo(0.23, -0.08);
  shape.quadraticCurveTo(0.235, -0.18, 0.19, -0.24);
  shape.quadraticCurveTo(0, -0.29, -0.19, -0.24);
  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.035,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.018,
    bevelThickness: 0.012,
    curveSegments: 3,
    steps: 1
  });
};

const roundedPad = (radius = 0.5, widthSegments = 12, heightSegments = 8) =>
  new THREE.SphereGeometry(radius, widthSegments, heightSegments);

const FOOTWEAR_PROMINENCE_SCALE: Record<PlayerFootwearId, [number, number, number]> = {
  runners: [1.36, 1.2, 1.42],
  army_boots: [1.32, 1.2, 1.36],
  skate_shoes: [1.4, 1.18, 1.46],
  basketball_shoes: [1.38, 1.22, 1.42],
  sandals: [1.4, 1.16, 1.44],
  barefoot: [1.44, 1.18, 1.48]
};

const buildFootwearPieces = (footwearId: PlayerFootwearId) => {
  const pieces: THREE.BufferGeometry[] = [];
  const prominence = FOOTWEAR_PROMINENCE_SCALE[footwearId];
  const forEachFoot = (
    build: (bone: "leftShin" | "rightShin", x: number, yaw: number, side: -1 | 1) => void
  ) => {
    ([-1, 1] as const).forEach((side) => {
      build(side === -1 ? "leftShin" : "rightShin", side * 0.18, side * -0.02, side);
    });
  };
  const add = (
    geometry: THREE.BufferGeometry,
    bone: "leftShin" | "rightShin",
    material: number,
    position: [number, number, number],
    scale: [number, number, number] = [1, 1, 1],
    rotation: [number, number, number] = [0, 0, 0]
  ) => {
    const next = part(geometry, bone, material, position, scale, rotation);
    const soleAnchor = new THREE.Vector3(bone === "leftShin" ? -0.18 : 0.18, -0.03, 0);
    const prominenceMatrix = new THREE.Matrix4()
      .makeTranslation(soleAnchor.x, soleAnchor.y, soleAnchor.z)
      .multiply(new THREE.Matrix4().makeScale(...prominence))
      .multiply(new THREE.Matrix4().makeTranslation(-soleAnchor.x, -soleAnchor.y, -soleAnchor.z));
    next.applyMatrix4(prominenceMatrix);
    pieces.push(next);
  };

  if (footwearId === "runners") {
    forEachFoot((bone, x, yaw) => {
      add(capsule(0.108, 0.235, 10), bone, BODY_MATERIALS.armor, [x, 0.02, -0.15], [1.08, 1, 0.33], [Math.PI / 2, 0, yaw]);
      add(capsule(0.098, 0.205, 10), bone, BODY_MATERIALS.dark, [x, 0.08, -0.135], [1.02, 1, 0.72], [Math.PI / 2, 0, yaw]);
      add(capsule(0.055, 0.135, 8), bone, BODY_MATERIALS.uniform, [x, 0.105, -0.205], [1.12, 1, 0.42], [Math.PI / 2, 0, yaw]);
      add(roundedPad(), bone, BODY_MATERIALS.accent, [x, 0.105, -0.278], [0.085, 0.035, 0.055], [0, 0, yaw]);
      add(new THREE.TorusGeometry(0.098, 0.016, 5, 12), bone, BODY_MATERIALS.accent, [x, 0.13, -0.01], [1, 1, 0.84], [Math.PI / 2, 0, 0]);
    });
  } else if (footwearId === "army_boots") {
    forEachFoot((bone, x, yaw) => {
      add(capsule(0.118, 0.245, 10), bone, BODY_MATERIALS.dark, [x, 0.025, -0.145], [1.08, 1, 0.37], [Math.PI / 2, 0, yaw]);
      add(capsule(0.108, 0.215, 10), bone, BODY_MATERIALS.dark, [x, 0.09, -0.13], [1.04, 1, 0.72], [Math.PI / 2, 0, yaw]);
      add(taperedLimb(0.115, 0.1, 0.235), bone, BODY_MATERIALS.dark, [x, 0.19, -0.005], [1, 1, 0.88]);
      add(roundedPad(), bone, BODY_MATERIALS.armor, [x, 0.12, -0.285], [0.09, 0.05, 0.07], [0, 0, yaw]);
      add(roundedPad(), bone, BODY_MATERIALS.uniform, [x, 0.205, -0.105], [0.073, 0.105, 0.026]);
      [-0.035, 0.025, 0.085].forEach((offsetY) => {
        add(capsule(0.014, 0.105, 6), bone, BODY_MATERIALS.accent, [x, 0.18 + offsetY, -0.135], [1, 1, 0.8], [0, 0, Math.PI / 2]);
      });
      add(new THREE.TorusGeometry(0.108, 0.018, 5, 12), bone, BODY_MATERIALS.accent, [x, 0.305, -0.005], [1, 1, 0.82], [Math.PI / 2, 0, 0]);
    });
  } else if (footwearId === "skate_shoes") {
    forEachFoot((bone, x, yaw, side) => {
      add(capsule(0.12, 0.28, 10), bone, BODY_MATERIALS.armor, [x, 0.018, -0.16], [1.16, 1, 0.27], [Math.PI / 2, 0, yaw]);
      add(capsule(0.108, 0.255, 10), bone, BODY_MATERIALS.dark, [x, 0.066, -0.15], [1.14, 1, 0.57], [Math.PI / 2, 0, yaw]);
      add(roundedPad(), bone, BODY_MATERIALS.dark, [x, 0.085, -0.315], [0.115, 0.055, 0.075], [0, 0, yaw]);
      add(capsule(0.025, 0.16, 7), bone, BODY_MATERIALS.uniform, [x + side * 0.11, 0.08, -0.14], [0.65, 1, 0.42], [Math.PI / 2, 0, 0]);
      add(capsule(0.014, 0.16, 6), bone, BODY_MATERIALS.accent, [x + side * 0.125, 0.08, -0.145], [0.7, 1, 0.45], [Math.PI / 2, 0, 0]);
    });
  } else if (footwearId === "basketball_shoes") {
    forEachFoot((bone, x, yaw, side) => {
      add(capsule(0.113, 0.26, 10), bone, BODY_MATERIALS.armor, [x, 0.022, -0.15], [1.1, 1, 0.34], [Math.PI / 2, 0, yaw]);
      add(capsule(0.104, 0.23, 10), bone, BODY_MATERIALS.dark, [x, 0.085, -0.145], [1.05, 1, 0.72], [Math.PI / 2, 0, yaw]);
      add(taperedLimb(0.107, 0.095, 0.2), bone, BODY_MATERIALS.uniform, [x, 0.18, -0.015], [1, 1, 0.86]);
      add(roundedPad(), bone, BODY_MATERIALS.uniform, [x, 0.115, -0.285], [0.09, 0.055, 0.07], [0, 0, yaw]);
      add(roundedPad(), bone, BODY_MATERIALS.accent, [x + side * 0.09, 0.14, -0.13], [0.035, 0.105, 0.075], [0.1, 0, side * -0.28]);
      add(capsule(0.017, 0.14, 6), bone, BODY_MATERIALS.armor, [x, 0.15, -0.145], [0.72, 1, 0.55], [0, 0, Math.PI / 2]);
      add(new THREE.TorusGeometry(0.104, 0.02, 5, 12), bone, BODY_MATERIALS.accent, [x, 0.275, -0.01], [1.02, 1, 0.84], [Math.PI / 2, 0, 0]);
    });
  } else if (footwearId === "sandals") {
    forEachFoot((bone, x, yaw) => {
      add(capsule(0.11, 0.24, 10), bone, BODY_MATERIALS.dark, [x, 0.012, -0.15], [1.08, 1, 0.22], [Math.PI / 2, 0, yaw]);
      add(capsule(0.102, 0.225, 10), bone, BODY_MATERIALS.skin, [x, 0.052, -0.15], [1.02, 1, 0.42], [Math.PI / 2, 0, yaw]);
      add(capsule(0.034, 0.17, 7), bone, BODY_MATERIALS.uniform, [x, 0.105, -0.205], [1, 1, 0.65], [0, 0, Math.PI / 2]);
      add(capsule(0.031, 0.17, 7), bone, BODY_MATERIALS.accent, [x, 0.105, -0.095], [1, 1, 0.62], [0, 0, Math.PI / 2]);
      add(new THREE.TorusGeometry(0.096, 0.02, 5, 12, Math.PI * 1.2), bone, BODY_MATERIALS.uniform, [x, 0.12, -0.015], [1, 1, 0.85], [Math.PI / 2, 0, -Math.PI * 0.6]);
    });
  } else {
    forEachFoot((bone, x, yaw) => {
      add(capsule(0.102, 0.225, 10), bone, BODY_MATERIALS.skin, [x, 0.035, -0.14], [1.04, 1, 0.4], [Math.PI / 2, 0, yaw]);
      add(roundedPad(), bone, BODY_MATERIALS.skin, [x, 0.045, -0.275], [0.12, 0.055, 0.095], [0, 0, yaw]);
      add(joint(0.065), bone, BODY_MATERIALS.skin, [x, 0.07, -0.015], [1.25, 1, 1]);
      [-0.055, 0, 0.055].forEach((toeX, index) => {
        add(joint(0.04), bone, BODY_MATERIALS.skin, [x + toeX, 0.045, -0.355 + Math.abs(index - 1) * 0.012], [1.05, 0.72, 1.05]);
      });
    });
  }

  return pieces;
};

const buildSharedBodyGeometry = (
  palette: THREE.Color[],
  shoulderBulk: number,
  footwearId: PlayerFootwearId
) => {
  const shoulderScale = Math.min(1.18, shoulderBulk);
  const pieces = [
    // One compact jersey silhouette: team-colour shell, dark side insets, a deliberately
    // shaped neutral chest panel, and a padded collar that accepts every head style.
    part(torsoGeometry(), "torso", BODY_MATERIALS.uniform, [0, 1.17, 0], [1, 1, 0.76]),
    part(capsule(0.065, 0.4, 10), "torso", BODY_MATERIALS.cloth, [-0.285, 1.2, -0.205], [0.72, 1, 0.42], [0, 0, -0.09]),
    part(capsule(0.065, 0.4, 10), "torso", BODY_MATERIALS.cloth, [0.285, 1.2, -0.205], [0.72, 1, 0.42], [0, 0, 0.09]),
    part(chestPanelGeometry(), "torso", BODY_MATERIALS.armor, [0, 1.27, -0.286], [0.86, 0.86, 1], [0, Math.PI, 0]),
    part(new THREE.TorusGeometry(0.052, 0.012, 6, 14), "torso", BODY_MATERIALS.dark, [0, 1.26, -0.333]),
    part(roundedPad(), "torso", BODY_MATERIALS.accent, [0, 1.26, -0.347], [0.025, 0.025, 0.012]),
    part(new THREE.CylinderGeometry(0.115, 0.135, 0.17, 12), "torso", BODY_MATERIALS.dark, [0, 1.61, 0], [1, 1, 0.88]),
    part(new THREE.TorusGeometry(0.125, 0.018, 5, 14), "torso", BODY_MATERIALS.accent, [0, 1.68, 0], [1, 0.9, 1], [Math.PI / 2, 0, 0]),

    // A rounded athletic waistband and trouser seat overlap the jersey rather than
    // presenting a separate rectangular pelvis block.
    part(waistbandGeometry(), "root", BODY_MATERIALS.dark, [0, 0.91, 0], [1, 1, 0.82]),
    part(new THREE.TorusGeometry(0.275, 0.018, 5, 16), "root", BODY_MATERIALS.accent, [0, 0.955, 0], [1, 0.82, 1], [Math.PI / 2, 0, 0]),
    part(pelvisGeometry(), "root", BODY_MATERIALS.cloth, [0, 0.76, 0], [1, 1, 0.86]),
    part(capsule(0.055, 0.2, 9), "root", BODY_MATERIALS.uniform, [-0.255, 0.75, -0.04], [0.72, 1, 0.55]),
    part(capsule(0.055, 0.2, 9), "root", BODY_MATERIALS.uniform, [0.255, 0.75, -0.04], [0.72, 1, 0.55]),

    // Shoulder yoke and flattened pads overlap both torso and sleeve, hiding the
    // animated joint while preserving the existing upper-arm bones.
    part(capsule(0.075, 0.55, 10), "torso", BODY_MATERIALS.uniform, [0, 1.43, 0], [1, 1, 0.72], [0, 0, Math.PI / 2]),
    part(roundedPad(), "leftArm", BODY_MATERIALS.armor, [-0.37, 1.405, -0.018], [0.165 * shoulderScale, 0.115, 0.135]),
    part(roundedPad(), "rightArm", BODY_MATERIALS.armor, [0.37, 1.405, -0.018], [0.165 * shoulderScale, 0.115, 0.135]),
    part(roundedPad(), "leftArm", BODY_MATERIALS.uniform, [-0.37, 1.39, -0.09], [0.14 * shoulderScale, 0.085, 0.065]),
    part(roundedPad(), "rightArm", BODY_MATERIALS.uniform, [0.37, 1.39, -0.09], [0.14 * shoulderScale, 0.085, 0.065]),

    // Tapered jersey sleeves, concealed elbows, forearm guards, and dark arena
    // gloves create one readable arm rather than a ball-cylinder chain.
    part(taperedLimb(0.112, 0.096, 0.34), "leftArm", BODY_MATERIALS.uniform, [-0.39, 1.23, 0]),
    part(taperedLimb(0.112, 0.096, 0.34), "rightArm", BODY_MATERIALS.uniform, [0.39, 1.23, 0]),
    part(joint(0.087), "leftForearm", BODY_MATERIALS.cloth, [-0.39, 1.045, 0]),
    part(joint(0.087), "rightForearm", BODY_MATERIALS.cloth, [0.39, 1.045, 0]),
    part(taperedLimb(0.108, 0.073, 0.3), "leftForearm", BODY_MATERIALS.cloth, [-0.39, 0.89, -0.005]),
    part(taperedLimb(0.108, 0.073, 0.3), "rightForearm", BODY_MATERIALS.cloth, [0.39, 0.89, -0.005]),
    part(capsule(0.072, 0.13, 9), "leftForearm", BODY_MATERIALS.uniform, [-0.39, 0.915, -0.072], [0.95, 1, 0.45]),
    part(capsule(0.072, 0.13, 9), "rightForearm", BODY_MATERIALS.uniform, [0.39, 0.915, -0.072], [0.95, 1, 0.45]),
    part(new THREE.TorusGeometry(0.09, 0.017, 5, 12), "leftForearm", BODY_MATERIALS.accent, [-0.39, 0.765, -0.005], [1, 1, 0.82], [Math.PI / 2, 0, 0]),
    part(new THREE.TorusGeometry(0.09, 0.017, 5, 12), "rightForearm", BODY_MATERIALS.accent, [0.39, 0.765, -0.005], [1, 1, 0.82], [Math.PI / 2, 0, 0]),
    part(capsule(0.085, 0.07, 9), "leftHand", BODY_MATERIALS.dark, [-0.39, 0.69, -0.025], [1, 1, 0.88]),
    part(capsule(0.085, 0.07, 9), "rightHand", BODY_MATERIALS.dark, [0.39, 0.69, -0.025], [1, 1, 0.88]),
    part(capsule(0.035, 0.06, 7), "leftHand", BODY_MATERIALS.dark, [-0.32, 0.71, -0.065], [1, 1, 0.9], [0.2, 0, -0.5]),
    part(capsule(0.035, 0.06, 7), "rightHand", BODY_MATERIALS.dark, [0.32, 0.71, -0.065], [1, 1, 0.9], [0.2, 0, 0.5]),

    // Continuous trousers hide the knee pivots. Neutral pads sit on top of dark
    // fabric, while broad outer-leg team panels remain readable at match distance.
    part(taperedLimb(0.135, 0.15, 0.38), "leftLeg", BODY_MATERIALS.cloth, [-0.18, 0.55, 0]),
    part(taperedLimb(0.135, 0.15, 0.38), "rightLeg", BODY_MATERIALS.cloth, [0.18, 0.55, 0]),
    part(capsule(0.052, 0.22, 9), "leftLeg", BODY_MATERIALS.uniform, [-0.285, 0.56, -0.03], [0.78, 1, 0.5]),
    part(capsule(0.052, 0.22, 9), "rightLeg", BODY_MATERIALS.uniform, [0.285, 0.56, -0.03], [0.78, 1, 0.5]),
    part(joint(0.098, 0.96), "leftShin", BODY_MATERIALS.cloth, [-0.18, 0.36, 0]),
    part(joint(0.098, 0.96), "rightShin", BODY_MATERIALS.cloth, [0.18, 0.36, 0]),
    part(roundedPad(), "leftShin", BODY_MATERIALS.armor, [-0.18, 0.365, -0.095], [0.095, 0.09, 0.035]),
    part(roundedPad(), "rightShin", BODY_MATERIALS.armor, [0.18, 0.365, -0.095], [0.095, 0.09, 0.035]),
    part(roundedPad(), "leftShin", BODY_MATERIALS.uniform, [-0.18, 0.365, -0.118], [0.055, 0.045, 0.014]),
    part(roundedPad(), "rightShin", BODY_MATERIALS.uniform, [0.18, 0.365, -0.118], [0.055, 0.045, 0.014]),
    part(taperedLimb(0.105, 0.085, 0.29), "leftShin", BODY_MATERIALS.cloth, [-0.18, 0.205, 0]),
    part(taperedLimb(0.105, 0.085, 0.29), "rightShin", BODY_MATERIALS.cloth, [0.18, 0.205, 0]),
    part(capsule(0.045, 0.16, 8), "leftShin", BODY_MATERIALS.uniform, [-0.255, 0.205, -0.025], [0.75, 1, 0.5]),
    part(capsule(0.045, 0.16, 8), "rightShin", BODY_MATERIALS.uniform, [0.255, 0.205, -0.025], [0.75, 1, 0.5]),
    ...buildFootwearPieces(footwearId)
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
  const paletteKey = `humanoid-v5-footwear-${appearance.customization.footwearId}-${materialArray
    .map((material) => `#${material.color.getHexString()}`)
    .join("-")}-${appearance.silhouette.shoulderBulk.toFixed(2)}`;
  let geometry = sharedBodyGeometries.get(paletteKey);
  if (!geometry) {
    evictUnusedSharedBody();
    geometry = buildSharedBodyGeometry(
      materialArray.map((material) => material.color),
      appearance.silhouette.shoulderBulk,
      appearance.customization.footwearId
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
    bodyMaterials: 1,
    footwearId: appearance.customization.footwearId
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
