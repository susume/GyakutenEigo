import * as THREE from "three";
import { CharacterModel } from "./CharacterModel.js";

const angleDelta = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

export class CharacterController {
  readonly model: CharacterModel;
  readonly current = new THREE.Vector3();
  readonly target = new THREE.Vector3();
  targetFacing = 0;
  currentFacing = 0;
  alive = true;
  speed = 0;

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

  update(delta: number, elapsed: number, camera: THREE.Camera) {
    const previousX = this.current.x;
    const previousZ = this.current.z;
    const smoothing = Math.min(1, delta * 9);
    this.current.lerp(this.target, smoothing);
    this.currentFacing += angleDelta(this.currentFacing, this.targetFacing) * Math.min(1, delta * 10);
    this.speed = Math.hypot(this.current.x - previousX, this.current.z - previousZ) / Math.max(delta, 0.001);
    this.model.setWorldState(this.current.x, this.current.z, this.currentFacing, this.alive);
    this.model.update({ camera, delta, elapsed, speed: this.speed, alive: this.alive });
  }
}
