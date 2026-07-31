import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { BACK_ACCESSORY_IDS, HEAD_STYLE_IDS } from "@quizstrike/shared";
import { CharacterFactory } from "./CharacterFactory.js";

test("40 lobby characters keep the shared-body render budget bounded", () => {
  const factory = new CharacterFactory();
  const startedAt = performance.now();
  const models = Array.from({ length: 40 }, (_, index) => factory.createCharacter({
    playerId: `load-student-${index}`,
    team: index % 2 === 0 ? "blue" : "red",
    appearance: {
      headStyleId: HEAD_STYLE_IDS[index % HEAD_STYLE_IDS.length],
      backAccessoryId: BACK_ACCESSORY_IDS[index % BACK_ACCESSORY_IDS.length],
      footwearId: "runners",
      victoryPoseId: "champion",
      appearanceVersion: 7
    }
  }));
  const constructionMs = performance.now() - startedAt;
  const bodies = models.map((model) => {
    let body: THREE.SkinnedMesh | undefined;
    model.root.traverse((object) => {
      if (!body && object instanceof THREE.SkinnedMesh) body = object;
    });
    assert.ok(body);
    return body;
  });
  const uniqueGeometries = new Set(bodies.map((body) => body.geometry));
  const uniqueMaterials = new Set(bodies.map((body) => body.material));
  const weaponSilhouettes = models.map((model) => {
    const weapon = model.root.getObjectByName("QS_AR1_Silhouette");
    assert.ok(weapon instanceof THREE.Mesh);
    return weapon;
  });
  const uniqueWeaponGeometries = new Set(weaponSilhouettes.map((weapon) => weapon.geometry));

  assert.equal(bodies.length, 40);
  assert.equal(uniqueGeometries.size, 2);
  assert.equal(uniqueMaterials.size, 2);
  assert.equal(uniqueWeaponGeometries.size, 1);
  assert.equal(bodies[0].skeleton.bones.length, 13);
  assert.ok(constructionMs < 2_000);

  console.log(JSON.stringify({
    characters: bodies.length,
    constructionMs: Math.round(constructionMs),
    sharedBodyGeometries: uniqueGeometries.size,
    sharedWeaponGeometries: uniqueWeaponGeometries.size,
    sharedBodyMaterials: uniqueMaterials.size,
    bodyTrianglesEach: bodies[0].geometry.getAttribute("position").count / 3,
    weaponTrianglesEach: weaponSilhouettes[0].geometry.getAttribute("position").count / 3
  }));

  models.forEach((model) => model.dispose());
  factory.dispose();
});
