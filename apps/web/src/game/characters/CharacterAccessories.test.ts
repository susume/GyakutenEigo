import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import {
  BACK_ACCESSORY_IDS,
  DETAIL_ACCESSORY_IDS,
  type PlayerBackAccessoryId,
  type PlayerHeadStyleId
} from "@quizstrike/shared";
import {
  BACK_ACCESSORY_DEFINITIONS,
  DETAIL_ACCESSORY_DEFINITIONS,
  createBackAccessory,
  createDetailAccessory
} from "./CharacterAccessories";
import type { CharacterMaterials } from "./CharacterEquipment";
import { CharacterFactory } from "./CharacterFactory";

const makeMaterials = (): CharacterMaterials => {
  const material = () => new THREE.MeshStandardMaterial({ color: "#8b98a5" });
  return {
    uniform: material(),
    armor: material(),
    cloth: material(),
    accent: material(),
    dark: material(),
    visor: material(),
    skin: material()
  };
};

test("every back cosmetic uses one named socket and a bounded local transform", () => {
  const materials = makeMaterials();
  for (const id of BACK_ACCESSORY_IDS) {
    const definition = BACK_ACCESSORY_DEFINITIONS[id];
    assert.match(definition.socket, /Socket$/);
    assert.equal(definition.position.length, 3);
    assert.equal(definition.rotation.length, 3);
    assert.equal(definition.scale.length, 3);
    const accessory = createBackAccessory(id, materials);
    assert.equal(Boolean(accessory), id !== "none");
    if (accessory) assert.equal(accessory.name, `Accessory_${id}`);
  }
});

test("back gear calibrations use multiple purposeful mount types", () => {
  const mounts = new Set(BACK_ACCESSORY_IDS.map((id) => BACK_ACCESSORY_DEFINITIONS[id].mount));
  assert.ok(mounts.has("upperBack"));
  assert.ok(mounts.has("fullBack"));
  assert.ok(mounts.has("pelvisRear"));
  assert.ok(mounts.has("diagonalBack"));
  assert.equal(BACK_ACCESSORY_DEFINITIONS.devil_tail.socket, "PelvisRearSocket");
  assert.equal(BACK_ACCESSORY_DEFINITIONS.samurai_sword.socket, "DiagonalBackSocket");
  assert.equal(BACK_ACCESSORY_DEFINITIONS.angel_wings.socket, "FullBackSocket");
});

test("tail, cape, and wings expose articulated lightweight motion controls", () => {
  const materials = makeMaterials();
  const expectations = [
    ["devil_tail", "tailSegment", 4],
    ["arena_cape", "capeSegment", 3],
    ["angel_wings", "wing", 2],
    ["angel_wings", "feather", 12],
    ["demon_wings", "wing", 2]
  ] as const;
  for (const [id, kind, minimum] of expectations) {
    const accessory = createBackAccessory(id, materials);
    assert.ok(accessory);
    const controls: THREE.Object3D[] = [];
    accessory.traverse((object) => {
      if (object.userData.cosmeticMotionNode === kind) controls.push(object);
    });
    assert.ok(controls.length >= minimum, `${id} is missing ${kind} controls`);
    assert.equal(controls.every((object) => Array.isArray(object.userData.baseRotation)), true);
  }
});

test("required mix-and-match combinations stay attached through gameplay animation states", () => {
  const combinations: Array<[PlayerHeadStyleId, PlayerBackAccessoryId]> = [
    ["samurai", "twin_swords"],
    ["ninja", "samurai_sword"],
    ["great_white", "angel_wings"],
    ["fox", "devil_tail"],
    ["panda", "demon_wings"],
    ["robot", "boost_pack"],
    ["girl_mid_hair", "snowboard"],
    ["boy_short_hair", "utility_pack"],
    ["rabbit", "arena_cape"],
    ["boy_short_hair", "none"]
  ];
  const factory = new CharacterFactory();
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 2.5, 10);
  for (const team of ["blue", "red"] as const) {
    for (const [headStyleId, backAccessoryId] of combinations) {
      const model = factory.createCharacter({
        playerId: `${team}-${headStyleId}-${backAccessoryId}`,
        team,
        appearance: {
          headStyleId,
          backAccessoryId,
          detailAccessoryId: "none",
          victoryPoseId: "champion",
          appearanceVersion: 6
        }
      });
      const head = model.root.getObjectByName(`HeadStyle_${headStyleId}`);
      assert.ok(head);
      const back = model.root.getObjectByName(`Accessory_${backAccessoryId}`);
      assert.equal(Boolean(back), backAccessoryId !== "none");
      if (back) {
        assert.equal(back.parent?.name, BACK_ACCESSORY_DEFINITIONS[backAccessoryId].socket);
      }
      const states = [
        { speed: 0, crouching: false, aimPitch: 0 },
        { speed: 3.2, crouching: false, aimPitch: 0 },
        { speed: 5.4, crouching: false, aimPitch: 0 },
        { speed: 0, crouching: true, aimPitch: 0 },
        { speed: 0, crouching: false, aimPitch: -0.18 },
        { speed: 0, crouching: false, aimPitch: -0.12, firing: true }
      ];
      states.forEach((state, index) => model.update({
        camera,
        delta: 1 / 60,
        elapsed: index / 60,
        forwardSpeed: state.speed,
        alive: true,
        ...state
      }));
      for (const cue of ["jump", "fire", "respawn", "victory"] as const) {
        model.triggerAnimation(cue);
        model.update({ camera, delta: 1 / 60, elapsed: 1, speed: 0, alive: true });
      }
      assert.equal(model.root.userData.activeHeadStyleId, headStyleId);
      if (backAccessoryId !== "none") assert.equal(model.root.userData.activeBackAccessoryId, backAccessoryId);
      model.dispose();
    }
  }
  factory.dispose();
});

test("running produces follow-through in hair, tail, cape, and wings", () => {
  const factory = new CharacterFactory();
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 2.5, 10);
  for (const backAccessoryId of ["devil_tail", "arena_cape", "angel_wings"] as const) {
    const model = factory.createCharacter({
      playerId: `motion-${backAccessoryId}`,
      team: "blue",
      appearance: {
        headStyleId: "girl_mid_hair",
        backAccessoryId,
        detailAccessoryId: "none",
        victoryPoseId: "champion",
        appearanceVersion: 6
      }
    });
    const movingNodes: THREE.Object3D[] = [];
    model.root.traverse((object) => {
      if (object.userData.cosmeticMotionNode) movingNodes.push(object);
    });
    const before = movingNodes.map((object) => object.rotation.toArray());
    model.update({ camera, delta: 1 / 60, elapsed: 0.75, speed: 5.2, forwardSpeed: 5.2, alive: true });
    assert.ok(movingNodes.some((object, index) => (
      Math.abs(object.rotation.x - before[index][0]) > 0.0001 ||
      Math.abs(object.rotation.y - before[index][1]) > 0.0001 ||
      Math.abs(object.rotation.z - before[index][2]) > 0.0001
    )), `${backAccessoryId} did not animate`);
    model.dispose();
  }
  factory.dispose();
});

test("major back silhouettes survive reduced LOD while local first person remains cosmetic-free", () => {
  const factory = new CharacterFactory();
  const model = factory.createCharacter({
    playerId: "lod-wings",
    team: "blue",
    appearance: {
      headStyleId: "great_white",
      backAccessoryId: "angel_wings",
      detailAccessoryId: "none",
      victoryPoseId: "champion",
      appearanceVersion: 6
    }
  });
  const wings = model.root.getObjectByName("Accessory_angel_wings");
  assert.ok(wings);
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 2, 50);
  model.update({ camera, delta: 1 / 60, elapsed: 0, speed: 0, alive: true });
  assert.equal(wings.visible, true);
  camera.position.z = 90;
  model.update({ camera, delta: 1 / 60, elapsed: 1, speed: 0, alive: true });
  assert.equal(wings.visible, false);
  const firstPerson = factory.createFirstPersonViewModel("blue");
  assert.equal(firstPerson.root.getObjectByName("Accessory_angel_wings"), undefined);
  assert.equal(firstPerson.root.getObjectByName("Accessory_devil_tail"), undefined);
  model.dispose();
  factory.dispose();
});

test("every detail cosmetic uses one named socket and a bounded local transform", () => {
  const materials = makeMaterials();
  for (const id of DETAIL_ACCESSORY_IDS) {
    const definition = DETAIL_ACCESSORY_DEFINITIONS[id];
    assert.match(definition.socket, /Socket$/);
    assert.equal(definition.position.length, 3);
    assert.equal(definition.rotation.length, 3);
    assert.equal(definition.scale.length, 3);
    const accessory = createDetailAccessory(id, materials);
    assert.equal(Boolean(accessory), id !== "none");
    if (accessory) assert.equal(accessory.name, `Accessory_${id}`);
  }
});

test("detail badges are large and have distinct silhouettes", () => {
  const materials = makeMaterials();
  const geometrySignatures = new Set<string>();
  for (const id of DETAIL_ACCESSORY_IDS) {
    if (id === "none") continue;
    const accessory = createDetailAccessory(id, materials);
    assert.ok(accessory);
    accessory.updateMatrixWorld(true);
    const size = new THREE.Vector3();
    new THREE.Box3().setFromObject(accessory).getSize(size);
    assert.ok(Math.max(size.x, size.y) >= 0.2, `${id} is too small to read`);
    geometrySignatures.add(
      accessory.children
        .map((child) => child instanceof THREE.Mesh ? child.geometry.type : child.type)
        .join(":")
    );
  }
  assert.equal(geometrySignatures.size, DETAIL_ACCESSORY_IDS.length - 1);
});
