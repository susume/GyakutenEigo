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

  assert.match(starter.name, /^qs_ar1_/);
  assert.ok(bounds(starter).max.z > bounds(quick).max.z);
  assert.ok(bounds(heavy).max.z > bounds(quick).max.z);
  assert.ok(bounds(heavy).max.z > bounds(starter).max.z);
});

test("every launcher exposes explicit authored holding, shoulder, sight, and muzzle anchors", () => {
  const materials = makeMaterials();
  const geometry = new THREE.BoxGeometry(1, 1, 1);

  for (const gearId of ["starter_blaster", "quick_blaster", "power_blaster"]) {
    const set = createWeaponSet(materials, geometry, gearId);
    assert.equal(set.muzzle.name, "MuzzleSocket");
    assert.equal(set.rearHandGrip.name, "RearHandGrip");
    assert.equal(set.leftHandSupport.name, "SupportGrip");
    assert.equal(set.shoulderContact.name, "ShoulderContact");
    assert.equal(set.sight.name, "SightSocket");
    assert.equal(set.leftHandSupport.parent, set.weapon);
    assert.equal(set.muzzle.parent, set.weapon);
  }
});

test("QS AR-1 instances share cached geometry while retaining team material accents", () => {
  const blue = makeMaterials();
  const red = makeMaterials();
  blue.accent.color.set("#49c8ff");
  red.accent.color.set("#ff6a55");
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const blueSet = createWeaponSet(blue, geometry);
  const redSet = createWeaponSet(red, geometry);
  const blueSilhouette = blueSet.weapon.getObjectByName("QS_AR1_Silhouette") as THREE.Mesh;
  const redSilhouette = redSet.weapon.getObjectByName("QS_AR1_Silhouette") as THREE.Mesh;

  assert.equal(blueSilhouette.geometry, redSilhouette.geometry);
  assert.equal((blueSilhouette.material as THREE.Material[])[2], blue.accent);
  assert.equal((redSilhouette.material as THREE.Material[])[2], red.accent);
  assert.notEqual(blue.accent.color.getHex(), red.accent.color.getHex());
});
