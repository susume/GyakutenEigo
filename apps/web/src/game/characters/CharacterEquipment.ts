import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export interface CharacterMaterials {
  uniform: THREE.MeshStandardMaterial;
  armor: THREE.MeshStandardMaterial;
  cloth: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  visor: THREE.MeshStandardMaterial;
  skin: THREE.MeshStandardMaterial;
  weaponArmor?: THREE.MeshStandardMaterial;
  weaponDark?: THREE.MeshStandardMaterial;
  weaponCold?: THREE.MeshStandardMaterial;
}

export interface EquipmentParts {
  weapon: THREE.Group;
  weaponDetails: THREE.Object3D;
  muzzle: THREE.Object3D;
  weaponSocket: THREE.Object3D;
  rearHandGrip: THREE.Object3D;
  leftHandSupport: THREE.Object3D;
  shoulderContact: THREE.Object3D;
  sight: THREE.Object3D;
  accessories: THREE.Object3D[];
}

export interface WeaponMountTransform {
  position: readonly [number, number, number];
  rotation: readonly [number, number, number];
  scale: number;
  support: readonly [number, number, number];
  rearGrip: readonly [number, number, number];
  shoulder: readonly [number, number, number];
  muzzle: readonly [number, number, number];
  sight: readonly [number, number, number];
  firstPerson: {
    position: readonly [number, number, number];
    rotation: readonly [number, number, number];
    scale: readonly [number, number, number];
  };
}

const QS_AR1_BASE: Omit<WeaponMountTransform, "muzzle" | "sight"> = {
  position: [0.012, 0.165, -0.148],
  rotation: [0, Math.PI, -0.055],
  scale: 0.74,
  rearGrip: [0, -0.22, -0.2],
  support: [0.37, -0.05, -0.02],
  shoulder: [-0.18, 0.27, -0.77],
  firstPerson: {
    position: [-0.12, 0.02, -0.18],
    rotation: [-0.025, Math.PI, 0.01],
    scale: [0.78, 0.78, 0.78]
  }
};

export const WEAPON_MOUNT_TRANSFORMS: Record<string, WeaponMountTransform> = {
  starter_blaster: {
    ...QS_AR1_BASE,
    muzzle: [0, 0.035, 1.28],
    sight: [0, 0.35, -0.1]
  },
  quick_blaster: {
    ...QS_AR1_BASE,
    position: [0.012, 0.16, -0.145],
    scale: 0.71,
    support: [0.37, -0.05, -0.035],
    muzzle: [0, 0.035, 1.13],
    sight: [0, 0.33, -0.08],
    firstPerson: {
      position: [-0.11, 0.025, -0.17],
      rotation: [-0.02, Math.PI, 0.008],
      scale: [0.76, 0.76, 0.76]
    }
  },
  power_blaster: {
    ...QS_AR1_BASE,
    position: [0.012, 0.17, -0.15],
    scale: 0.72,
    support: [0.38, -0.045, 0],
    shoulder: [-0.18, 0.27, -0.79],
    muzzle: [0, 0.04, 1.48],
    sight: [0, 0.39, -0.02],
    firstPerson: {
      position: [-0.13, 0.005, -0.2],
      rotation: [-0.03, Math.PI, 0.01],
      scale: [0.73, 0.73, 0.73]
    }
  }
};

export const getWeaponMountTransform = (gearId = "starter_blaster") =>
  WEAPON_MOUNT_TRANSFORMS[gearId] ?? WEAPON_MOUNT_TRANSFORMS.starter_blaster;

type WeaponMaterialSlot = "armor" | "dark" | "accent" | "cold";
type WeaponPart = {
  geometry: "rounded" | "cylinder" | "tapered" | "torus" | "capsule";
  material: WeaponMaterialSlot;
  position: readonly [number, number, number];
  scale: readonly [number, number, number];
  rotation?: readonly [number, number, number];
  detail?: boolean;
};

const SHARED_WEAPON_SOURCE_GEOMETRY = {
  box: new THREE.BoxGeometry(1, 1, 1),
  rounded: new RoundedBoxGeometry(1, 1, 1, 2, 0.12),
  cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
  tapered: new THREE.CylinderGeometry(0.42, 0.5, 1, 10),
  torus: new THREE.TorusGeometry(0.5, 0.1, 6, 16),
  capsule: new THREE.CapsuleGeometry(0.5, 0.5, 4, 8)
} as const;

const MATERIAL_ORDER: WeaponMaterialSlot[] = ["armor", "dark", "accent", "cold"];
const weaponGeometryCache = new Map<string, { silhouette: THREE.BufferGeometry; details: THREE.BufferGeometry }>();

const rounded = (
  material: WeaponMaterialSlot,
  position: WeaponPart["position"],
  scale: WeaponPart["scale"],
  rotation?: WeaponPart["rotation"],
  detail = false
): WeaponPart => ({ geometry: "rounded", material, position, scale, rotation, detail });

const cylinder = (
  material: WeaponMaterialSlot,
  position: WeaponPart["position"],
  diameter: number,
  length: number,
  detail = false
): WeaponPart => ({
  geometry: "cylinder",
  material,
  position,
  scale: [diameter, length, diameter],
  rotation: [Math.PI / 2, 0, 0],
  detail
});

const ring = (
  material: WeaponMaterialSlot,
  position: WeaponPart["position"],
  diameter: number,
  thickness: number,
  rotation: WeaponPart["rotation"] = [0, 0, 0],
  detail = false
): WeaponPart => ({
  geometry: "torus",
  material,
  position,
  scale: [diameter, diameter, thickness * 5],
  rotation,
  detail
});

const createQsArenaRifleParts = (gearId: string): WeaponPart[] => {
  const quick = gearId === "quick_blaster";
  const heavy = gearId === "power_blaster";
  const handguardCenter = quick ? 0.43 : heavy ? 0.54 : 0.49;
  const handguardLength = quick ? 0.46 : heavy ? 0.68 : 0.58;
  const barrelStart = handguardCenter + handguardLength * 0.43;
  const muzzleZ = getWeaponMountTransform(gearId).muzzle[2];
  const parts: WeaponPart[] = [
    // Rounded shoulder stock and cheek pad.
    rounded("dark", [-0.1, 0.015, -0.78], [0.39, 0.48, 0.3], [-0.06, 0, 0]),
    rounded("armor", [-0.075, 0.15, -0.65], [0.37, 0.21, 0.38], [-0.04, 0, 0]),
    rounded("dark", [-0.035, 0.045, -0.49], [0.32, 0.22, 0.32], [0.02, 0, 0]),
    rounded("accent", [-0.1, -0.015, -0.91], [0.41, 0.35, 0.055], [-0.06, 0, 0]),

    // Main receiver mass and readable side shell.
    rounded("dark", [0, -0.005, -0.12], [0.41, 0.34, 0.72], [0.025, 0, 0]),
    rounded("armor", [0, 0.065, -0.13], [0.44, 0.29, 0.64], [0.025, 0, 0]),
    rounded("dark", [0, -0.12, 0.05], [0.34, 0.12, 0.36], [0.03, 0, 0]),
    rounded("accent", [0.222, 0.035, -0.18], [0.035, 0.09, 0.28], [0.02, 0, 0]),
    rounded("accent", [-0.222, 0.035, -0.18], [0.035, 0.09, 0.28], [0.02, 0, 0]),

    // Glove-sized rear grip and fictional snow cell.
    rounded("dark", [0, -0.27, -0.2], [0.19, 0.39, 0.2], [0.19, 0, 0]),
    { geometry: "capsule", material: "cold", position: [0, -0.31, 0.08], scale: [0.19, 0.22, 0.19] },
    rounded("dark", [0, -0.31, 0.08], [0.225, 0.11, 0.225]),
    ring("accent", [0, -0.43, 0.08], 0.22, 0.025, [Math.PI / 2, 0, 0]),

    // Broad handguard, integrated foregrip, and substantial barrel housing.
    rounded("dark", [0, 0.005, handguardCenter], [0.39, 0.3, handguardLength], [0.01, 0, 0]),
    rounded("armor", [0, 0.075, handguardCenter - 0.015], [0.42, 0.2, handguardLength * 0.92], [0.01, 0, 0]),
    rounded("dark", [0.2, -0.055, -0.015], [0.42, 0.17, 0.2], [0, 0, -0.08]),
    rounded("accent", [0.365, -0.04, -0.018], [0.07, 0.195, 0.22], [0, 0, -0.08]),
    cylinder("dark", [0, 0.03, (barrelStart + muzzleZ) * 0.5], heavy ? 0.27 : 0.24, muzzleZ - barrelStart),
    cylinder("armor", [0, 0.03, muzzleZ - 0.17], heavy ? 0.31 : 0.29, 0.27),
    cylinder("dark", [0, 0.03, muzzleZ - 0.055], heavy ? 0.38 : 0.35, 0.2),
    ring("accent", [0, 0.03, muzzleZ - 0.035], heavy ? 0.39 : 0.36, 0.045),
    ring("cold", [0, 0.03, muzzleZ + 0.006], heavy ? 0.28 : 0.255, 0.035),

    // Compact fictional holo sight.
    rounded("dark", [0, 0.255, -0.1], [0.24, 0.075, 0.3]),
    rounded("dark", [-0.105, 0.355, -0.09], [0.055, 0.22, 0.08], [-0.08, 0, 0]),
    rounded("dark", [0.105, 0.355, -0.09], [0.055, 0.22, 0.08], [-0.08, 0, 0]),
    rounded("dark", [0, 0.455, -0.08], [0.25, 0.055, 0.1], [-0.08, 0, 0]),
    rounded("cold", [0, 0.36, -0.08], [0.16, 0.13, 0.018], [-0.08, 0, 0])
  ];

  // Large, low-count storytelling details remain readable up close and disappear at LOD2.
  for (const side of [-1, 1]) {
    for (let index = 0; index < (heavy ? 4 : 3); index += 1) {
      parts.push(rounded(
        "dark",
        [side * 0.216, 0.11, handguardCenter - 0.17 + index * 0.14],
        [0.025, 0.055, 0.08],
        [0, 0, 0],
        true
      ));
    }
    parts.push(
      rounded("armor", [side * 0.227, 0.06, -0.19], [0.022, 0.16, 0.23], [0, 0, 0], true),
      rounded("accent", [side * 0.226, -0.01, 0.08], [0.024, 0.055, 0.22], [0, 0, 0], true),
      rounded("accent", [side * 0.12, -0.315, 0.195], [0.025, 0.035, 0.12], [0, 0, 0], true),
      rounded("accent", [side * 0.12, -0.315, -0.035], [0.025, 0.035, 0.12], [0, 0, 0], true)
    );
  }

  // A restrained snowflake glyph on the snow cell, built from broad geometry.
  for (const side of [-1, 1]) {
    parts.push(
      rounded("cold", [side * 0.118, -0.31, 0.08], [0.018, 0.19, 0.025], [0, 0, 0], true),
      rounded("cold", [side * 0.119, -0.31, 0.08], [0.018, 0.17, 0.025], [Math.PI / 3, 0, 0], true),
      rounded("cold", [side * 0.119, -0.31, 0.08], [0.018, 0.17, 0.025], [-Math.PI / 3, 0, 0], true)
    );
  }

  if (quick) {
    parts.push(
      cylinder("accent", [-0.16, 0.02, 0.7], 0.12, 0.34),
      cylinder("accent", [0.16, 0.02, 0.7], 0.12, 0.34)
    );
  } else if (heavy) {
    parts.push(
      cylinder("cold", [0, 0.37, 0.08], 0.17, 0.58),
      ring("accent", [0, 0.37, 0.31], 0.18, 0.025),
      ring("accent", [0, 0.37, -0.15], 0.18, 0.025)
    );
  }

  return parts;
};

const transformedGeometry = (part: WeaponPart) => {
  const geometryKind = part.detail && part.geometry === "rounded" ? "box" : part.geometry;
  const source = SHARED_WEAPON_SOURCE_GEOMETRY[geometryKind].clone();
  const geometry = source.index ? source.toNonIndexed() : source;
  if (geometry !== source) source.dispose();
  const rotation = new THREE.Euler(...(part.rotation ?? [0, 0, 0]));
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(...part.position),
    new THREE.Quaternion().setFromEuler(rotation),
    new THREE.Vector3(...part.scale)
  );
  geometry.applyMatrix4(matrix);
  return geometry;
};

const mergeWeaponLayer = (parts: WeaponPart[], detail: boolean) => {
  const materialGeometries = MATERIAL_ORDER.map((material) => {
    const geometries = parts
      .filter((part) => Boolean(part.detail) === detail && part.material === material)
      .map(transformedGeometry);
    if (geometries.length === 0) return new THREE.BufferGeometry();
    const merged = mergeGeometries(geometries, false);
    geometries.forEach((geometry) => geometry.dispose());
    if (!merged) throw new Error(`Unable to merge QS AR-1 ${material} geometry.`);
    return merged;
  });
  const merged = mergeGeometries(materialGeometries, true);
  materialGeometries.forEach((geometry) => geometry.dispose());
  if (!merged) throw new Error("Unable to merge QS AR-1 weapon geometry.");
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
};

const weaponGeometryFor = (gearId: string) => {
  const cacheKey = WEAPON_MOUNT_TRANSFORMS[gearId] ? gearId : "starter_blaster";
  const cached = weaponGeometryCache.get(cacheKey);
  if (cached) return cached;
  const parts = createQsArenaRifleParts(cacheKey);
  const geometry = {
    silhouette: mergeWeaponLayer(parts, false),
    details: mergeWeaponLayer(parts, true)
  };
  weaponGeometryCache.set(cacheKey, geometry);
  return geometry;
};

const makeAnchor = (
  weapon: THREE.Object3D,
  name: string,
  position: readonly [number, number, number]
) => {
  const anchor = new THREE.Object3D();
  anchor.name = name;
  anchor.position.set(...position);
  weapon.add(anchor);
  return anchor;
};

export const createWeaponSet = (
  materials: CharacterMaterials,
  _boxGeometry: THREE.BufferGeometry,
  gearId = "starter_blaster"
) => {
  const calibration = getWeaponMountTransform(gearId);
  const geometry = weaponGeometryFor(gearId);
  const weaponMaterials = [
    materials.weaponArmor ?? materials.armor,
    materials.weaponDark ?? materials.dark,
    materials.accent,
    materials.weaponCold ?? materials.visor
  ];
  const weapon = new THREE.Group();
  weapon.name = `qs_ar1_${gearId}`;
  weapon.userData.weaponPlatform = "QS AR-1";
  weapon.userData.gearId = gearId;

  const silhouette = new THREE.Mesh(geometry.silhouette, weaponMaterials);
  silhouette.name = "QS_AR1_Silhouette";
  silhouette.castShadow = true;
  silhouette.receiveShadow = true;
  weapon.add(silhouette);

  const weaponDetails = new THREE.Mesh(geometry.details, weaponMaterials);
  weaponDetails.name = "QS_AR1_Details";
  weaponDetails.castShadow = true;
  weaponDetails.receiveShadow = true;
  weapon.add(weaponDetails);

  const rearHandGrip = makeAnchor(weapon, "RearHandGrip", calibration.rearGrip);
  const leftHandSupport = makeAnchor(weapon, "SupportGrip", calibration.support);
  const shoulderContact = makeAnchor(weapon, "ShoulderContact", calibration.shoulder);
  const muzzle = makeAnchor(weapon, "MuzzleSocket", calibration.muzzle);
  const sight = makeAnchor(weapon, "SightSocket", calibration.sight);

  return {
    weapon,
    weaponDetails,
    muzzle,
    rearHandGrip,
    leftHandSupport,
    shoulderContact,
    sight
  };
};
