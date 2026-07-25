import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { BACK_ACCESSORY_IDS, DETAIL_ACCESSORY_IDS, HEAD_OPTIONS } from "@quizstrike/shared";
import {
  BACK_ACCESSORY_DEFINITIONS,
  DETAIL_ACCESSORY_DEFINITIONS,
  createBackAccessory,
  createDetailAccessory,
  createHeadOption
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

test("every head option creates a socket-ready cosmetic group", () => {
  const materials = makeMaterials();
  for (const option of HEAD_OPTIONS) {
    const headOption = createHeadOption(option, materials);
    assert.equal(headOption.name, `HeadOption_${option}`);
    assert.ok(headOption.children.length > 0);
  }
});
