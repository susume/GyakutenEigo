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
  delta?: number;
  elapsed: number;
  speed: number;
  forwardSpeed?: number;
  strafeSpeed?: number;
  alive: boolean;
  aimPitch?: number;
  firing?: boolean;
  crouching?: boolean;
  carryingObjective?: boolean;
}

export type CharacterAnimationCue = "hit" | "respawn" | "jump" | "land" | "flag_plant" | "flag_capture" | "victory" | "defeat";

const cueDuration: Record<CharacterAnimationCue, number> = {
  hit: 0.32,
  respawn: 0.9,
  jump: 0.55,
  land: 0.28,
  flag_plant: 0.9,
  flag_capture: 1.2,
  victory: 1.6,
  defeat: 1.2
};

type ActiveCue = { kind: CharacterAnimationCue; remaining: number; duration: number };

export class CharacterAnimator {
  private fireKick = 0;
  private cue?: ActiveCue;

  get hasActiveCue() {
    return Boolean(this.cue);
  }

  trigger(kind: CharacterAnimationCue) {
    const duration = cueDuration[kind];
    this.cue = { kind, duration, remaining: duration };
  }

  update(parts: CharacterAnimationParts, state: CharacterAnimationState) {
    const cue = this.cue;
    const cueProgress = cue ? 1 - cue.remaining / cue.duration : 0;
    if (cue) {
      cue.remaining = Math.max(0, cue.remaining - (state.delta ?? 1 / 60));
      if (cue.remaining === 0) this.cue = undefined;
    }
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

    const strafeLean = THREE.MathUtils.clamp((state.strafeSpeed ?? 0) * -0.025, -0.15, 0.15);
    const backwards = (state.forwardSpeed ?? state.speed) < -0.25 ? -1 : 1;
    parts.root.rotation.z = THREE.MathUtils.lerp(parts.root.rotation.z, strafeLean, 0.16);
    parts.root.position.y = THREE.MathUtils.lerp(parts.root.position.y, state.crouching ? -0.18 : 0, 0.12);
    const stride = Math.min(1.35, state.speed * 0.13);
    const cycle = state.elapsed * (state.speed > 0.2 ? 9.6 : 2.2);
    const swing = Math.sin(cycle) * stride * backwards;
    const oppositeSwing = Math.sin(cycle + Math.PI);
    const idle = Math.sin(state.elapsed * 2.4) * 0.035;

    parts.leftLeg.rotation.x = swing;
    parts.rightLeg.rotation.x = -swing;
    parts.leftLeg.position.y = 0.62 + Math.max(0, oppositeSwing) * Math.min(0.1, state.speed * 0.008);
    parts.rightLeg.position.y = 0.62 + Math.max(0, -oppositeSwing) * Math.min(0.1, state.speed * 0.008);
    parts.leftArm.rotation.x = state.carryingObjective ? -1.08 : -0.54 - swing * 0.35;
    parts.rightArm.rotation.x = -0.78 + swing * 0.22;
    parts.torso.rotation.x = idle + Math.min(0.1, state.speed * 0.008);
    parts.torso.rotation.z = Math.sin(cycle * 0.5) * Math.min(0.055, state.speed * 0.004);
    parts.torso.rotation.y = THREE.MathUtils.lerp(parts.torso.rotation.y, 0, 0.18);
    parts.head.rotation.x = THREE.MathUtils.clamp(state.aimPitch ?? 0, -0.42, 0.42);
    parts.head.rotation.y = Math.sin(state.elapsed * 0.85) * (state.speed < 0.2 ? 0.05 : 0.015);
    parts.head.rotation.z = THREE.MathUtils.lerp(parts.head.rotation.z, 0, 0.18);
    parts.leftArm.rotation.z = THREE.MathUtils.lerp(parts.leftArm.rotation.z, 0, 0.16);
    parts.rightArm.rotation.z = THREE.MathUtils.lerp(parts.rightArm.rotation.z, 0, 0.16);

    if (state.firing) this.fireKick = 1;
    this.fireKick = Math.max(0, this.fireKick - 0.18);
    parts.weapon.position.z = 0.22 - this.fireKick * 0.08;
    parts.weapon.rotation.x = -0.24 - this.fireKick * 0.12;
    parts.weapon.rotation.z = Math.sin(cycle) * Math.min(0.025, state.speed * 0.002);

    if (!cue) return;
    const pulse = Math.sin(cueProgress * Math.PI);
    const snap = Math.min(1, (state.delta ?? 1 / 60) * 18);
    if (cue.kind === "hit") {
      parts.root.rotation.z = THREE.MathUtils.lerp(parts.root.rotation.z, -0.24 * pulse, snap);
      parts.torso.rotation.y = THREE.MathUtils.lerp(parts.torso.rotation.y, 0.34 * pulse, snap);
      parts.head.rotation.z = THREE.MathUtils.lerp(parts.head.rotation.z, -0.18 * pulse, snap);
      parts.weapon.position.z -= 0.08 * pulse;
    } else if (cue.kind === "jump") {
      parts.root.position.y += pulse * 0.34;
      parts.leftLeg.rotation.x = THREE.MathUtils.lerp(parts.leftLeg.rotation.x, 0.62 * pulse, snap);
      parts.rightLeg.rotation.x = THREE.MathUtils.lerp(parts.rightLeg.rotation.x, 0.42 * pulse, snap);
      parts.leftArm.rotation.x -= pulse * 0.22;
      parts.rightArm.rotation.x -= pulse * 0.18;
    } else if (cue.kind === "land") {
      parts.root.position.y -= pulse * 0.24;
      parts.leftLeg.rotation.x = THREE.MathUtils.lerp(parts.leftLeg.rotation.x, -0.28 * pulse, snap);
      parts.rightLeg.rotation.x = THREE.MathUtils.lerp(parts.rightLeg.rotation.x, -0.28 * pulse, snap);
      parts.torso.rotation.x += pulse * 0.2;
    } else if (cue.kind === "respawn") {
      const rise = THREE.MathUtils.smoothstep(cueProgress, 0, 0.72);
      parts.root.position.y += (1 - rise) * -0.48 + pulse * 0.16;
      parts.leftArm.rotation.z = THREE.MathUtils.lerp(parts.leftArm.rotation.z, -0.72 * pulse, snap);
      parts.rightArm.rotation.z = THREE.MathUtils.lerp(parts.rightArm.rotation.z, 0.72 * pulse, snap);
    } else if (cue.kind === "flag_plant") {
      parts.root.position.y -= pulse * 0.2;
      parts.torso.rotation.x = THREE.MathUtils.lerp(parts.torso.rotation.x, 0.38 * pulse, snap);
      parts.leftArm.rotation.x = THREE.MathUtils.lerp(parts.leftArm.rotation.x, -1.34, snap);
      parts.rightArm.rotation.x = THREE.MathUtils.lerp(parts.rightArm.rotation.x, -1.18, snap);
    } else if (cue.kind === "flag_capture" || cue.kind === "victory") {
      parts.root.position.y += Math.abs(Math.sin(cueProgress * Math.PI * 2)) * 0.18;
      parts.leftArm.rotation.x = THREE.MathUtils.lerp(parts.leftArm.rotation.x, -2.35, snap);
      parts.rightArm.rotation.x = THREE.MathUtils.lerp(parts.rightArm.rotation.x, -2.35, snap);
      parts.leftArm.rotation.z = THREE.MathUtils.lerp(parts.leftArm.rotation.z, -0.34, snap);
      parts.rightArm.rotation.z = THREE.MathUtils.lerp(parts.rightArm.rotation.z, 0.34, snap);
    } else if (cue.kind === "defeat") {
      parts.torso.rotation.x = THREE.MathUtils.lerp(parts.torso.rotation.x, 0.28 * cueProgress, snap);
      parts.head.rotation.x = THREE.MathUtils.lerp(parts.head.rotation.x, 0.42 * cueProgress, snap);
      parts.leftArm.rotation.x = THREE.MathUtils.lerp(parts.leftArm.rotation.x, 0.24, snap);
      parts.rightArm.rotation.x = THREE.MathUtils.lerp(parts.rightArm.rotation.x, 0.34, snap);
    }
  }
}
