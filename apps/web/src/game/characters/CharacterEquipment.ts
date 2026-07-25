import * as THREE from "three";

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
  weaponSocket: THREE.Object3D;
  leftHandSupport: THREE.Object3D;
  accessory?: THREE.Object3D;
}

export interface WeaponMountTransform {
  position: readonly [number, number, number];
  rotation: readonly [number, number, number];
  scale: number;
  support: readonly [number, number, number];
}

export const WEAPON_MOUNT_TRANSFORMS: Record<string, WeaponMountTransform> = {
  starter_blaster: {
    position: [0, 0.14, -0.06],
    rotation: [-0.08, Math.PI, -0.12],
    scale: 0.68,
    support: [0, 0.02, 0.5]
  },
  quick_blaster: {
    position: [0, 0.13, -0.05],
    rotation: [-0.04, Math.PI, -0.1],
    scale: 0.7,
    support: [0, 0.02, 0.38]
  },
  power_blaster: {
    position: [0, 0.15, -0.08],
    rotation: [-0.1, Math.PI, -0.14],
    scale: 0.62,
    support: [0, 0.03, 0.58]
  }
};

export const getWeaponMountTransform = (gearId = "starter_blaster") =>
  WEAPON_MOUNT_TRANSFORMS[gearId] ?? WEAPON_MOUNT_TRANSFORMS.starter_blaster;

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
  mesh.userData.disposeWithCharacterGeometry = true;
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
  mesh.userData.disposeWithCharacterGeometry = true;
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
  weapon.name = `snowball_blaster_${gearId}`;
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
  muzzle.name = "MuzzleSocket";
  muzzle.position.set(0, 0, muzzleZ);
  weapon.add(muzzle);
  const leftHandSupport = new THREE.Object3D();
  leftHandSupport.name = "LeftHandSupport";
  leftHandSupport.position.set(...getWeaponMountTransform(gearId).support);
  weapon.add(leftHandSupport);
  return { weapon, muzzle, leftHandSupport };
};
