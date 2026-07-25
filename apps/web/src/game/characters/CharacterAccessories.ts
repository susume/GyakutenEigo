import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type {
  PlayerBackAccessoryId,
  PlayerDetailAccessoryId
} from "@quizstrike/shared";
import type { CharacterMaterials } from "./CharacterEquipment.js";

export type AccessorySocketName =
  | "HeadSocket"
  | "FaceSocket"
  | "BackSocket"
  | "ShoulderSocket"
  | "ChestBadgeSocket"
  | "WristSocket"
  | "HipSocket";

export interface AccessoryDefinition<TId extends string = string> {
  id: TId;
  socket: AccessorySocketName;
  position: readonly [number, number, number];
  rotation: readonly [number, number, number];
  scale: readonly [number, number, number];
}

export const BACK_ACCESSORY_DEFINITIONS: Record<
  PlayerBackAccessoryId,
  AccessoryDefinition<PlayerBackAccessoryId>
> = {
  none: { id: "none", socket: "BackSocket", position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
  utility_pack: { id: "utility_pack", socket: "BackSocket", position: [0, -0.04, 0.03], rotation: [0, 0, 0], scale: [0.92, 0.92, 0.92] },
  compact_pack: { id: "compact_pack", socket: "BackSocket", position: [0, 0.02, 0.015], rotation: [0, 0, 0], scale: [0.82, 0.82, 0.82] },
  tech_pack: { id: "tech_pack", socket: "BackSocket", position: [0, -0.01, 0.035], rotation: [0, 0, 0], scale: [0.9, 0.9, 0.9] },
  trail_pack: { id: "trail_pack", socket: "BackSocket", position: [0, -0.02, 0.04], rotation: [0, 0, 0], scale: [0.9, 0.9, 0.9] },
  book_satchel: { id: "book_satchel", socket: "BackSocket", position: [0, -0.12, 0.02], rotation: [0, 0, -0.04], scale: [0.88, 0.88, 0.88] },
  rocket_pack: { id: "rocket_pack", socket: "BackSocket", position: [0, -0.03, 0.05], rotation: [0, 0, 0], scale: [0.88, 0.88, 0.88] },
  team_pennant: { id: "team_pennant", socket: "BackSocket", position: [0.2, 0.2, 0.02], rotation: [0, 0, -0.08], scale: [0.9, 0.9, 0.9] }
};

export const DETAIL_ACCESSORY_DEFINITIONS: Record<
  PlayerDetailAccessoryId,
  AccessoryDefinition<PlayerDetailAccessoryId>
> = {
  none: { id: "none", socket: "ChestBadgeSocket", position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
  shoulder_badge: { id: "shoulder_badge", socket: "ShoulderSocket", position: [0, 0, 0], rotation: [0, -0.12, 0], scale: [1, 1, 1] },
  wrist_device: { id: "wrist_device", socket: "WristSocket", position: [0, 0, -0.01], rotation: [0, 0, 0], scale: [1, 1, 1] },
  quiz_medal: { id: "quiz_medal", socket: "ChestBadgeSocket", position: [0, -0.02, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
  compass_badge: { id: "compass_badge", socket: "ChestBadgeSocket", position: [-0.14, 0.06, 0], rotation: [0, 0, 0], scale: [0.9, 0.9, 0.9] },
  champion_star: { id: "champion_star", socket: "ChestBadgeSocket", position: [0.14, 0.06, 0], rotation: [0, 0, 0], scale: [0.9, 0.9, 0.9] }
};

const roundedUnit = new RoundedBoxGeometry(1, 1, 1, 2, 0.12);
const cylinderUnit = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
const coneUnit = new THREE.ConeGeometry(0.5, 1, 8);
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

const finishAccessory = <TId extends string>(
  id: TId,
  definition: AccessoryDefinition<TId>,
  group: THREE.Group
) => {
  group.name = `Accessory_${id}`;
  group.position.set(...definition.position);
  group.rotation.set(...definition.rotation);
  group.scale.set(...definition.scale);
  return group;
};

export const createBackAccessory = (
  accessoryId: PlayerBackAccessoryId,
  materials: CharacterMaterials
): THREE.Group | undefined => {
  if (accessoryId === "none") return undefined;
  const group = new THREE.Group();

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
  } else if (accessoryId === "book_satchel") {
    add(group, roundedUnit, materials.cloth, [0, -0.04, 0], [0.48, 0.4, 0.14]);
    add(group, roundedUnit, materials.armor, [0, 0.03, 0.11], [0.4, 0.08, 0.035]);
    add(group, torusUnit, materials.accent, [0, -0.02, 0.15], [0.12, 0.12, 0.055]);
    add(group, roundedUnit, materials.accent, [0, 0.22, 0], [0.04, 0.42, 0.035], [0, 0, -0.62]);
  } else if (accessoryId === "rocket_pack") {
    add(group, roundedUnit, materials.dark, [0, 0.05, 0], [0.42, 0.5, 0.17]);
    for (const x of [-0.17, 0.17]) {
      add(group, cylinderUnit, materials.armor, [x, -0.04, 0.04], [0.11, 0.55, 0.11]);
      add(group, coneUnit, materials.accent, [x, -0.4, 0.04], [0.13, 0.24, 0.13], [0, 0, Math.PI]);
    }
    add(group, sphereUnit, materials.visor, [0, 0.13, 0.15], [0.1, 0.1, 0.05]);
  } else if (accessoryId === "team_pennant") {
    add(group, cylinderUnit, materials.dark, [0, 0.2, 0], [0.025, 0.75, 0.025]);
    add(group, coneUnit, materials.accent, [0.18, 0.49, 0], [0.25, 0.38, 0.035], [0, 0, -Math.PI / 2]);
    add(group, sphereUnit, materials.armor, [0, 0.61, 0], [0.055, 0.055, 0.055]);
  }

  return finishAccessory(accessoryId, BACK_ACCESSORY_DEFINITIONS[accessoryId], group);
};

export const createDetailAccessory = (
  accessoryId: PlayerDetailAccessoryId,
  materials: CharacterMaterials
): THREE.Group | undefined => {
  if (accessoryId === "none") return undefined;
  const group = new THREE.Group();

  if (accessoryId === "shoulder_badge") {
    // Oversized shield crest with a pointed base, readable even on distant players.
    add(group, roundedUnit, materials.armor, [0, 0.015, -0.035], [0.28, 0.25, 0.055]);
    add(group, coneUnit, materials.armor, [0, -0.15, -0.035], [0.28, 0.2, 0.055], [0, 0, Math.PI]);
    add(group, roundedUnit, materials.accent, [0, 0.035, -0.072], [0.16, 0.055, 0.025]);
    add(group, sphereUnit, materials.accent, [0, -0.055, -0.072], [0.07, 0.07, 0.025]);
  } else if (accessoryId === "wrist_device") {
    add(group, roundedUnit, materials.dark, [0, 0, 0], [0.23, 0.13, 0.18]);
    add(group, roundedUnit, materials.visor, [0, 0.02, -0.105], [0.16, 0.08, 0.03]);
    add(group, torusUnit, materials.accent, [0, 0, 0], [0.26, 0.21, 0.19], [Math.PI / 2, 0, 0]);
  } else if (accessoryId === "quiz_medal") {
    // Twin ribbons and a large circular medal produce a unique hanging silhouette.
    add(group, roundedUnit, materials.accent, [-0.07, 0.16, 0], [0.065, 0.28, 0.035], [0, 0, 0.34]);
    add(group, roundedUnit, materials.armor, [0.07, 0.16, 0], [0.065, 0.28, 0.035], [0, 0, -0.34]);
    add(group, torusUnit, materials.accent, [0, -0.035, -0.015], [0.25, 0.25, 0.075]);
    add(group, cylinderUnit, materials.armor, [0, -0.035, -0.04], [0.175, 0.055, 0.175], [Math.PI / 2, 0, 0]);
    add(group, sphereUnit, materials.accent, [0, -0.035, -0.085], [0.075, 0.075, 0.025]);
  } else if (accessoryId === "compass_badge") {
    add(group, torusUnit, materials.dark, [0, 0, -0.01], [0.25, 0.25, 0.075]);
    add(group, cylinderUnit, materials.armor, [0, 0, -0.035], [0.18, 0.045, 0.18], [Math.PI / 2, 0, 0]);
    add(group, coneUnit, materials.accent, [0, 0.065, -0.09], [0.095, 0.24, 0.035], [Math.PI / 2, 0, 0]);
    add(group, coneUnit, materials.dark, [0, -0.065, -0.09], [0.07, 0.17, 0.03], [-Math.PI / 2, 0, 0]);
  } else if (accessoryId === "champion_star") {
    add(group, sphereUnit, materials.armor, [0, 0, 0], [0.18, 0.18, 0.045]);
    for (let index = 0; index < 5; index += 1) {
      const angle = (index / 5) * Math.PI * 2;
      add(group, coneUnit, materials.accent, [Math.sin(angle) * 0.17, Math.cos(angle) * 0.17, -0.035], [0.105, 0.25, 0.04], [0, 0, -angle]);
    }
    add(group, sphereUnit, materials.accent, [0, 0, -0.085], [0.08, 0.08, 0.025]);
  }

  return finishAccessory(accessoryId, DETAIL_ACCESSORY_DEFINITIONS[accessoryId], group);
};
