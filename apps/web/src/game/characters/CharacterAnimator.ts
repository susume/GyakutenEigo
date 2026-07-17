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
      // Knocked-out state: keep the player frozen in place, but make the silhouette unmistakably inactive.
      parts.root.rotation.z = THREE.MathUtils.lerp(parts.root.rotation.z, -0.34, 0.18);
      parts.root.position.y = THREE.MathUtils.lerp(parts.root.position.y, 0.02, 0.18);
      parts.leftLeg.rotation.x = THREE.MathUtils.lerp(parts.leftLeg.rotation.x, 0.16, 0.2);
      parts.rightLeg.rotation.x = THREE.MathUtils.lerp(parts.rightLeg.rotation.x, -0.08, 0.2);
      parts.leftArm.rotation.x = THREE.MathUtils.lerp(parts.leftArm.rotation.x, 0.42, 0.2);
      parts.rightArm.rotation.x = THREE.MathUtils.lerp(parts.rightArm.rotation.x, 0.58, 0.2);
      parts.torso.rotation.x = THREE.MathUtils.lerp(parts.torso.rotation.x, 0.22, 0.2);
      parts.head.rotation.x = THREE.MathUtils.lerp(parts.head.rotation.x, 0.32, 0.2);
      parts.weapon.rotation.x = THREE.MathUtils.lerp(parts.weapon.rotation.x, 0.72, 0.2);
      return;
    }

    parts.root.rotation.z = THREE.MathUtils.lerp(parts.root.rotation.z, 0, 0.16);
    parts.root.position.y = THREE.MathUtils.lerp(parts.root.position.y, state.crouching ? -0.18 : 0, 0.12);
    const stride = Math.min(1.35, state.speed * 0.13);
    const cycle = state.elapsed * (state.speed > 0.2 ? 9.6 : 2.2);
    const swing = Math.sin(cycle) * stride;
    const oppositeSwing = Math.sin(cycle + Math.PI);
    const idle = Math.sin(state.elapsed * 2.4) * 0.035;

    parts.leftLeg.rotation.x = swing;
    parts.rightLeg.rotation.x = -swing;
    parts.leftLeg.position.y = 0.62 + Math.max(0, oppositeSwing) * Math.min(0.1, state.speed * 0.008);
    parts.rightLeg.position.y = 0.62 + Math.max(0, -oppositeSwing) * Math.min(0.1, state.speed * 0.008);
    parts.leftArm.rotation.x = -0.54 - swing * 0.35;
    parts.rightArm.rotation.x = -0.78 + swing * 0.22;
    parts.torso.rotation.x = idle + Math.min(0.1, state.speed * 0.008);
    parts.torso.rotation.z = Math.sin(cycle * 0.5) * Math.min(0.055, state.speed * 0.004);
    parts.head.rotation.x = THREE.MathUtils.clamp(state.aimPitch ?? 0, -0.42, 0.42);
    parts.head.rotation.y = Math.sin(state.elapsed * 0.85) * (state.speed < 0.2 ? 0.05 : 0.015);

    if (state.firing) this.fireKick = 1;
    this.fireKick = Math.max(0, this.fireKick - 0.18);
    parts.weapon.position.z = 0.22 - this.fireKick * 0.08;
    parts.weapon.rotation.x = -0.24 - this.fireKick * 0.12;
    parts.weapon.rotation.z = Math.sin(cycle) * Math.min(0.025, state.speed * 0.002);
  }
}
