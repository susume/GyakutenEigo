import * as THREE from "three";
import type { CharacterAppearance } from "./CharacterAppearance.js";
import { CharacterAnimator, type CharacterAnimationCue } from "./CharacterAnimator.js";
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
  leftForearm: THREE.Object3D;
  rightForearm: THREE.Object3D;
  leftHand: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  leftShin: THREE.Object3D;
  rightShin: THREE.Object3D;
  weapon: THREE.Object3D;
  rearHandGrip: THREE.Object3D;
  leftHandSupport: THREE.Object3D;
  equipment: EquipmentParts;
}

export interface CharacterModelUpdate {
  camera: THREE.Camera;
  delta: number;
  elapsed: number;
  speed: number;
  forwardSpeed?: number;
  strafeSpeed?: number;
  turnSpeed?: number;
  alive: boolean;
  aimPitch?: number;
  firing?: boolean;
  crouching?: boolean;
  carryingObjective?: boolean;
}

export class CharacterModel {
  readonly root: THREE.Group;
  readonly appearance: CharacterAppearance;
  readonly hitboxes = new CharacterHitboxController();
  readonly lod = new CharacterLOD();
  readonly audio = new CharacterAudio();
  private readonly animator: CharacterAnimator;
  private readonly parts: CharacterModelParts;
  private readonly cosmeticMotionNodes: THREE.Object3D[] = [];
  private worldY = 0;
  private animatedLocalY = 0;

  constructor(appearance: CharacterAppearance, parts: CharacterModelParts) {
    this.appearance = appearance;
    this.parts = parts;
    this.root = parts.root;
    this.animator = new CharacterAnimator(appearance.customization.victoryPoseId);
    this.root.userData.characterAppearance = appearance;
    this.root.traverse((object) => {
      if (object.userData.cosmeticMotionNode) this.cosmeticMotionNodes.push(object);
    });
  }

  setWorldState(x: number, z: number, facing: number, alive: boolean, y = 0) {
    this.worldY = y;
    this.root.position.x = x;
    this.root.position.y = this.worldY + this.animatedLocalY;
    this.root.position.z = z;
    this.root.rotation.y = facing;
    this.root.visible = true;
    this.hitboxes.update(this.root.position, this.appearance.silhouette.heightScale);
  }

  triggerAnimation(cue: CharacterAnimationCue) {
    this.animator.trigger(cue);
  }

  getMuzzleWorldPosition(target = new THREE.Vector3()) {
    this.root.updateMatrixWorld(true);
    return this.parts.equipment.muzzle.getWorldPosition(target);
  }

  private updateCosmeticMotion(elapsed: number, speed: number) {
    const pace = Math.min(1, speed / 5);
    for (const accessory of this.parts.equipment.accessories) {
      const base = accessory.userData.baseRotation as [number, number, number] | undefined;
      if (!base) continue;
      if (accessory.userData.motion === "tail") {
        accessory.rotation.set(
          base[0],
          base[1] + Math.sin(elapsed * (1.8 + pace * 1.4)) * (0.045 + pace * 0.035),
          base[2] + Math.sin(elapsed * 1.5) * 0.018
        );
      } else if (accessory.userData.motion === "cape") {
        const trail = Math.min(0.18, speed * 0.025);
        accessory.rotation.set(base[0] - trail * 0.7 + Math.sin(elapsed * 2.2) * 0.012, base[1], base[2]);
      } else if (accessory.userData.motion === "wings") {
        accessory.rotation.set(base[0] - pace * 0.025, base[1], base[2]);
      }
    }

    for (const node of this.cosmeticMotionNodes) {
      const base = node.userData.baseRotation as [number, number, number] | undefined;
      if (!base) continue;
      const kind = node.userData.cosmeticMotionNode as string;
      const index = Number(node.userData.motionIndex ?? 0);
      const side = Number(node.userData.motionSide ?? 0);
      if (kind === "tailSegment") {
        const phase = elapsed * (2.15 + pace * 2.4) - index * 0.48;
        const follow = (0.018 + pace * 0.027) * (1 + index * 0.18);
        node.rotation.set(
          base[0] + Math.cos(phase * 0.7) * follow * 0.35,
          base[1] + Math.sin(phase) * follow,
          base[2] + Math.cos(phase * 0.82) * follow * 0.55
        );
      } else if (kind === "capeSegment") {
        const trail = Math.min(0.14, speed * 0.022);
        const flutter = Math.sin(elapsed * (3.1 + pace * 2.3) - index * 0.75) * (0.006 + pace * 0.011);
        node.rotation.set(base[0] - trail * (0.28 + index * 0.16) + flutter, base[1], base[2]);
      } else if (kind === "wing") {
        const settle = Math.sin(elapsed * 1.7 + side * 0.7) * (0.008 + pace * 0.006);
        node.rotation.set(
          base[0] - pace * 0.018,
          base[1] + side * pace * 0.02,
          base[2] + side * (settle - pace * 0.025)
        );
      } else if (kind === "feather") {
        const flex = Math.sin(elapsed * 1.9 - index * 0.38 + side) * (0.004 + index * 0.0015 + pace * 0.004);
        node.rotation.set(base[0] + pace * 0.01, base[1], base[2] + side * flex);
      } else if (kind === "hairCrown") {
        node.rotation.set(base[0] - pace * 0.012 + Math.sin(elapsed * 3.4) * 0.004, base[1], base[2]);
      } else if (kind === "hairFringe") {
        const bounce = Math.sin(elapsed * (3.4 + pace * 2.6) - index * 0.22) * (0.005 + pace * 0.012);
        node.rotation.set(base[0] + pace * 0.012, base[1], base[2] + bounce);
      } else if (kind === "hairLock") {
        const follow = Math.sin(elapsed * (2.7 + pace * 2) - index * 0.55 + side) * (0.008 + pace * 0.018);
        node.rotation.set(base[0] - pace * (0.025 + index * 0.018), base[1], base[2] + side * follow);
      }
    }
  }

  dispose() {
    this.root.userData.disposed = true;
    this.root.traverse((object) => {
      const releaseSharedStudentBody = object.userData.releaseSharedStudentBody as (() => void) | undefined;
      releaseSharedStudentBody?.();
      if (!(object instanceof THREE.Mesh)) return;
      if (object.userData.disposeWithCharacterGeometry) object.geometry.dispose();
      if (!object.userData.ownedDecalMaterial && !object.userData.disposeWithCharacterMaterial) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        const mapped = material as THREE.Material & { map?: THREE.Texture | null };
        mapped.map?.dispose();
        material.dispose();
      });
    });
  }

  update({ camera, delta, elapsed, speed, forwardSpeed, strafeSpeed, turnSpeed, alive, aimPitch, firing, crouching, carryingObjective }: CharacterModelUpdate) {
    const lodState = this.lod.update(this.root, camera);
    if (lodState.shouldAnimate || this.animator.hasActiveCue) {
      this.root.position.y = this.animatedLocalY;
      this.animator.update(this.parts, { delta, elapsed, speed, forwardSpeed, strafeSpeed, turnSpeed, alive, aimPitch, firing, crouching, carryingObjective });
      this.animatedLocalY = this.root.position.y;
      this.audio.update(speed, delta);
    }
    this.root.position.y = this.worldY + this.animatedLocalY;
    this.parts.equipment.weapon.visible = alive && lodState.level.equipment !== "minimal";
    this.parts.equipment.weaponDetails.visible = alive && lodState.level.equipment === "full";
    this.parts.equipment.accessories.forEach((accessory) => {
      const isBackGear = accessory.userData.accessorySlot === "back";
      accessory.visible = alive && (
        isBackGear
          ? lodState.level.equipment !== "minimal"
          : lodState.level.equipment === "full"
      );
      if (isBackGear) {
        accessory.traverse((object) => {
          if (object.userData.cosmeticDetail) {
            object.visible = accessory.visible && lodState.level.equipment === "full";
          }
        });
      }
    });
    this.updateCosmeticMotion(elapsed, speed);
  }
}
