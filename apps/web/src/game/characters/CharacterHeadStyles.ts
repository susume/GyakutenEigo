import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { PlayerHeadStyleId } from "@quizstrike/shared";
import type { CharacterMaterials } from "./CharacterEquipment.js";

export interface HeadStyleDefinition {
  id: PlayerHeadStyleId;
  asset?: string;
  position: readonly [number, number, number];
  rotation: readonly [number, number, number];
  scale: readonly [number, number, number];
  create: (materials: CharacterMaterials) => THREE.Group;
}

const sphere = new THREE.SphereGeometry(0.5, 16, 11);
const helmetDome = new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
const softSphere = new THREE.SphereGeometry(0.5, 12, 8);
const cone = new THREE.ConeGeometry(0.5, 1, 8);
const cylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
const roundedBox = new RoundedBoxGeometry(1, 1, 1, 3, 0.14);
const torus = new THREE.TorusGeometry(0.5, 0.1, 8, 20);

const neutral = {
  fox: new THREE.MeshStandardMaterial({ color: "#df7446", roughness: 0.82 }),
  foxCream: new THREE.MeshStandardMaterial({ color: "#ffe0b5", roughness: 0.88 }),
  pandaWhite: new THREE.MeshStandardMaterial({ color: "#f4f0e8", roughness: 0.86 }),
  bear: new THREE.MeshStandardMaterial({ color: "#9a6746", roughness: 0.88 }),
  bearMuzzle: new THREE.MeshStandardMaterial({ color: "#d7aa78", roughness: 0.9 }),
  rabbit: new THREE.MeshStandardMaterial({ color: "#e8ddd0", roughness: 0.9 }),
  rabbitInner: new THREE.MeshStandardMaterial({ color: "#dca5a8", roughness: 0.9 }),
  robot: new THREE.MeshStandardMaterial({ color: "#aab7c3", roughness: 0.54, metalness: 0.3 }),
  robotDark: new THREE.MeshStandardMaterial({ color: "#263746", roughness: 0.62, metalness: 0.18 }),
  boyHair: new THREE.MeshStandardMaterial({ color: "#172b3d", roughness: 0.82 }),
  boyHairHighlight: new THREE.MeshStandardMaterial({ color: "#31546b", roughness: 0.78 }),
  girlHair: new THREE.MeshStandardMaterial({ color: "#793f52", roughness: 0.86 }),
  girlHairHighlight: new THREE.MeshStandardMaterial({ color: "#b86a7e", roughness: 0.82 }),
  boyIris: new THREE.MeshStandardMaterial({ color: "#29bad0", roughness: 0.5 }),
  girlIris: new THREE.MeshStandardMaterial({ color: "#9968d8", roughness: 0.5 }),
  blush: new THREE.MeshStandardMaterial({ color: "#f2a4ad", roughness: 0.92 }),
  hairClip: new THREE.MeshStandardMaterial({ color: "#ffd56a", roughness: 0.6, metalness: 0.08 }),
  ninjaCloth: new THREE.MeshStandardMaterial({ color: "#202832", roughness: 0.96 }),
  ninjaFold: new THREE.MeshStandardMaterial({ color: "#35404d", roughness: 0.92 }),
  samuraiIron: new THREE.MeshStandardMaterial({ color: "#26323e", roughness: 0.65, metalness: 0.16 }),
  shark: new THREE.MeshStandardMaterial({ color: "#66899a", roughness: 0.82 }),
  sharkLight: new THREE.MeshStandardMaterial({ color: "#dce4df", roughness: 0.88 }),
  dark: new THREE.MeshStandardMaterial({ color: "#27232a", roughness: 0.82 }),
  eyeWhite: new THREE.MeshStandardMaterial({ color: "#fffdf7", roughness: 0.64 })
} as const;

const add = (
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number],
  scale: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0]
) => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.preserveSharedResources = true;
  parent.add(mesh);
  return mesh;
};

const addEyes = (
  group: THREE.Group,
  materials: CharacterMaterials,
  y: number,
  z: number,
  spacing = 0.1,
  scale: [number, number, number] = [0.045, 0.065, 0.032]
) => {
  for (const x of [-spacing, spacing]) {
    add(group, sphere, neutral.eyeWhite, [x, y, z], [scale[0] * 1.45, scale[1] * 1.35, scale[2]]);
    add(group, sphere, materials.dark, [x, y, z - 0.02], scale);
  }
};

const markMotionNode = (
  object: THREE.Object3D,
  kind: "hairCrown" | "hairFringe" | "hairLock",
  index = 0,
  side = 0
) => {
  object.userData.cosmeticMotionNode = kind;
  object.userData.motionIndex = index;
  object.userData.motionSide = side;
  object.userData.baseRotation = [object.rotation.x, object.rotation.y, object.rotation.z];
  return object;
};

const createAnimeFace = (materials: CharacterMaterials, style: "boy" | "girl") => {
  const group = new THREE.Group();
  const isGirl = style === "girl";
  add(group, sphere, materials.skin, [0, 0.015, 0], [0.61, 0.68, 0.56]);
  add(group, softSphere, materials.skin, [0, -0.115, -0.02], [0.51, 0.45, 0.49]);
  add(group, sphere, materials.skin, [-0.3, 0.01, 0], [0.11, 0.11, 0.09]);
  add(group, sphere, materials.skin, [0.3, 0.01, 0], [0.11, 0.11, 0.09]);
  const iris = isGirl ? neutral.girlIris : neutral.boyIris;
  const eyeY = isGirl ? 0.065 : 0.075;
  for (const side of [-1, 1]) {
    const x = side * 0.115;
    add(group, sphere, neutral.eyeWhite, [x, eyeY, -0.292], [isGirl ? 0.095 : 0.09, isGirl ? 0.115 : 0.095, 0.032]);
    add(group, sphere, iris, [x, eyeY - 0.002, -0.322], [0.058, isGirl ? 0.078 : 0.068, 0.022]);
    add(group, sphere, materials.dark, [x, eyeY - 0.004, -0.34], [0.029, isGirl ? 0.051 : 0.045, 0.014]);
    add(group, sphere, neutral.eyeWhite, [x - 0.015, eyeY + 0.026, -0.353], [0.014, 0.019, 0.009]);
    add(group, roundedBox, materials.dark, [x, eyeY + 0.11, -0.31], [0.115, 0.019, 0.018], [0, 0, side * (isGirl ? -0.08 : -0.16)]);
    if (isGirl) {
      add(group, roundedBox, materials.dark, [x + side * 0.074, eyeY + 0.075, -0.315], [0.04, 0.015, 0.015], [0, 0, side * -0.42]);
      add(group, softSphere, neutral.blush, [side * 0.205, -0.065, -0.294], [0.09, 0.035, 0.018]);
    }
  }
  add(group, cone, materials.skin, [0, -0.02, -0.297], [0.038, 0.05, 0.038], [-Math.PI / 2, 0, 0]);
  return group;
};

const createBoy = (materials: CharacterMaterials) => {
  const group = createAnimeFace(materials, "boy");
  const crown = markMotionNode(new THREE.Group(), "hairCrown");
  crown.name = "BoyHairCrown";
  group.add(crown);
  add(crown, softSphere, neutral.boyHair, [0, 0.275, 0.055], [0.65, 0.38, 0.59]);
  add(crown, softSphere, neutral.boyHair, [-0.27, 0.18, 0.02], [0.22, 0.31, 0.3], [0.02, 0, -0.1]);
  add(crown, softSphere, neutral.boyHair, [0.27, 0.18, 0.02], [0.22, 0.3, 0.3], [0.02, 0, 0.1]);
  const spikes = [
    [-0.29, 0.39, 0.02, -0.48],
    [-0.14, 0.46, 0.015, -0.22],
    [0.02, 0.48, 0.02, 0.08],
    [0.18, 0.44, 0.035, 0.3],
    [0.31, 0.35, 0.055, 0.52]
  ] as const;
  spikes.forEach(([x, y, z, tilt], index) => {
    const spike = markMotionNode(new THREE.Group(), "hairFringe", index, Math.sign(x));
    spike.position.set(x, y, z);
    spike.rotation.z = tilt;
    spike.userData.baseRotation = [0, 0, tilt];
    crown.add(spike);
    add(spike, cone, index === 2 ? neutral.boyHairHighlight : neutral.boyHair, [0, 0.04, 0], [0.13, 0.3, 0.13]);
  });
  const fringe = [
    [-0.2, 0.22, -0.265, 0.28],
    [-0.055, 0.255, -0.292, 0.1],
    [0.1, 0.245, -0.285, -0.16],
    [0.23, 0.2, -0.25, -0.34]
  ] as const;
  fringe.forEach(([x, y, z, tilt], index) => {
    const lock = markMotionNode(new THREE.Group(), "hairFringe", index + 5, Math.sign(x));
    lock.position.set(x, y, z);
    lock.rotation.z = Math.PI + tilt;
    lock.userData.baseRotation = [0, 0, Math.PI + tilt];
    crown.add(lock);
    add(lock, cone, index === 1 ? neutral.boyHairHighlight : neutral.boyHair, [0, -0.055, 0], [0.105, 0.26, 0.09]);
  });
  return group;
};

const createGirl = (materials: CharacterMaterials) => {
  const group = createAnimeFace(materials, "girl");
  const crown = markMotionNode(new THREE.Group(), "hairCrown");
  crown.name = "GirlHairCrown";
  group.add(crown);
  add(crown, softSphere, neutral.girlHair, [0, 0.23, 0.09], [0.69, 0.47, 0.62]);
  add(crown, softSphere, neutral.girlHair, [0, -0.075, 0.22], [0.58, 0.57, 0.35]);

  for (const side of [-1, 1]) {
    const upper = markMotionNode(new THREE.Group(), "hairLock", 0, side);
    upper.name = `GirlHairLock_${side < 0 ? "L" : "R"}_Upper`;
    upper.position.set(side * 0.31, 0.14, -0.015);
    upper.rotation.z = side * 0.08;
    upper.userData.baseRotation = [0, 0, side * 0.08];
    crown.add(upper);
    add(upper, softSphere, neutral.girlHair, [0, -0.18, 0], [0.19, 0.42, 0.22]);

    const lower = markMotionNode(new THREE.Group(), "hairLock", 1, side);
    lower.position.set(0, -0.34, 0.025);
    upper.add(lower);
    add(lower, softSphere, side < 0 ? neutral.girlHairHighlight : neutral.girlHair, [0, -0.12, 0], [0.16, 0.3, 0.18], [0, 0, side * -0.06]);
  }

  const bangs = [
    [-0.22, 0.22, -0.27, 0.25],
    [-0.08, 0.27, -0.3, 0.08],
    [0.07, 0.27, -0.3, -0.08],
    [0.21, 0.22, -0.27, -0.24]
  ] as const;
  bangs.forEach(([x, y, z, tilt], index) => {
    const bang = markMotionNode(new THREE.Group(), "hairFringe", index, Math.sign(x));
    bang.position.set(x, y, z);
    bang.rotation.z = Math.PI + tilt;
    bang.userData.baseRotation = [0, 0, Math.PI + tilt];
    crown.add(bang);
    add(bang, cone, index === 1 ? neutral.girlHairHighlight : neutral.girlHair, [0, -0.045, 0], [0.11, 0.25, 0.085]);
  });

  add(crown, roundedBox, neutral.hairClip, [-0.29, 0.24, -0.28], [0.09, 0.025, 0.025], [0, 0, 0.55]);
  add(crown, roundedBox, neutral.hairClip, [-0.29, 0.24, -0.285], [0.09, 0.025, 0.025], [0, 0, -0.55]);
  return group;
};

const createFox = (materials: CharacterMaterials) => {
  const group = new THREE.Group();
  add(group, sphere, neutral.fox, [0, 0.015, 0], [0.68, 0.66, 0.6]);
  add(group, softSphere, neutral.foxCream, [0, -0.12, -0.055], [0.48, 0.35, 0.45]);
  for (const side of [-1, 1]) {
    add(group, cone, neutral.fox, [side * 0.205, 0.36, 0.015], [0.28, 0.38, 0.24], [0, 0, -side * 0.12]);
    add(group, cone, neutral.rabbitInner, [side * 0.205, 0.365, -0.025], [0.14, 0.25, 0.12], [0, 0, -side * 0.12]);
  }
  add(group, sphere, neutral.foxCream, [0, -0.055, -0.3], [0.36, 0.23, 0.2]);
  add(group, sphere, neutral.dark, [0, -0.03, -0.405], [0.12, 0.09, 0.07]);
  addEyes(group, materials, 0.085, -0.285, 0.11, [0.038, 0.058, 0.026]);
  return group;
};

const createPanda = (materials: CharacterMaterials) => {
  const group = new THREE.Group();
  add(group, sphere, neutral.pandaWhite, [0, 0.01, 0], [0.7, 0.7, 0.62]);
  add(group, sphere, neutral.dark, [-0.27, 0.275, 0.015], [0.22, 0.22, 0.17]);
  add(group, sphere, neutral.dark, [0.27, 0.275, 0.015], [0.22, 0.22, 0.17]);
  for (const side of [-1, 1]) {
    add(group, sphere, neutral.dark, [side * 0.105, 0.075, -0.292], [0.2, 0.28, 0.08], [0, 0, side * 0.18]);
  }
  addEyes(group, materials, 0.075, -0.335, 0.105, [0.027, 0.04, 0.021]);
  add(group, sphere, neutral.pandaWhite, [0, -0.105, -0.31], [0.34, 0.22, 0.16]);
  add(group, sphere, neutral.dark, [0, -0.075, -0.39], [0.1, 0.075, 0.055]);
  return group;
};

const createBear = (materials: CharacterMaterials) => {
  const group = new THREE.Group();
  add(group, sphere, neutral.bear, [0, 0, 0], [0.72, 0.68, 0.62]);
  add(group, sphere, neutral.bear, [-0.27, 0.26, 0.01], [0.22, 0.22, 0.17]);
  add(group, sphere, neutral.bear, [0.27, 0.26, 0.01], [0.22, 0.22, 0.17]);
  add(group, sphere, neutral.bearMuzzle, [0, -0.085, -0.3], [0.42, 0.28, 0.2]);
  add(group, sphere, neutral.dark, [0, -0.045, -0.405], [0.11, 0.08, 0.06]);
  addEyes(group, materials, 0.09, -0.3, 0.11, [0.034, 0.052, 0.024]);
  return group;
};

const createRabbit = (materials: CharacterMaterials) => {
  const group = new THREE.Group();
  add(group, sphere, neutral.rabbit, [0, -0.035, 0], [0.64, 0.68, 0.57]);
  for (const side of [-1, 1]) {
    add(group, sphere, neutral.rabbit, [side * 0.145, 0.395, 0.02], [0.22, 0.48, 0.16], [0, 0, side * 0.08]);
    add(group, sphere, neutral.rabbitInner, [side * 0.145, 0.405, -0.065], [0.1, 0.35, 0.055], [0, 0, side * 0.08]);
  }
  add(group, softSphere, neutral.rabbit, [0, -0.14, -0.045], [0.48, 0.36, 0.44]);
  add(group, sphere, neutral.eyeWhite, [0, -0.08, -0.3], [0.25, 0.18, 0.13]);
  add(group, sphere, neutral.rabbitInner, [0, -0.055, -0.38], [0.085, 0.065, 0.05]);
  addEyes(group, materials, 0.075, -0.285, 0.11, [0.035, 0.055, 0.025]);
  return group;
};

const createRobot = (materials: CharacterMaterials) => {
  const group = new THREE.Group();
  add(group, roundedBox, neutral.robot, [0, 0, 0], [0.62, 0.62, 0.56]);
  add(group, roundedBox, neutral.robotDark, [0, 0.055, -0.305], [0.46, 0.28, 0.055]);
  for (const x of [-0.11, 0.11]) {
    add(group, roundedBox, materials.visor, [x, 0.07, -0.345], [0.12, 0.075, 0.028]);
  }
  add(group, roundedBox, materials.dark, [0, -0.13, -0.325], [0.2, 0.035, 0.025]);
  add(group, cylinder, neutral.robotDark, [0, 0.39, 0.015], [0.045, 0.22, 0.045]);
  add(group, sphere, materials.accent, [0, 0.52, 0.015], [0.12, 0.12, 0.12]);
  add(group, torus, materials.accent, [0, -0.295, 0], [0.5, 0.22, 0.46], [Math.PI / 2, 0, 0]);
  return group;
};

const createSamurai = (materials: CharacterMaterials) => {
  const group = new THREE.Group();
  add(group, sphere, materials.skin, [0, -0.055, -0.005], [0.57, 0.58, 0.52]);
  addEyes(group, materials, 0.005, -0.27, 0.085, [0.032, 0.048, 0.023]);
  add(group, helmetDome, neutral.samuraiIron, [0, 0.08, 0.035], [0.68, 0.62, 0.62]);
  add(group, cylinder, neutral.samuraiIron, [0, 0.11, 0.02], [0.7, 0.11, 0.65]);
  add(group, roundedBox, neutral.samuraiIron, [-0.34, -0.08, 0.035], [0.12, 0.29, 0.32], [0, 0, -0.08]);
  add(group, roundedBox, neutral.samuraiIron, [0.34, -0.08, 0.035], [0.12, 0.29, 0.32], [0, 0, 0.08]);
  add(group, roundedBox, materials.accent, [-0.07, 0.4, -0.285], [0.06, 0.3, 0.055], [0, 0, -0.42]);
  add(group, roundedBox, materials.accent, [0.07, 0.4, -0.285], [0.06, 0.3, 0.055], [0, 0, 0.42]);
  add(group, roundedBox, materials.dark, [0, -0.16, -0.285], [0.28, 0.055, 0.035]);
  return group;
};

const createNinja = (materials: CharacterMaterials) => {
  const group = new THREE.Group();
  add(group, sphere, neutral.ninjaCloth, [0, 0.015, 0.02], [0.64, 0.68, 0.58]);
  add(group, roundedBox, materials.skin, [0, 0.075, -0.29], [0.43, 0.16, 0.055]);
  addEyes(group, materials, 0.08, -0.335, 0.09, [0.032, 0.044, 0.022]);
  add(group, roundedBox, neutral.ninjaCloth, [0, -0.12, -0.31], [0.52, 0.26, 0.07], [-0.08, 0, 0]);
  add(group, torus, neutral.ninjaFold, [0, 0.27, 0.02], [0.55, 0.2, 0.5], [Math.PI / 2, 0, 0]);
  add(group, roundedBox, neutral.ninjaFold, [0.29, -0.05, 0.23], [0.11, 0.35, 0.11], [0.18, 0, -0.28]);
  return group;
};

const createGreatWhite = (materials: CharacterMaterials) => {
  const group = new THREE.Group();
  add(group, sphere, neutral.shark, [0, 0.02, -0.025], [0.67, 0.6, 0.69]);
  add(group, softSphere, neutral.shark, [0, -0.015, -0.3], [0.55, 0.4, 0.5]);
  add(group, softSphere, neutral.sharkLight, [0, -0.17, -0.315], [0.5, 0.25, 0.42]);
  add(group, cone, neutral.shark, [0, 0.42, 0.12], [0.15, 0.28, 0.14], [0.18, 0, 0]);
  for (const side of [-1, 1]) {
    add(group, sphere, neutral.dark, [side * 0.19, 0.095, -0.405], [0.045, 0.052, 0.032]);
    for (let index = 0; index < 2; index += 1) {
      add(group, roundedBox, neutral.dark, [side * (0.29 + index * 0.025), -0.055 - index * 0.06, -0.22], [0.025, 0.07, 0.045], [0, 0, side * 0.18]);
    }
  }
  add(group, roundedBox, neutral.dark, [0, -0.17, -0.475], [0.34, 0.07, 0.035]);
  for (const x of [-0.21, -0.105, 0, 0.105, 0.21]) {
    add(group, cone, neutral.eyeWhite, [x, -0.17, -0.515], [0.035, 0.075, 0.03], [Math.PI, 0, 0]);
  }
  return group;
};

export const HEAD_STYLE_REGISTRY: Record<PlayerHeadStyleId, HeadStyleDefinition> = {
  boy_short_hair: { id: "boy_short_hair", position: [0, -0.005, 0], rotation: [0, 0, 0], scale: [0.98, 0.98, 0.98], create: createBoy },
  girl_mid_hair: { id: "girl_mid_hair", position: [0, -0.01, 0.015], rotation: [0, 0, 0], scale: [0.94, 0.94, 0.94], create: createGirl },
  fox: { id: "fox", position: [0, -0.005, 0.005], rotation: [0, 0, 0], scale: [0.98, 0.98, 0.98], create: createFox },
  panda: { id: "panda", position: [0, -0.015, 0.005], rotation: [0, 0, 0], scale: [0.96, 0.96, 0.96], create: createPanda },
  bear: { id: "bear", position: [0, -0.02, 0.005], rotation: [0, 0, 0], scale: [0.96, 0.96, 0.96], create: createBear },
  rabbit: { id: "rabbit", position: [0, -0.015, 0.005], rotation: [0, 0, 0], scale: [0.96, 0.96, 0.96], create: createRabbit },
  great_white: { id: "great_white", position: [0, -0.025, -0.005], rotation: [0, 0, 0], scale: [0.94, 0.94, 0.94], create: createGreatWhite },
  robot: { id: "robot", position: [0, 0, 0.005], rotation: [0, 0, 0], scale: [0.96, 0.96, 0.96], create: createRobot },
  samurai: { id: "samurai", position: [0, -0.015, 0.02], rotation: [0, 0, 0], scale: [0.92, 0.92, 0.92], create: createSamurai },
  ninja: { id: "ninja", position: [0, -0.01, 0.005], rotation: [0, 0, 0], scale: [0.98, 0.98, 0.98], create: createNinja }
};

const finishHead = (definition: HeadStyleDefinition, group: THREE.Group) => {
  group.name = `HeadStyle_${definition.id}`;
  group.position.set(...definition.position);
  group.rotation.set(...definition.rotation);
  group.scale.set(...definition.scale);
  group.userData.headStyleId = definition.id;
  group.userData.primaryHeadVisual = true;
  return group;
};

export const createHeadStyle = (
  requestedId: PlayerHeadStyleId | string,
  materials: CharacterMaterials
): THREE.Group => {
  const requested = HEAD_STYLE_REGISTRY[requestedId as PlayerHeadStyleId];
  if (!requested) {
    console.warn(`[QuizStrike] Unknown head style "${requestedId}". Falling back to "boy_short_hair".`);
    const fallback = finishHead(HEAD_STYLE_REGISTRY.boy_short_hair, HEAD_STYLE_REGISTRY.boy_short_hair.create(materials));
    fallback.userData.fallbackFrom = requestedId;
    return fallback;
  }
  try {
    return finishHead(requested, requested.create(materials));
  } catch (error) {
    console.warn(`[QuizStrike] Head style "${requestedId}" failed to build. Falling back to "boy_short_hair".`, error);
    const fallback = finishHead(HEAD_STYLE_REGISTRY.boy_short_hair, HEAD_STYLE_REGISTRY.boy_short_hair.create(materials));
    fallback.userData.fallbackFrom = requestedId;
    return fallback;
  }
};

export const createHeadStyleDebugEnvelope = () => {
  const group = new THREE.Group();
  group.name = "HeadStyleDebugEnvelope";
  const material = new THREE.MeshBasicMaterial({
    color: "#5fffe1",
    transparent: true,
    opacity: 0.28,
    wireframe: true,
    depthTest: false
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), material);
  mesh.scale.set(0.76, 0.84, 0.7);
  mesh.userData.disposeWithCharacterGeometry = true;
  mesh.userData.disposeWithCharacterMaterial = true;
  group.add(mesh);
  group.add(new THREE.AxesHelper(0.42));
  return group;
};
