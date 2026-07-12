import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { CharacterAnimator, type CharacterAnimationParts } from "./CharacterAnimator";

const makeParts = (): CharacterAnimationParts => ({
  root: new THREE.Group(),
  torso: new THREE.Object3D(),
  head: new THREE.Object3D(),
  leftArm: new THREE.Object3D(),
  rightArm: new THREE.Object3D(),
  leftLeg: new THREE.Object3D(),
  rightLeg: new THREE.Object3D(),
  weapon: new THREE.Object3D()
});

test("knocked-out characters freeze upright instead of falling over", () => {
  const animator = new CharacterAnimator();
  const parts = makeParts();
  parts.root.rotation.z = -Math.PI / 3;
  parts.root.position.y = 0.4;

  for (let frame = 0; frame < 30; frame += 1) {
    animator.update(parts, { elapsed: frame / 60, speed: 0, alive: false });
  }

  assert.ok(Math.abs(parts.root.rotation.z) < 0.001);
  assert.ok(Math.abs(parts.root.position.y) < 0.001);
  assert.ok(parts.weapon.rotation.x > 0.34);
});
