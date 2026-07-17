import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createWeaponSet, type CharacterMaterials } from "./CharacterEquipment";

const makeMaterials = (): CharacterMaterials => {
  const material = () => new THREE.MeshStandardMaterial({ color: "#64748b" });
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

test("starter, quick, and heavy launchers use distinct sports-equipment silhouettes", () => {
  const materials = makeMaterials();
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const starter = createWeaponSet(materials, geometry, "starter_blaster").weapon;
  const quick = createWeaponSet(materials, geometry, "quick_blaster").weapon;
  const heavy = createWeaponSet(materials, geometry, "power_blaster").weapon;
  const bounds = (weapon: THREE.Group) => new THREE.Box3().setFromObject(weapon);

  assert.notEqual(starter.children.length, quick.children.length);
  assert.notEqual(quick.children.length, heavy.children.length);
  assert.ok(bounds(heavy).max.z > bounds(quick).max.z);
  assert.ok(bounds(starter).max.z > bounds(quick).max.z);
});
