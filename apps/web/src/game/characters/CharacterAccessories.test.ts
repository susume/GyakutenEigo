import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { BACK_ACCESSORY_IDS, DETAIL_ACCESSORY_IDS } from "@quizstrike/shared";
import {
  BACK_ACCESSORY_DEFINITIONS,
  DETAIL_ACCESSORY_DEFINITIONS,
  createBackAccessory,
  createDetailAccessory
} from "./CharacterAccessories";
import type { CharacterMaterials } from "./CharacterEquipment";

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
