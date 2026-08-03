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
  velocityX = 0;
  velocityZ = 0;
  forwardSpeed = 0;
  strafeSpeed = 0;
  turnSpeed = 0;
  carryingObjective = false;
  crouching = false;
  jumping = false;

  constructor(model: CharacterModel, x: number, z: number, facing: number, alive: boolean, y = 0) {
    this.model = model;
    this.current.set(x, y, z);
    this.target.copy(this.current);
    this.targetFacing = facing;
    this.currentFacing = facing;
    this.alive = alive;
    this.model.setWorldState(x, z, facing, alive, y);
  }

  setTarget(x: number, z: number, facing: number, alive: boolean, y = 0) {
    this.target.set(x, y, z);
    this.targetFacing = facing;
    this.alive = alive;
  }

  triggerAnimation(cue: CharacterAnimationCue) {
    this.model.triggerAnimation(cue);
  }

  setPosture(crouching: boolean, jumping: boolean) {
    const nextJumping = jumping && !crouching;
    if (nextJumping && !this.jumping) this.triggerAnimation("jump");
    if (!nextJumping && this.jumping) this.triggerAnimation("land");
    this.crouching = crouching;
    this.jumping = nextJumping;
  }

  update(delta: number, elapsed: number, camera: THREE.Camera) {
    const previousX = this.current.x;
    const previousZ = this.current.z;
    const previousFacing = this.currentFacing;
    const smoothing = Math.min(1, delta * 9);
    this.current.lerp(this.target, smoothing);
    this.currentFacing += angleDelta(this.currentFacing, this.targetFacing) * Math.min(1, delta * 10);
    const velocityX = (this.current.x - previousX) / Math.max(delta, 0.001);
    const velocityZ = (this.current.z - previousZ) / Math.max(delta, 0.001);
    this.velocityX = velocityX;
    this.velocityZ = velocityZ;
    const motionResponse = 1 - Math.exp(-Math.max(delta, 0.001) * 12);
    this.speed = THREE.MathUtils.lerp(this.speed, Math.hypot(velocityX, velocityZ), motionResponse);
    const forwardX = -Math.sin(this.currentFacing);
    const forwardZ = -Math.cos(this.currentFacing);
    this.forwardSpeed = THREE.MathUtils.lerp(
      this.forwardSpeed,
      velocityX * forwardX + velocityZ * forwardZ,
      motionResponse
    );
    this.strafeSpeed = THREE.MathUtils.lerp(
      this.strafeSpeed,
      velocityX * Math.cos(this.currentFacing) - velocityZ * Math.sin(this.currentFacing),
      motionResponse
    );
    this.turnSpeed = THREE.MathUtils.lerp(
      this.turnSpeed,
      angleDelta(previousFacing, this.currentFacing) / Math.max(delta, 0.001),
      motionResponse
    );
    this.model.setWorldState(this.current.x, this.current.z, this.currentFacing, this.alive, this.current.y);
    this.model.update({
      camera,
      delta,
      elapsed,
      speed: this.speed,
      velocityX: this.velocityX,
      velocityZ: this.velocityZ,
      forwardSpeed: this.forwardSpeed,
      strafeSpeed: this.strafeSpeed,
      turnSpeed: this.turnSpeed,
      alive: this.alive,
      crouching: this.crouching,
      carryingObjective: this.carryingObjective
    });
  }
}
