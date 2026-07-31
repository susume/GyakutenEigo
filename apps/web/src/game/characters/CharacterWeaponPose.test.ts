import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { HEAD_STYLE_IDS, type PlayerHeadStyleId } from "@quizstrike/shared";
import { CharacterFactory } from "./CharacterFactory";

const HEAD_STYLES: PlayerHeadStyleId[] = [...HEAD_STYLE_IDS];

const worldPosition = (root: THREE.Object3D, name: string) => {
  const object = root.getObjectByName(name);
  assert.ok(object, `${name} must exist`);
  return object.getWorldPosition(new THREE.Vector3());
};

test("QS AR-1 remains socket-driven and clear of every current head style", () => {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 2.5, 10);
  const factory = new CharacterFactory();

  for (const headStyleId of HEAD_STYLES) {
    const model = factory.createCharacter({
      playerId: `weapon-pose-${headStyleId}`,
      team: headStyleId === "fox" ? "red" : "blue",
      gear: "starter_blaster",
      appearance: {
        headStyleId,
        backAccessoryId: "utility_pack",
        footwearId: "runners",
        victoryPoseId: "champion",
        appearanceVersion: 7
      }
    });
    for (let frame = 0; frame < 60; frame += 1) {
      model.update({
        camera,
        delta: 1 / 60,
        elapsed: frame / 60,
        speed: 0,
        forwardSpeed: 0,
        alive: true
      });
    }
    model.root.updateMatrixWorld(true);

    assert.ok(worldPosition(model.root, "RightHand").distanceTo(worldPosition(model.root, "RearHandGrip")) < 0.01);
    assert.ok(worldPosition(model.root, "LeftHand").distanceTo(worldPosition(model.root, "SupportGrip")) < 0.2);
    assert.ok(worldPosition(model.root, "RightUpperArm").distanceTo(worldPosition(model.root, "ShoulderContact")) < 0.3);
    assert.ok(worldPosition(model.root, "MuzzleSocket").z < worldPosition(model.root, "Head").z - 2);
    model.dispose();
  }
  factory.dispose();
});

test("weapon detail LOD drops before the rifle silhouette", () => {
  const factory = new CharacterFactory();
  const model = factory.createCharacter({ playerId: "weapon-lod", team: "blue" });
  const weapon = model.root.getObjectByName("qs_ar1_starter_blaster");
  const details = model.root.getObjectByName("QS_AR1_Details");
  assert.ok(weapon);
  assert.ok(details);

  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 2, 50);
  model.update({ camera, delta: 1 / 60, elapsed: 0, speed: 0, alive: true });
  assert.equal(weapon.visible, true);
  assert.equal(details.visible, false);

  camera.position.z = 90;
  model.update({ camera, delta: 1 / 60, elapsed: 1 / 60, speed: 0, alive: true });
  assert.equal(weapon.visible, false);
  model.dispose();
  factory.dispose();
});

test("the dedicated first-person model keeps its visible muzzle in front of the camera rig", () => {
  const factory = new CharacterFactory();
  for (const gearId of ["starter_blaster", "quick_blaster", "power_blaster"]) {
    const model = factory.createFirstPersonViewModel("blue", gearId);
    model.root.updateMatrixWorld(true);
    const muzzle = model.muzzle.getWorldPosition(new THREE.Vector3());
    assert.ok(muzzle.z < -1.5, `${gearId} muzzle must sit in front of the view`);
    assert.ok(Math.abs(muzzle.x) < 0.5, `${gearId} must not block the crosshair`);
  }
  factory.dispose();
});
