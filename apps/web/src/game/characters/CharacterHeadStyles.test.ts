import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { HEAD_STYLE_IDS } from "@quizstrike/shared";
import {
  HEAD_STYLE_REGISTRY,
  createHeadStyle
} from "./CharacterHeadStyles.js";
import { CharacterFactory } from "./CharacterFactory.js";
import type { CharacterMaterials } from "./CharacterEquipment.js";

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

test("every registered style builds one complete bounded head", () => {
  const materials = makeMaterials();
  for (const id of HEAD_STYLE_IDS) {
    const definition = HEAD_STYLE_REGISTRY[id];
    const head = createHeadStyle(id, materials);
    assert.equal(head.name, `HeadStyle_${id}`);
    assert.equal(head.userData.primaryHeadVisual, true);
    assert.equal(head.children.length > 0, true);

    head.updateMatrixWorld(true);
    const size = new THREE.Vector3();
    new THREE.Box3().setFromObject(head).getSize(size);
    assert.ok(size.x >= 0.45 && size.x <= 0.9, `${id} width is outside the visual envelope`);
    assert.ok(size.y >= 0.45 && size.y <= 1.05, `${id} height is outside the visual envelope`);
    assert.ok(size.z >= 0.4 && size.z <= 0.9, `${id} depth is outside the visual envelope`);
    assert.equal(definition.position.length, 3);
    assert.equal(definition.rotation.length, 3);
    assert.equal(definition.scale.length, 3);
  }
});

test("invalid head styles fail safely to human", () => {
  const head = createHeadStyle("missing-style", makeMaterials());
  assert.equal(head.name, "HeadStyle_human");
  assert.equal(head.userData.fallbackFrom, "missing-style");
});

test("a style build failure falls back to human", () => {
  const originalBuilder = HEAD_STYLE_REGISTRY.fox.create;
  HEAD_STYLE_REGISTRY.fox.create = () => {
    throw new Error("simulated asset failure");
  };
  try {
    const head = createHeadStyle("fox", makeMaterials());
    assert.equal(head.name, "HeadStyle_human");
    assert.equal(head.userData.fallbackFrom, "fox");
  } finally {
    HEAD_STYLE_REGISTRY.fox.create = originalBuilder;
  }
});

test("a character contains exactly one primary head visual and fixed hitboxes", () => {
  const factory = new CharacterFactory();
  const model = factory.createCharacter({
    playerId: "head-style-test",
    team: "blue",
    appearance: {
      characterPreset: "assault",
      headStyleId: "rabbit",
      backAccessoryId: "none",
      detailAccessoryId: "none",
      victoryPoseId: "champion",
      appearanceVersion: 4
    }
  });
  const primaryHeads: THREE.Object3D[] = [];
  model.root.traverse((object) => {
    if (object.userData.primaryHeadVisual) primaryHeads.push(object);
  });
  assert.equal(primaryHeads.length, 1);
  assert.equal(primaryHeads[0].name, "HeadStyle_rabbit");
  assert.equal(model.hitboxes.update(new THREE.Vector3()).find((hitbox) => hitbox.region === "head")?.damageMultiplier, 4);
  model.dispose();
  factory.dispose();
});

test("two players can share a style without sharing scene nodes", () => {
  const factory = new CharacterFactory();
  const appearance = {
    characterPreset: "assault" as const,
    headStyleId: "fox" as const,
    backAccessoryId: "none" as const,
    detailAccessoryId: "none" as const,
    victoryPoseId: "champion" as const,
    appearanceVersion: 4 as const
  };
  const first = factory.createCharacter({ playerId: "first", team: "blue", appearance });
  const second = factory.createCharacter({ playerId: "second", team: "red", appearance });
  const firstHead = first.root.getObjectByName("HeadStyle_fox");
  const secondHead = second.root.getObjectByName("HeadStyle_fox");
  assert.ok(firstHead && secondHead);
  assert.notEqual(firstHead, secondHead);
  first.dispose();
  second.dispose();
  factory.dispose();
});

test("rapid replacement never grows the scene beyond one active character or head", () => {
  const factory = new CharacterFactory();
  const scene = new THREE.Scene();
  let active: ReturnType<CharacterFactory["createCharacter"]> | undefined;
  const sequence = [...HEAD_STYLE_IDS, ...HEAD_STYLE_IDS, ...HEAD_STYLE_IDS];
  for (const headStyleId of sequence) {
    if (active) {
      scene.remove(active.root);
      active.dispose();
    }
    active = factory.createCharacter({
      playerId: "rapid-switch",
      team: "blue",
      appearance: {
        characterPreset: "assault",
        headStyleId,
        backAccessoryId: "none",
        detailAccessoryId: "none",
        victoryPoseId: "champion",
        appearanceVersion: 4
      }
    });
    scene.add(active.root);
    const primaryHeads: THREE.Object3D[] = [];
    active.root.traverse((object) => {
      if (object.userData.primaryHeadVisual) primaryHeads.push(object);
    });
    assert.equal(scene.children.length, 1);
    assert.equal(primaryHeads.length, 1);
    assert.equal(primaryHeads[0].name, `HeadStyle_${headStyleId}`);
  }
  active?.dispose();
  factory.dispose();
});

test("vertical movement and respawn animation keep the complete head attached", () => {
  const factory = new CharacterFactory();
  const model = factory.createCharacter({
    playerId: "vertical-head",
    team: "red",
    appearance: {
      characterPreset: "assault",
      headStyleId: "robot",
      backAccessoryId: "none",
      detailAccessoryId: "none",
      victoryPoseId: "champion",
      appearanceVersion: 4
    }
  });
  const head = model.root.getObjectByName("HeadStyle_robot");
  assert.ok(head);
  model.setWorldState(4, 8, 0.4, true, 2.25);
  model.triggerAnimation("respawn");
  model.update({
    camera: new THREE.PerspectiveCamera(),
    delta: 1 / 60,
    elapsed: 1,
    speed: 0,
    alive: true
  });
  model.root.updateMatrixWorld(true);
  const worldHead = new THREE.Vector3();
  head.getWorldPosition(worldHead);
  assert.ok(worldHead.y > model.root.position.y);
  assert.equal(model.root.userData.activeHeadStyleId, "robot");
  model.dispose();
  factory.dispose();
});
