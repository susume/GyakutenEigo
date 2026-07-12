import * as THREE from "three";
import type { CharacterAppearance } from "./CharacterAppearance.js";
import { CharacterAnimator } from "./CharacterAnimator.js";
import { CharacterAudio } from "./CharacterAudio.js";
import { CharacterHitboxController } from "./CharacterHitboxController.js";
import { CharacterLOD } from "./CharacterLOD.js";
import type { EquipmentParts } from "./CharacterEquipment.js";

export interface CharacterModelParts {
  root: THREE.Group;
  torso: THREE.Object3D;
  head: THREE.Object3D;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  weapon: THREE.Object3D;
  equipment: EquipmentParts;
}

export interface CharacterModelUpdate {
  camera: THREE.Camera;
  delta: number;
  elapsed: number;
  speed: number;
  alive: boolean;
  firing?: boolean;
  crouching?: boolean;
}

export class CharacterModel {
  readonly root: THREE.Group;
  readonly appearance: CharacterAppearance;
  readonly hitboxes = new CharacterHitboxController();
  readonly lod = new CharacterLOD();
  readonly audio = new CharacterAudio();
  private readonly animator = new CharacterAnimator();
  private readonly parts: CharacterModelParts;

  constructor(appearance: CharacterAppearance, parts: CharacterModelParts) {
    this.appearance = appearance;
    this.parts = parts;
    this.root = parts.root;
    this.root.userData.characterAppearance = appearance;
  }

  setWorldState(x: number, z: number, facing: number, alive: boolean) {
    this.root.position.x = x;
    this.root.position.z = z;
    this.root.rotation.y = facing;
    this.root.visible = true;
    this.hitboxes.update(this.root.position, this.appearance.silhouette.heightScale);
  }

  update({ camera, delta, elapsed, speed, alive, firing, crouching }: CharacterModelUpdate) {
    const lodState = this.lod.update(this.root, camera);
    if (lodState.shouldAnimate) {
      this.animator.update(this.parts, { elapsed, speed, alive, firing, crouching });
      this.audio.update(speed, delta);
    }
    this.parts.equipment.weapon.visible = alive && lodState.level.equipment !== "minimal";
    if (this.parts.equipment.backpack) this.parts.equipment.backpack.visible = alive && lodState.level.equipment === "full";
  }
}
