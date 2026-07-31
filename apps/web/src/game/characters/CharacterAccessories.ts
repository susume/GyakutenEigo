import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { PlayerBackAccessoryId } from "@quizstrike/shared";
import type { CharacterMaterials } from "./CharacterEquipment.js";

export type AccessorySocketName =
  | "HeadSocket"
  | "FaceSocket"
  | "BackSocket"
  | "UpperBackSocket"
  | "FullBackSocket"
  | "LowerBackSocket"
  | "PelvisRearSocket"
  | "DiagonalBackSocket"
  | "ChestDecalSocket"
  | "HipSocket";

export interface AccessoryDefinition<TId extends string = string> {
  id: TId;
  socket: AccessorySocketName;
  position: readonly [number, number, number];
  rotation: readonly [number, number, number];
  scale: readonly [number, number, number];
  mount?: "upperBack" | "fullBack" | "lowerBack" | "pelvisRear" | "diagonalBack";
  motion?: "tail" | "cape" | "wings";
}

export const BACK_ACCESSORY_DEFINITIONS: Record<
  PlayerBackAccessoryId,
  AccessoryDefinition<PlayerBackAccessoryId>
> = {
  none: { id: "none", socket: "UpperBackSocket", mount: "upperBack", position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
  utility_pack: { id: "utility_pack", socket: "UpperBackSocket", mount: "upperBack", position: [0, -0.03, 0.04], rotation: [0, 0, 0], scale: [0.94, 0.94, 0.94] },
  angel_wings: { id: "angel_wings", socket: "FullBackSocket", mount: "fullBack", motion: "wings", position: [0, 0.03, 0.035], rotation: [0, 0, 0], scale: [0.92, 0.92, 0.92] },
  demon_wings: { id: "demon_wings", socket: "FullBackSocket", mount: "fullBack", motion: "wings", position: [0, -0.05, 0.04], rotation: [0, 0, 0], scale: [1, 1, 1] },
  devil_tail: { id: "devil_tail", socket: "PelvisRearSocket", mount: "pelvisRear", motion: "tail", position: [0, 0.03, 0.04], rotation: [0, 0, 0], scale: [0.92, 0.92, 0.92] },
  samurai_sword: { id: "samurai_sword", socket: "DiagonalBackSocket", mount: "diagonalBack", position: [0.05, 0.02, 0.055], rotation: [0, 0, -0.58], scale: [0.92, 0.92, 0.92] },
  twin_swords: { id: "twin_swords", socket: "DiagonalBackSocket", mount: "diagonalBack", position: [0, 0.02, 0.06], rotation: [0, 0, 0], scale: [0.88, 0.88, 0.88] },
  boost_pack: { id: "boost_pack", socket: "UpperBackSocket", mount: "upperBack", position: [0, -0.04, 0.055], rotation: [0, 0, 0], scale: [0.9, 0.9, 0.9] },
  arena_cape: { id: "arena_cape", socket: "UpperBackSocket", mount: "upperBack", motion: "cape", position: [0, 0.05, 0.055], rotation: [0, 0, 0], scale: [0.93, 0.93, 0.93] },
  snowboard: { id: "snowboard", socket: "DiagonalBackSocket", mount: "diagonalBack", position: [0, -0.02, 0.07], rotation: [0, 0, -0.34], scale: [0.88, 0.88, 0.88] }
};

const roundedUnit = new RoundedBoxGeometry(1, 1, 1, 2, 0.12);
const cylinderUnit = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
const coneUnit = new THREE.ConeGeometry(0.5, 1, 8);
const sphereUnit = new THREE.SphereGeometry(0.5, 10, 7);
const torusUnit = new THREE.TorusGeometry(0.5, 0.11, 7, 16);
const createDoubleSidedGeometry = (front: number[]) => {
  const geometry = new THREE.BufferGeometry();
  const back: number[] = [];
  for (let index = 0; index < front.length; index += 9) {
    back.push(
      ...front.slice(index + 6, index + 9),
      ...front.slice(index + 3, index + 6),
      ...front.slice(index, index + 3)
    );
  }
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([...front, ...back], 3));
  geometry.computeVertexNormals();
  return geometry;
};
const createCapePanel = (topWidth: number, bottomWidth: number, height: number, depth: number) =>
  createDoubleSidedGeometry([
    -topWidth, 0, 0, topWidth, 0, 0, -bottomWidth, -height, depth,
    topWidth, 0, 0, bottomWidth, -height, depth, -bottomWidth, -height, depth
  ]);
const createCapeHem = () => {
  const center = [0, -0.05, 0] as const;
  const outline = [
    [-0.33, 0, 0],
    [0.33, 0, 0],
    [0.27, -0.24, 0.06],
    [0.1, -0.21, 0.065],
    [0, -0.3, 0.07],
    [-0.1, -0.21, 0.065],
    [-0.27, -0.24, 0.06],
    [-0.33, 0, 0]
  ] as const;
  const front: number[] = [];
  for (let index = 0; index < outline.length - 1; index += 1) {
    front.push(...center, ...outline[index], ...outline[index + 1]);
  }
  return createDoubleSidedGeometry(front);
};
const capePanels = [
  createCapePanel(0.4, 0.37, 0.28, 0.025),
  createCapePanel(0.37, 0.33, 0.28, 0.045),
  createCapeHem()
] as const;
const featherUnit = createDoubleSidedGeometry([
  0, 0.12, 0, -0.18, 0, 0.018, 0, -0.55, 0.04,
  0, 0.12, 0, 0, -0.55, 0.04, 0.18, 0, 0.018
]);
const wingMembraneUnit = createDoubleSidedGeometry([
  0, 0.12, 0,
  1.02, 1, 0.025,
  0.92, 0.42, 0.045,
  0, 0.12, 0,
  0.92, 0.42, 0.045,
  1.32, 0.2, 0.055,
  0, 0.12, 0,
  1.32, 0.2, 0.055,
  0.96, -0.04, 0.065,
  0, 0.12, 0,
  0.96, -0.04, 0.065,
  1.16, -0.46, 0.07,
  0, 0.12, 0,
  1.16, -0.46, 0.07,
  0.72, -0.3, 0.075,
  0, 0.12, 0,
  0.72, -0.3, 0.075,
  0.64, -0.82, 0.08,
  0, 0.12, 0,
  0.64, -0.82, 0.08,
  0.34, -0.5, 0.065
]);
const demonWingMaterial = new THREE.MeshStandardMaterial({
  color: "#781523",
  roughness: 0.82,
  side: THREE.DoubleSide
});
const angelFeatherMaterial = new THREE.MeshStandardMaterial({
  color: "#f4f1e8",
  roughness: 0.92
});

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

const markMotionNode = (
  object: THREE.Object3D,
  kind: "wing" | "feather" | "tailSegment" | "capeSegment",
  index = 0,
  side = 0
) => {
  object.userData.cosmeticMotionNode = kind;
  object.userData.motionIndex = index;
  object.userData.motionSide = side;
  object.userData.baseRotation = [object.rotation.x, object.rotation.y, object.rotation.z];
  return object;
};

const addBetween = (
  parent: THREE.Object3D,
  material: THREE.Material,
  delta: THREE.Vector3,
  radius: number
) => {
  const mesh = new THREE.Mesh(cylinderUnit, material);
  mesh.position.copy(delta).multiplyScalar(0.5);
  mesh.scale.set(radius, delta.length(), radius);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.preserveSharedResources = true;
  parent.add(mesh);
  return mesh;
};

const addStrut = (
  parent: THREE.Object3D,
  material: THREE.Material,
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number
) => {
  const anchor = new THREE.Group();
  anchor.position.copy(start);
  parent.add(anchor);
  addBetween(anchor, material, end.clone().sub(start), radius);
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
  group.userData.accessorySlot = "back";
  group.userData.mount = definition.mount;
  group.userData.motion = definition.motion;
  group.userData.baseRotation = [...definition.rotation];
  return group;
};

const addSword = (group: THREE.Group, materials: CharacterMaterials, rotation: number, x = 0) => {
  add(group, cylinderUnit, materials.dark, [x, 0, 0], [0.085, 1.05, 0.085], [0, 0, rotation]);
  add(group, cylinderUnit, materials.armor, [x - Math.sin(rotation) * 0.58, Math.cos(rotation) * 0.58, 0], [0.065, 0.34, 0.065], [0, 0, rotation]);
  add(group, cylinderUnit, materials.accent, [x - Math.sin(rotation) * 0.38, Math.cos(rotation) * 0.38, 0], [0.17, 0.055, 0.17], [0, 0, Math.PI / 2]).userData.cosmeticDetail = true;
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
  } else if (accessoryId === "angel_wings") {
    add(group, roundedUnit, materials.accent, [0, 0.12, 0], [0.25, 0.3, 0.12]);
    for (const side of [-1, 1]) {
      const wing = markMotionNode(new THREE.Group(), "wing", 0, side);
      wing.name = `AngelWing_${side < 0 ? "L" : "R"}`;
      wing.position.set(side * 0.08, 0.12, 0);
      wing.rotation.set(0, side * 0.035, side * 0.06);
      wing.userData.baseRotation = [wing.rotation.x, wing.rotation.y, wing.rotation.z];
      group.add(wing);
      const primaryFeathers = [
        [0.25, 0.33, 0.08, 0.8, 0.72],
        [0.4, 0.42, 0.14, 1, 0.78],
        [0.56, 0.52, 0.2, 1.2, 0.82],
        [0.72, 0.61, 0.27, 1.4, 0.84],
        [0.88, 0.68, 0.34, 1.6, 0.83],
        [1.02, 0.72, 0.41, 1.82, 0.78],
        [1.15, 0.71, 0.48, 2, 0.7]
      ] as const;
      primaryFeathers.forEach(([x, y, angle, length, width], index) => {
        const featherPivot = markMotionNode(new THREE.Group(), "feather", index, side);
        featherPivot.position.set(side * x, y, 0.015 + index * 0.004);
        featherPivot.rotation.z = side * angle;
        featherPivot.userData.baseRotation = [0, 0, featherPivot.rotation.z];
        wing.add(featherPivot);
        add(featherPivot, featherUnit, angelFeatherMaterial, [0, 0, 0], [width, length, 1]);
      });
      const secondaryFeathers = [
        [0.15, 0.27, 0.18, 0.62, 0.82],
        [0.28, 0.35, 0.23, 0.72, 0.86],
        [0.41, 0.43, 0.28, 0.82, 0.86],
        [0.54, 0.5, 0.34, 0.92, 0.82],
        [0.67, 0.55, 0.4, 1, 0.75]
      ] as const;
      secondaryFeathers.forEach(([x, y, angle, length, width], index) => {
        const featherPivot = markMotionNode(new THREE.Group(), "feather", index + 8, side);
        featherPivot.position.set(side * x, y, 0.045 + index * 0.004);
        featherPivot.rotation.z = side * angle;
        featherPivot.userData.baseRotation = [0, 0, featherPivot.rotation.z];
        wing.add(featherPivot);
        add(featherPivot, featherUnit, angelFeatherMaterial, [0, 0, 0], [width, length, 1]);
      });
      for (let index = 0; index < 5; index += 1) {
        const covert = markMotionNode(new THREE.Group(), "feather", index + 16, side);
        covert.position.set(side * (0.13 + index * 0.09), 0.38 + index * 0.05, 0.075);
        covert.rotation.z = side * (0.18 + index * 0.055);
        covert.userData.baseRotation = [0, 0, covert.rotation.z];
        wing.add(covert);
        add(covert, featherUnit, angelFeatherMaterial, [0, 0, 0], [0.68, 0.42, 1]).userData.cosmeticDetail = true;
      }
    }
  } else if (accessoryId === "demon_wings") {
    add(group, roundedUnit, materials.accent, [0, 0.13, 0], [0.24, 0.28, 0.11]);
    for (const side of [-1, 1]) {
      const wing = markMotionNode(new THREE.Group(), "wing", 0, side);
      wing.name = `DemonWing_${side < 0 ? "L" : "R"}`;
      wing.position.set(side * 0.08, 0, 0);
      wing.rotation.set(0, side * 0.035, side * 0.035);
      wing.userData.baseRotation = [wing.rotation.x, wing.rotation.y, wing.rotation.z];
      group.add(wing);
      const membrane = new THREE.Mesh(wingMembraneUnit, demonWingMaterial);
      membrane.scale.x = side;
      membrane.castShadow = true;
      membrane.receiveShadow = true;
      membrane.userData.preserveSharedResources = true;
      wing.add(membrane);
      const root = new THREE.Vector3(0, 0.12, 0.09);
      const tips = [
        new THREE.Vector3(side * 1.02, 1, 0.055),
        new THREE.Vector3(side * 1.32, 0.2, 0.085),
        new THREE.Vector3(side * 1.16, -0.46, 0.1),
        new THREE.Vector3(side * 0.64, -0.82, 0.11)
      ];
      tips.forEach((tip, index) => addStrut(wing, materials.dark, root, tip, index === 0 ? 0.045 : 0.035));
      for (let index = 0; index < tips.length - 1; index += 1) {
        addStrut(wing, materials.dark, tips[index], tips[index + 1], 0.026);
      }
      add(wing, sphereUnit, materials.accent, [0, 0.12, 0.105], [0.12, 0.12, 0.065]);
      add(wing, coneUnit, materials.dark, [side * 1.03, 1.04, 0.055], [0.07, 0.18, 0.07], [0, 0, side * -0.73]).userData.cosmeticDetail = true;
    }
  } else if (accessoryId === "devil_tail") {
    const points = [
      [0, 0.08, 0],
      [0.12, -0.1, 0.04],
      [0.28, -0.28, 0.06],
      [0.48, -0.36, 0.04],
      [0.62, -0.24, 0.02]
    ] as const;
    let parent: THREE.Object3D = group;
    for (let index = 0; index < points.length - 1; index += 1) {
      const [ax, ay, az] = points[index];
      const [bx, by, bz] = points[index + 1];
      const joint = markMotionNode(new THREE.Group(), "tailSegment", index, 1);
      joint.name = `TailJoint_${index}`;
      if (index === 0) joint.position.set(ax, ay, az);
      parent.add(joint);
      const delta = new THREE.Vector3(bx - ax, by - ay, bz - az);
      addBetween(joint, materials.dark, delta, 0.07 - index * 0.009);
      add(joint, sphereUnit, materials.dark, [0, 0, 0], [0.074 - index * 0.009, 0.074 - index * 0.009, 0.074 - index * 0.009]);
      const next = new THREE.Group();
      next.position.copy(delta);
      joint.add(next);
      parent = next;
    }
    add(parent, coneUnit, materials.accent, [0.055, 0.035, 0], [0.14, 0.26, 0.08], [0, 0, -0.9]);
  } else if (accessoryId === "samurai_sword") {
    addSword(group, materials, 0);
  } else if (accessoryId === "twin_swords") {
    addSword(group, materials, -0.58, -0.03);
    addSword(group, materials, 0.58, 0.03);
  } else if (accessoryId === "boost_pack") {
    add(group, roundedUnit, materials.dark, [0, 0.05, 0], [0.42, 0.5, 0.17]);
    for (const x of [-0.17, 0.17]) {
      add(group, cylinderUnit, materials.armor, [x, -0.04, 0.04], [0.11, 0.55, 0.11]);
      add(group, coneUnit, materials.accent, [x, -0.4, 0.04], [0.13, 0.24, 0.13], [0, 0, Math.PI]);
    }
    add(group, roundedUnit, materials.armor, [0, 0.13, 0.15], [0.2, 0.15, 0.05]);
    add(group, sphereUnit, materials.visor, [0, 0.13, 0.19], [0.07, 0.07, 0.025]).userData.cosmeticDetail = true;
  } else if (accessoryId === "arena_cape") {
    let parent: THREE.Object3D = group;
    const capeRoot = new THREE.Group();
    capeRoot.position.set(0, 0.3, 0);
    group.add(capeRoot);
    parent = capeRoot;
    capePanels.forEach((geometry, index) => {
      const hinge = new THREE.Group();
      hinge.rotation.x = [-0.025, -0.045, -0.065][index];
      markMotionNode(hinge, "capeSegment", index);
      hinge.name = `CapeHinge_${index}`;
      parent.add(hinge);
      const cape = new THREE.Mesh(geometry, materials.uniform);
      cape.castShadow = true;
      cape.receiveShadow = true;
      cape.userData.preserveSharedResources = true;
      hinge.add(cape);
      const next = new THREE.Group();
      next.position.set(0, -[0.28, 0.28, 0.3][index], [0.025, 0.045, 0.07][index]);
      hinge.add(next);
      parent = next;
    });
    add(group, cylinderUnit, materials.dark, [0, 0.25, 0.035], [0.055, 0.68, 0.055], [0, 0, Math.PI / 2]);
    add(group, sphereUnit, materials.accent, [0, -0.1, 0.075], [0.12, 0.12, 0.035]).userData.cosmeticDetail = true;
  } else if (accessoryId === "snowboard") {
    add(group, roundedUnit, materials.armor, [0, 0, 0], [0.32, 1.15, 0.09]);
    add(group, roundedUnit, materials.dark, [0, -0.22, 0.1], [0.25, 0.16, 0.04], [0, 0, 0.16]);
    add(group, roundedUnit, materials.dark, [0, 0.22, 0.1], [0.25, 0.16, 0.04], [0, 0, -0.16]);
    add(group, roundedUnit, materials.accent, [0, 0.55, 0.105], [0.2, 0.12, 0.025]).userData.cosmeticDetail = true;
  }

  return finishAccessory(accessoryId, BACK_ACCESSORY_DEFINITIONS[accessoryId], group);
};
