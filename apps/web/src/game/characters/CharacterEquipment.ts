import * as THREE from "three";
import type { CharacterAppearance } from "./CharacterAppearance.js";

export interface CharacterMaterials {
  uniform: THREE.MeshStandardMaterial;
  armor: THREE.MeshStandardMaterial;
  cloth: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  visor: THREE.MeshStandardMaterial;
  skin: THREE.MeshStandardMaterial;
}

export interface EquipmentParts {
  weapon: THREE.Group;
  muzzle: THREE.Object3D;
  backpack?: THREE.Object3D;
}

const addBox = (
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
  parent.add(mesh);
  return mesh;
};

export const createWeaponSet = (materials: CharacterMaterials, boxGeometry: THREE.BufferGeometry) => {
  const weapon = new THREE.Group();
  addBox(weapon, boxGeometry, materials.dark, [0, 0, 0], [0.12, 0.1, 0.86], [0.06, 0, 0]);
  addBox(weapon, boxGeometry, materials.dark, [0, -0.05, 0.44], [0.07, 0.06, 0.42], [0.06, 0, 0]);
  addBox(weapon, boxGeometry, materials.armor, [0.01, 0.05, -0.1], [0.16, 0.13, 0.32], [0.06, 0, 0]);
  addBox(weapon, boxGeometry, materials.accent, [0.01, 0.09, -0.22], [0.04, 0.035, 0.12], [0.06, 0, 0]);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, 0.9);
  weapon.add(muzzle);
  return { weapon, muzzle };
};

export const createBackpack = (
  appearance: CharacterAppearance,
  materials: CharacterMaterials,
  boxGeometry: THREE.BufferGeometry
) => {
  if (appearance.silhouette.backpack === "none") return undefined;
  const backpack = new THREE.Group();
  const size = appearance.silhouette.backpack === "bedroll" ? [0.68, 0.52, 0.22] : [0.56, 0.74, 0.2];
  addBox(backpack, boxGeometry, materials.armor, [0, 0, 0], size as [number, number, number]);
  if (appearance.silhouette.backpack === "radio_pack") {
    addBox(backpack, boxGeometry, materials.dark, [0.18, 0.35, 0.08], [0.035, 0.48, 0.035], [0.18, 0, 0]);
  }
  return backpack;
};
