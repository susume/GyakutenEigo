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

const createHuman = (materials: CharacterMaterials) => {
  const group = new THREE.Group();
  add(group, sphere, materials.skin, [0, 0.02, 0], [0.62, 0.68, 0.57]);
  add(group, softSphere, materials.skin, [0, -0.1, -0.015], [0.53, 0.46, 0.5]);
  add(group, sphere, materials.skin, [-0.3, 0.01, 0], [0.11, 0.11, 0.09]);
  add(group, sphere, materials.skin, [0.3, 0.01, 0], [0.11, 0.11, 0.09]);
  add(group, cone, materials.skin, [0, -0.005, -0.285], [0.084, 0.095, 0.084], [-Math.PI / 2, 0, 0]);
  addEyes(group, materials, 0.055, -0.272, 0.09, [0.033, 0.052, 0.025]);
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

export const HEAD_STYLE_REGISTRY: Record<PlayerHeadStyleId, HeadStyleDefinition> = {
  human: { id: "human", position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], create: createHuman },
  fox: { id: "fox", position: [0, -0.005, 0.005], rotation: [0, 0, 0], scale: [0.98, 0.98, 0.98], create: createFox },
  panda: { id: "panda", position: [0, -0.015, 0.005], rotation: [0, 0, 0], scale: [0.96, 0.96, 0.96], create: createPanda },
  bear: { id: "bear", position: [0, -0.02, 0.005], rotation: [0, 0, 0], scale: [0.96, 0.96, 0.96], create: createBear },
  rabbit: { id: "rabbit", position: [0, -0.015, 0.005], rotation: [0, 0, 0], scale: [0.96, 0.96, 0.96], create: createRabbit },
  robot: { id: "robot", position: [0, 0, 0.005], rotation: [0, 0, 0], scale: [0.96, 0.96, 0.96], create: createRobot }
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
    console.warn(`[QuizStrike] Unknown head style "${requestedId}". Falling back to "human".`);
    const fallback = finishHead(HEAD_STYLE_REGISTRY.human, HEAD_STYLE_REGISTRY.human.create(materials));
    fallback.userData.fallbackFrom = requestedId;
    return fallback;
  }
  try {
    return finishHead(requested, requested.create(materials));
  } catch (error) {
    console.warn(`[QuizStrike] Head style "${requestedId}" failed to build. Falling back to "human".`, error);
    const fallback = finishHead(HEAD_STYLE_REGISTRY.human, HEAD_STYLE_REGISTRY.human.create(materials));
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
