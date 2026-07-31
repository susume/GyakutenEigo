import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { CharacterController } from "./CharacterController.js";
import type { CharacterModel, CharacterModelUpdate } from "./CharacterModel.js";
import type { CharacterAnimationCue } from "./CharacterAnimator.js";

test("remote character controller renders replicated jump height and crouch posture", () => {
  const cues: CharacterAnimationCue[] = [];
  const worldHeights: number[] = [];
  let lastUpdate: CharacterModelUpdate | undefined;
  const model = {
    setWorldState: (_x: number, _z: number, _facing: number, _alive: boolean, y = 0) => {
      worldHeights.push(y);
    },
    triggerAnimation: (cue: CharacterAnimationCue) => {
      cues.push(cue);
    },
    update: (update: CharacterModelUpdate) => {
      lastUpdate = update;
    }
  } as unknown as CharacterModel;
  const controller = new CharacterController(model, 0, 0, 0, true);
  const camera = new THREE.PerspectiveCamera();

  controller.setPosture(true, false);
  controller.update(1 / 60, 0, camera);
  assert.equal(lastUpdate?.crouching, true);

  controller.setPosture(false, true);
  controller.setTarget(0, 0, 0, true, 3);
  controller.update(1, 1, camera);
  assert.equal(worldHeights.at(-1), 3);
  assert.deepEqual(cues, ["jump"]);

  controller.setPosture(false, true);
  controller.setPosture(false, false);
  assert.deepEqual(cues, ["jump", "land"]);
});
