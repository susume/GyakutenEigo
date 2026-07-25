import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { PlayerAccessoryId, PlayerHeadOption } from "@quizstrike/shared";
import type { CharacterMaterials } from "./CharacterEquipment.js";

export type AccessorySocketName =
  | "HeadSocket"
  | "FaceSocket"
  | "BackSocket"
  | "ShoulderSocket"
  | "ChestBadgeSocket"
  | "HipSocket";

export interface AccessoryDefinition {
  id: PlayerAccessoryId;
  socket: AccessorySocketName;
  position: readonly [number, number, number];
  rotation: readonly [number, number, number];
  scale: readonly [number, number, number];
}

export const ACCESSORY_DEFINITIONS: Record<PlayerAccessoryId, AccessoryDefinition> = {
  none: {
    id: "none",
    socket: "BackSocket",
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1]
  },
  utility_pack: {
    id: "utility_pack",
    socket: "BackSocket",
    position: [0, -0.04, 0.03],
    rotation: [0, 0, 0],
    scale: [0.92, 0.92, 0.92]
  },
  compact_pack: {
    id: "compact_pack",
    socket: "BackSocket",
    position: [0, 0.02, 0.015],
    rotation: [0, 0, 0],
    scale: [0.82, 0.82, 0.82]
  },
  tech_pack: {
    id: "tech_pack",
    socket: "BackSocket",
    position: [0, -0.01, 0.035],
    rotation: [0, 0, 0],
    scale: [0.9, 0.9, 0.9]
  },
  trail_pack: {
    id: "trail_pack",
    socket: "BackSocket",
    position: [0, -0.02, 0.04],
    rotation: [0, 0, 0],
    scale: [0.9, 0.9, 0.9]
  },
  shoulder_badge: {
    id: "shoulder_badge",
    socket: "ShoulderSocket",
    position: [0, 0, 0],
    rotation: [0, -0.12, 0],
    scale: [1, 1, 1]
  }
};

const roundedUnit = new RoundedBoxGeometry(1, 1, 1, 2, 0.12);
const cylinderUnit = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
const sphereUnit = new THREE.SphereGeometry(0.5, 10, 7);
const torusUnit = new THREE.TorusGeometry(0.5, 0.11, 7, 16);

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

export const createAccessory = (
  accessoryId: PlayerAccessoryId,
  materials: CharacterMaterials
): THREE.Group | undefined => {
  if (accessoryId === "none") return undefined;
  const group = new THREE.Group();
  group.name = `Accessory_${accessoryId}`;

  if (accessoryId === "utility_pack") {
    add(group, roundedUnit, materials.cloth, [0, 0, 0], [0.5, 0.55, 0.18]);
    add(group, roundedUnit, materials.dark, [-0.15, -0.15, 0.12], [0.16, 0.18, 0.08]);
    add(group, roundedUnit, materials.dark, [0.15, -0.15, 0.12], [0.16, 0.18, 0.08]);
    add(group, roundedUnit, materials.accent, [0, 0.12, 0.13], [0.3, 0.055, 0.035]);
  } else if (accessoryId === "compact_pack") {
    add(group, roundedUnit, materials.dark, [0, 0, 0], [0.42, 0.42, 0.145]);
    add(group, roundedUnit, materials.armor, [0, 0.03, 0.1], [0.27, 0.22, 0.06]);
    add(group, torusUnit, materials.accent, [0, 0.11, 0.15], [0.11, 0.11, 0.07]);
  } else if (accessoryId === "tech_pack") {
    add(group, roundedUnit, materials.dark, [0, 0, 0], [0.48, 0.58, 0.17]);
    add(group, roundedUnit, materials.armor, [0, 0.08, 0.12], [0.31, 0.22, 0.07]);
    add(group, cylinderUnit, materials.dark, [0.16, 0.38, 0.03], [0.035, 0.22, 0.035]);
    add(group, sphereUnit, materials.accent, [0.16, 0.6, 0.03], [0.065, 0.065, 0.065]);
  } else if (accessoryId === "trail_pack") {
    add(group, roundedUnit, materials.cloth, [0, -0.03, 0], [0.48, 0.54, 0.17]);
    add(group, cylinderUnit, materials.armor, [0, 0.32, 0.03], [0.16, 0.48, 0.16], [0, 0, Math.PI / 2]);
    add(group, torusUnit, materials.accent, [0, 0.32, 0.03], [0.18, 0.18, 0.12], [0, Math.PI / 2, 0]);
  } else if (accessoryId === "shoulder_badge") {
    add(group, cylinderUnit, materials.armor, [0, 0, 0], [0.11, 0.035, 0.11], [Math.PI / 2, 0, 0]);
    add(group, torusUnit, materials.accent, [0, -0.035, -0.005], [0.12, 0.12, 0.055], [Math.PI / 2, 0, 0]);
  }

  const definition = ACCESSORY_DEFINITIONS[accessoryId];
  group.position.set(...definition.position);
  group.rotation.set(...definition.rotation);
  group.scale.set(...definition.scale);
  return group;
};

export const createHeadOption = (
  option: PlayerHeadOption,
  materials: CharacterMaterials
): THREE.Group => {
  const group = new THREE.Group();
  group.name = `HeadOption_${option}`;

  if (option === "visor") {
    add(group, roundedUnit, materials.visor, [0, 0.045, -0.3], [0.46, 0.13, 0.045]);
    add(group, roundedUnit, materials.accent, [0, 0.13, -0.285], [0.34, 0.035, 0.035]);
  } else if (option === "comms") {
    add(group, torusUnit, materials.dark, [0, 0.08, 0], [0.68, 0.74, 0.66], [0, 0, Math.PI / 2]);
    add(group, roundedUnit, materials.armor, [-0.31, 0.02, 0], [0.09, 0.18, 0.12]);
    add(group, roundedUnit, materials.armor, [0.31, 0.02, 0], [0.09, 0.18, 0.12]);
    add(group, cylinderUnit, materials.accent, [0.24, -0.08, -0.18], [0.025, 0.2, 0.025], [0.88, 0, 0.2]);
  } else if (option === "goggles") {
    add(group, torusUnit, materials.visor, [-0.105, 0.045, -0.295], [0.18, 0.18, 0.1]);
    add(group, torusUnit, materials.visor, [0.105, 0.045, -0.295], [0.18, 0.18, 0.1]);
    add(group, roundedUnit, materials.dark, [0, 0.045, -0.29], [0.085, 0.025, 0.025]);
  } else {
    add(group, torusUnit, materials.cloth, [0, -0.005, 0.015], [0.67, 0.75, 0.68], [Math.PI / 2, 0, 0]);
    add(group, sphereUnit, materials.cloth, [0, 0.15, 0.03], [0.34, 0.25, 0.32]);
  }

  return group;
};
