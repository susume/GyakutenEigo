import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { DEFAULT_PLAYER_APPEARANCE, VICTORY_POSE_IDS } from "@quizstrike/shared";
import { CharacterFactory } from "./CharacterFactory";

test("wardrobe swords remain visible with the blaster hidden; athletics still suppresses them", () => {
  const factory = new CharacterFactory();
  for (const backAccessoryId of ["samurai_sword", "twin_swords"] as const) {
    const appearance = { ...DEFAULT_PLAYER_APPEARANCE, backAccessoryId };
    const preview = factory.createCharacter({ playerId: "preview", team: "blue", appearance, showWeapon: false, allowCombatAccessories: true });
    const runner = factory.createCharacter({ playerId: "runner", team: "blue", appearance, showWeapon: false });
    assert.ok(preview.root.getObjectByName(`Accessory_${backAccessoryId}`));
    assert.equal(runner.root.getObjectByName(`Accessory_${backAccessoryId}`), undefined);
    preview.dispose(); runner.dispose();
  }
  factory.dispose();
});

test("unarmed victory styles make distinct silhouettes, with no vertical drift across replays", () => {
  const factory = new CharacterFactory();
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 3, 9);
  const signatures = new Set<string>();
  for (const victoryPoseId of VICTORY_POSE_IDS) {
    const model = factory.createCharacter({ playerId: victoryPoseId, team: "blue", appearance: { ...DEFAULT_PLAYER_APPEARANCE, victoryPoseId }, showWeapon: false });
    for (let replay = 0; replay < 5; replay++) {
      model.triggerAnimation("victory");
      for (let frame = 0; frame < 45; frame++) model.update({ camera, delta: 1 / 60, elapsed: frame / 60, speed: 0, alive: true });
      assert.ok(model.root.position.y >= 0 && model.root.position.y < 0.08);
    }
    const arms = ["LeftUpperArm", "RightUpperArm", "LeftForearm", "RightForearm"].map(name => model.root.getObjectByName(name)!.rotation.toArray().slice(0, 3));
    signatures.add(JSON.stringify(arms));
    model.root.updateMatrixWorld(true);
    const hand = model.root.getObjectByName("RightHand")!, shoulder = model.root.getObjectByName("RightUpperArm")!;
    if (victoryPoseId === "wave" || victoryPoseId === "champion") {
      assert.ok(hand.getWorldPosition(new THREE.Vector3()).y > shoulder.getWorldPosition(new THREE.Vector3()).y);
    }
    model.dispose();
  }
  assert.equal(signatures.size, 4);
  factory.dispose();
});

test("uploaded artwork is in front of the chest surface with normal depth testing", async () => {
  const texture = new THREE.DataTexture(new Uint8Array([100, 220, 255, 255]), 1, 1);
  const factory = new CharacterFactory({ loadDecalTexture: async () => texture });
  const model = factory.createCharacter({ playerId: "badge", team: "blue", showWeapon: false,
    appearance: { ...DEFAULT_PLAYER_APPEARANCE, decalAssetId: "00000000-0000-4000-8000-000000000001" } });
  await Promise.resolve();
  await Promise.resolve();
  const decal = model.root.getObjectByName("ChestDecalSocket")!.children[0] as THREE.Mesh;
  assert.equal(decal.visible, true);
  const body = model.root.getObjectByName(`stylized_humanoid_${model.appearance.variant}`) as THREE.SkinnedMesh;
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 3, -9);
  model.update({ camera, delta: 1 / 60, elapsed: 0, speed: 0, alive: true });
  assert.equal(decal.castShadow, false, "transparent artwork must not cast an opaque square shadow");
  assert.equal(body.castShadow, true);
  model.root.updateMatrixWorld(true); body.skeleton.update();
  const center = decal.getWorldPosition(new THREE.Vector3());
  const ray = new THREE.Raycaster(center.clone().add(new THREE.Vector3(0, 0, -5)), new THREE.Vector3(0, 0, 1));
  assert.equal(ray.intersectObjects([body, decal], false)[0]?.object, decal, "the jersey must not occlude the badge");
  model.dispose(); factory.dispose();
});
