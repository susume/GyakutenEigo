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

const addRing = (
  parent: THREE.Object3D,
  material: THREE.Material,
  position: [number, number, number],
  radius: number,
  tube: number
) => {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 6, 14), material);
  mesh.position.set(...position);
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
    // Quick: compact competition launcher with twin pulse chambers and a short guide rail.
    addBox(weapon, boxGeometry, materials.armor, [0, 0.02, -0.08], [0.2, 0.14, 0.34], [0.04, 0, 0]);
    addBox(weapon, boxGeometry, materials.dark, [0, -0.18, -0.08], [0.1, 0.24, 0.14], [0.18, 0, 0]);
    for (const x of [-0.095, 0.095]) {
      addCylinder(weapon, new THREE.CylinderGeometry(0.055, 0.065, 0.5, 10), materials.accent, [x, 0.03, 0.36]);
    }
    addBox(weapon, boxGeometry, materials.dark, [0, -0.01, 0.48], [0.18, 0.07, 0.28], [0.02, 0, 0]);
    addBox(weapon, boxGeometry, materials.accent, [0, 0.17, 0.02], [0.06, 0.07, 0.2], [-0.08, 0, 0]);
    addRing(weapon, materials.accent, [0, 0.01, 0.77], 0.12, 0.025);
    muzzleZ = 0.82;
  } else if (gearId === "power_blaster") {
    // Heavy: long-range arena projector with a large energy cell and dual-stage optic.
    addBox(weapon, boxGeometry, materials.armor, [0, 0, -0.02], [0.22, 0.16, 0.46], [0.03, 0, 0]);
    addCylinder(weapon, new THREE.CylinderGeometry(0.14, 0.14, 0.46, 12), materials.accent, [0, 0.01, -0.22]);
    addBox(weapon, boxGeometry, materials.dark, [0, -0.2, -0.03], [0.11, 0.28, 0.16], [0.16, 0, 0]);
    addCylinder(weapon, new THREE.CylinderGeometry(0.07, 0.085, 1.08, 12), materials.dark, [0, 0.02, 0.72]);
    addRing(weapon, materials.accent, [0, 0.02, 0.36], 0.14, 0.028);
    addRing(weapon, materials.accent, [0, 0.02, 1.06], 0.12, 0.025);
    addCylinder(weapon, new THREE.CylinderGeometry(0.095, 0.095, 0.62, 12), materials.visor, [0, 0.24, 0.22]);
    addRing(weapon, materials.accent, [0, 0.24, 0.54], 0.105, 0.024);
    addBox(weapon, boxGeometry, materials.dark, [0, 0.14, 0.05], [0.045, 0.13, 0.05]);
    addBox(weapon, boxGeometry, materials.dark, [0, 0.14, 0.43], [0.045, 0.13, 0.05]);
    muzzleZ = 1.3;
  } else {
    // Starter: balanced arena blaster with a visible snow-charge chamber.
    addBox(weapon, boxGeometry, materials.armor, [0, 0.02, -0.04], [0.2, 0.15, 0.42], [0.05, 0, 0]);
    addCylinder(weapon, new THREE.CylinderGeometry(0.12, 0.12, 0.42, 12), materials.visor, [0, 0.04, -0.2]);
    addBox(weapon, boxGeometry, materials.dark, [0, -0.19, -0.05], [0.1, 0.27, 0.16], [0.18, 0, 0]);
    addCylinder(weapon, new THREE.CylinderGeometry(0.065, 0.075, 0.72, 12), materials.dark, [0, 0.02, 0.54]);
    addRing(weapon, materials.accent, [0, 0.02, 0.22], 0.13, 0.026);
    addRing(weapon, materials.accent, [0, 0.02, 0.9], 0.11, 0.024);
    muzzleZ = 0.95;
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
  const size = appearance.silhouette.backpack === "bedroll" ? [0.66, 0.5, 0.2] : [0.54, 0.68, 0.18];
  addBox(backpack, boxGeometry, materials.cloth, [0, 0, 0], size as [number, number, number]);
  addBox(backpack, boxGeometry, materials.accent, [0, 0.08, 0.19], [size[0] * 0.72, 0.08, 0.035]);
  if (appearance.silhouette.backpack === "radio_pack") {
    addCylinder(backpack, new THREE.CylinderGeometry(0.055, 0.055, 0.44, 8), materials.visor, [0.18, 0.22, 0.12], [0, 0, 0]);
  }
  return backpack;
};
