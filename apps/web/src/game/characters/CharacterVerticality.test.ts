import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { CharacterController } from "./CharacterController";
import { CharacterFactory } from "./CharacterFactory";

test("remote character animation preserves its multiplayer floor elevation", () => {
  const factory = new CharacterFactory();
  const model = factory.createCharacter({ playerId: "upper-student", team: "blue", gear: "starter_blaster" });
  const controller = new CharacterController(model, 0, 0, 0, true, 7.5);
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 18, 24);

  controller.setTarget(4, 0, 0, true, 7.5);
  controller.update(1 / 60, 0.5, camera);

  assert.ok(model.root.position.y >= 7.45);
  assert.ok(model.root.position.y <= 8);
  model.dispose();
  factory.dispose();
});
