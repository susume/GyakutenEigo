import * as THREE from "three";

export interface CharacterAnimationParts {
  root: THREE.Group;
  torso: THREE.Object3D;
  head: THREE.Object3D;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  weapon: THREE.Object3D;
}

export interface CharacterAnimationState {
  elapsed: number;
  speed: number;
  alive: boolean;
  aimPitch?: number;
  firing?: boolean;
  crouching?: boolean;
}

export class CharacterAnimator {
  private fireKick = 0;

  update(parts: CharacterAnimationParts, state: CharacterAnimationState) {
    if (!state.alive) {
      // Classroom-safe knockout state: freeze upright instead of falling over.
      parts.root.rotation.z = THREE.MathUtils.lerp(parts.root.rotation.z, 0, 0.24);
      parts.root.position.y = THREE.MathUtils.lerp(parts.root.position.y, 0, 0.2);
      parts.leftLeg.rotation.x = THREE.MathUtils.lerp(parts.leftLeg.rotation.x, 0, 0.24);
      parts.rightLeg.rotation.x = THREE.MathUtils.lerp(parts.rightLeg.rotation.x, 0, 0.24);
      parts.leftArm.rotation.x = THREE.MathUtils.lerp(parts.leftArm.rotation.x, -0.18, 0.24);
      parts.rightArm.rotation.x = THREE.MathUtils.lerp(parts.rightArm.rotation.x, -0.18, 0.24);
      parts.torso.rotation.x = THREE.MathUtils.lerp(parts.torso.rotation.x, 0, 0.24);
      parts.head.rotation.x = THREE.MathUtils.lerp(parts.head.rotation.x, 0, 0.24);
      parts.weapon.rotation.x = THREE.MathUtils.lerp(parts.weapon.rotation.x, 0.35, 0.24);
      return;
    }

    parts.root.rotation.z = THREE.MathUtils.lerp(parts.root.rotation.z, 0, 0.16);
    parts.root.position.y = THREE.MathUtils.lerp(parts.root.position.y, state.crouching ? -0.18 : 0, 0.12);
    const stride = Math.min(1.35, state.speed * 0.13);
    const cycle = state.elapsed * (state.speed > 0.2 ? 9.6 : 2.2);
    const swing = Math.sin(cycle) * stride;
    const idle = Math.sin(state.elapsed * 2.4) * 0.035;

    parts.leftLeg.rotation.x = swing;
    parts.rightLeg.rotation.x = -swing;
    parts.leftArm.rotation.x = -0.54 - swing * 0.35;
    parts.rightArm.rotation.x = -0.78 + swing * 0.22;
    parts.torso.rotation.x = idle;
    parts.head.rotation.x = THREE.MathUtils.clamp(state.aimPitch ?? 0, -0.42, 0.42);

    if (state.firing) this.fireKick = 1;
    this.fireKick = Math.max(0, this.fireKick - 0.18);
    parts.weapon.position.z = 0.22 - this.fireKick * 0.08;
    parts.weapon.rotation.x = -0.24 - this.fireKick * 0.12;
  }
}
