import * as THREE from "three";
import { CharacterModel } from "./CharacterModel.js";
import type { CharacterAnimationCue } from "./CharacterAnimator.js";

const angleDelta = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

export class CharacterController {
  readonly model: CharacterModel;
  readonly current = new THREE.Vector3();
  readonly target = new THREE.Vector3();
  targetFacing = 0;
  currentFacing = 0;
  alive = true;
  speed = 0;
  forwardSpeed = 0;
  strafeSpeed = 0;
  carryingObjective = false;

  constructor(model: CharacterModel, x: number, z: number, facing: number, alive: boolean) {
    this.model = model;
    this.current.set(x, 0, z);
    this.target.copy(this.current);
    this.targetFacing = facing;
    this.currentFacing = facing;
    this.alive = alive;
    this.model.setWorldState(x, z, facing, alive);
  }

  setTarget(x: number, z: number, facing: number, alive: boolean) {
    this.target.set(x, 0, z);
    this.targetFacing = facing;
    this.alive = alive;
  }

  triggerAnimation(cue: CharacterAnimationCue) {
    this.model.triggerAnimation(cue);
  }

  update(delta: number, elapsed: number, camera: THREE.Camera) {
    const previousX = this.current.x;
    const previousZ = this.current.z;
    const smoothing = Math.min(1, delta * 9);
    this.current.lerp(this.target, smoothing);
    this.currentFacing += angleDelta(this.currentFacing, this.targetFacing) * Math.min(1, delta * 10);
    const velocityX = (this.current.x - previousX) / Math.max(delta, 0.001);
    const velocityZ = (this.current.z - previousZ) / Math.max(delta, 0.001);
    this.speed = Math.hypot(velocityX, velocityZ);
    const forwardX = -Math.sin(this.currentFacing);
    const forwardZ = -Math.cos(this.currentFacing);
    this.forwardSpeed = velocityX * forwardX + velocityZ * forwardZ;
    this.strafeSpeed = velocityX * Math.cos(this.currentFacing) - velocityZ * Math.sin(this.currentFacing);
    this.model.setWorldState(this.current.x, this.current.z, this.currentFacing, this.alive);
    this.model.update({
      camera,
      delta,
      elapsed,
      speed: this.speed,
      forwardSpeed: this.forwardSpeed,
      strafeSpeed: this.strafeSpeed,
      alive: this.alive,
      carryingObjective: this.carryingObjective
    });
  }
}
