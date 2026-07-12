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

const addCylinder = (
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number],
  rotation: [number, number, number] = [Math.PI / 2, 0, 0]
) => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
};

export const createWeaponSet = (
  materials: CharacterMaterials,
  boxGeometry: THREE.BufferGeometry,
  gearId = "starter_blaster"
) => {
  const weapon = new THREE.Group();
  let muzzleZ = 0.9;

  if (gearId === "quick_blaster") {
    // Compact assault-SMG profile: short handguard, squared receiver, and a visible magazine.
    addBox(weapon, boxGeometry, materials.dark, [0, 0, 0.04], [0.14, 0.1, 0.42], [0.06, 0, 0]);
    addBox(weapon, boxGeometry, materials.armor, [0, 0.04, -0.18], [0.18, 0.14, 0.22], [0.06, 0, 0]);
    addBox(weapon, boxGeometry, materials.dark, [0, -0.18, -0.03], [0.1, 0.25, 0.17], [0.12, 0, 0]);
    addBox(weapon, boxGeometry, materials.dark, [0, -0.01, 0.4], [0.1, 0.08, 0.22], [0.04, 0, 0]);
    addBox(weapon, boxGeometry, materials.accent, [0, 0.1, -0.2], [0.05, 0.035, 0.18], [0, 0, 0]);
    addCylinder(weapon, new THREE.CylinderGeometry(0.052, 0.052, 0.58, 10), materials.dark, [0, 0.02, 0.62]);
    muzzleZ = 0.94;
  } else if (gearId === "power_blaster") {
    // Long AWP-style profile: heavy stock, long barrel, scope tube, and scope mounts.
    addBox(weapon, boxGeometry, materials.dark, [0, 0, 0.1], [0.16, 0.12, 0.34], [0.04, 0, 0]);
    addBox(weapon, boxGeometry, materials.dark, [0, -0.02, 0.42], [0.12, 0.1, 0.5], [0.04, 0, 0]);
    addBox(weapon, boxGeometry, materials.armor, [0, 0.03, -0.18], [0.19, 0.15, 0.22], [0.04, 0, 0]);
    addBox(weapon, boxGeometry, materials.dark, [0, -0.18, -0.05], [0.1, 0.25, 0.18], [0.12, 0, 0]);
    addCylinder(weapon, new THREE.CylinderGeometry(0.045, 0.055, 1.08, 10), materials.dark, [0, 0.02, 0.88]);
    addCylinder(weapon, new THREE.CylinderGeometry(0.07, 0.07, 0.58, 10), materials.visor, [0, 0.2, 0.3]);
    addCylinder(weapon, new THREE.CylinderGeometry(0.1, 0.1, 0.06, 10), materials.accent, [0, 0.2, 0.61]);
    addBox(weapon, boxGeometry, materials.dark, [0, 0.12, 0.05], [0.035, 0.12, 0.04]);
    addBox(weapon, boxGeometry, materials.dark, [0, 0.12, 0.52], [0.035, 0.12, 0.04]);
    addBox(weapon, boxGeometry, materials.accent, [0, 0.05, -0.2], [0.05, 0.035, 0.16]);
    muzzleZ = 1.48;
  } else {
    // The default launcher keeps the original compact silhouette.
    addBox(weapon, boxGeometry, materials.dark, [0, 0, 0], [0.12, 0.1, 0.86], [0.06, 0, 0]);
    addBox(weapon, boxGeometry, materials.dark, [0, -0.05, 0.44], [0.07, 0.06, 0.42], [0.06, 0, 0]);
    addBox(weapon, boxGeometry, materials.armor, [0.01, 0.05, -0.1], [0.16, 0.13, 0.32], [0.06, 0, 0]);
    addBox(weapon, boxGeometry, materials.accent, [0.01, 0.09, -0.22], [0.04, 0.035, 0.12], [0.06, 0, 0]);
  }

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, muzzleZ);
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
