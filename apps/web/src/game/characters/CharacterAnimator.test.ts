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
  leftForearm: new THREE.Object3D(),
  rightForearm: new THREE.Object3D(),
  leftLeg: new THREE.Object3D(),
  rightLeg: new THREE.Object3D(),
  leftShin: new THREE.Object3D(),
  rightShin: new THREE.Object3D(),
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

test("remote fire cues produce a readable braced recoil pose", () => {
  const animator = new CharacterAnimator();
  const parts = makeParts();
  animator.trigger("fire");
  for (let frame = 0; frame < 7; frame += 1) {
    animator.update(parts, { delta: 1 / 60, elapsed: frame / 60, speed: 0, alive: true });
  }
  assert.ok(parts.weapon.position.z > 0.04);
  assert.ok(parts.weapon.rotation.x < -0.08);
  assert.ok(parts.leftForearm.rotation.x > 0.75);
});

test("turning characters lean and counter-rotate their head", () => {
  const animator = new CharacterAnimator();
  const parts = makeParts();
  for (let frame = 0; frame < 20; frame += 1) {
    animator.update(parts, {
      delta: 1 / 60,
      elapsed: frame / 60,
      speed: 2,
      forwardSpeed: 2,
      turnSpeed: 2.4,
      alive: true
    });
  }
  assert.ok(parts.root.rotation.z < -0.05);
  assert.ok(parts.torso.rotation.y > 0.05);
  assert.ok(parts.head.rotation.y < 0);
});

test("objective carriers keep a readable cradle pose while moving", () => {
  const animator = new CharacterAnimator();
  const parts = makeParts();
  for (let frame = 0; frame < 30; frame += 1) {
    animator.update(parts, { delta: 1 / 60, elapsed: frame / 60, speed: 4, forwardSpeed: 4, alive: true, carryingObjective: true });
  }
  assert.ok(parts.leftArm.rotation.x < -0.68);
  assert.ok(parts.leftForearm.rotation.x > 0);
  assert.notEqual(parts.leftLeg.rotation.x, 0);
});

test("unlockable victory styles produce distinct readable poses", () => {
  const waveParts = makeParts();
  const powerParts = makeParts();
  const wave = new CharacterAnimator("wave");
  const power = new CharacterAnimator("power");
  wave.trigger("victory");
  power.trigger("victory");
  for (let frame = 0; frame < 30; frame += 1) {
    const state = { delta: 1 / 60, elapsed: frame / 60, speed: 0, alive: true };
    wave.update(waveParts, state);
    power.update(powerParts, state);
  }
  assert.ok(waveParts.rightArm.rotation.x < -1);
  assert.ok(powerParts.rightArm.rotation.z > 0.3);
  assert.ok(Math.abs(waveParts.rightArm.rotation.z - powerParts.rightArm.rotation.z) > 0.25);
});
