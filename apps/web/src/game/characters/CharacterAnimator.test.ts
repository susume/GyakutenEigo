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

test("knocked-out characters freeze with an inactive leaning pose", () => {
  const animator = new CharacterAnimator();
  const parts = makeParts();
  parts.root.rotation.z = -Math.PI / 3;
  parts.root.position.y = 0.4;

  for (let frame = 0; frame < 30; frame += 1) {
    animator.update(parts, { elapsed: frame / 60, speed: 0, alive: false });
  }

  assert.ok(parts.root.rotation.z < -0.2);
  assert.ok(Math.abs(parts.root.position.y - 0.02) < 0.02);
  assert.ok(parts.weapon.rotation.x > 0.6);
});

test("hit cues add recoil and then expire back toward locomotion", () => {
  const animator = new CharacterAnimator();
  const parts = makeParts();
  animator.trigger("hit");
  for (let frame = 0; frame < 10; frame += 1) {
    animator.update(parts, { delta: 1 / 60, elapsed: frame / 60, speed: 0, alive: true });
  }
  assert.ok(Math.abs(parts.torso.rotation.y) > 0.05);
  for (let frame = 10; frame < 60; frame += 1) {
    animator.update(parts, { delta: 1 / 60, elapsed: frame / 60, speed: 0, alive: true });
  }
  assert.equal(animator.hasActiveCue, false);
  assert.ok(Math.abs(parts.torso.rotation.y) < 0.01);
});

test("objective carriers keep a readable cradle pose while moving", () => {
  const animator = new CharacterAnimator();
  const parts = makeParts();
  animator.update(parts, { delta: 1 / 60, elapsed: 0.2, speed: 4, forwardSpeed: 4, alive: true, carryingObjective: true });
  assert.equal(parts.leftArm.rotation.x, -1.08);
  assert.notEqual(parts.leftLeg.rotation.x, 0);
});
