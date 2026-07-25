import * as THREE from "three";
import type { PlayerVictoryPoseId } from "@quizstrike/shared";

export interface CharacterAnimationParts {
  root: THREE.Group;
  torso: THREE.Object3D;
  head: THREE.Object3D;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  leftForearm: THREE.Object3D;
  rightForearm: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  leftShin: THREE.Object3D;
  rightShin: THREE.Object3D;
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
  private gaitBlend = 0;
  private crouchBlend = 0;
  private cue?: ActiveCue;

  constructor(private readonly victoryPose: PlayerVictoryPoseId = "champion") {}

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
      parts.leftForearm.rotation.x = THREE.MathUtils.lerp(parts.leftForearm.rotation.x, 0.18, 0.2);
      parts.rightForearm.rotation.x = THREE.MathUtils.lerp(parts.rightForearm.rotation.x, 0.24, 0.2);
      parts.leftShin.rotation.x = THREE.MathUtils.lerp(parts.leftShin.rotation.x, -0.18, 0.2);
      parts.rightShin.rotation.x = THREE.MathUtils.lerp(parts.rightShin.rotation.x, 0.12, 0.2);
      parts.torso.rotation.x = THREE.MathUtils.lerp(parts.torso.rotation.x, 0.22, 0.2);
      parts.head.rotation.x = THREE.MathUtils.lerp(parts.head.rotation.x, 0.32, 0.2);
      parts.weapon.rotation.x = THREE.MathUtils.lerp(parts.weapon.rotation.x, 0.72, 0.2);
      return;
    }

    const delta = THREE.MathUtils.clamp(state.delta ?? 1 / 60, 1 / 240, 0.05);
    const locomotionResponse = 1 - Math.exp(-delta * 10);
    this.gaitBlend = THREE.MathUtils.lerp(
      this.gaitBlend,
      THREE.MathUtils.clamp(Math.abs(state.speed) / 4.5, 0, 1),
      locomotionResponse
    );
    this.crouchBlend = THREE.MathUtils.lerp(
      this.crouchBlend,
      state.crouching ? 1 : 0,
      1 - Math.exp(-delta * 14)
    );
    const strafeLean = THREE.MathUtils.clamp((state.strafeSpeed ?? 0) * -0.028, -0.18, 0.18);
    const backwards = (state.forwardSpeed ?? state.speed) < -0.25 ? -1 : 1;
    parts.root.rotation.z = THREE.MathUtils.lerp(parts.root.rotation.z, strafeLean, locomotionResponse);
    const cycle = state.elapsed * THREE.MathUtils.lerp(2.1, 10.4, this.gaitBlend);
    const gaitBob = Math.abs(Math.cos(cycle)) * 0.055 * this.gaitBlend;
    parts.root.position.y = THREE.MathUtils.lerp(
      parts.root.position.y,
      -0.3 * this.crouchBlend + gaitBob,
      1 - Math.exp(-delta * 12)
    );
    const stride = Math.min(1.22, Math.abs(state.speed) * 0.145) * this.gaitBlend;
    const swing = Math.sin(cycle) * stride * backwards;
    const oppositeSwing = Math.sin(cycle + Math.PI);
    const breath = Math.sin(state.elapsed * 2.15) * 0.026 * (1 - this.gaitBlend * 0.7);
    const torsoTwist = Math.sin(cycle) * 0.075 * this.gaitBlend;
    const weaponPosition = (parts.weapon.userData.mountPosition as [number, number, number] | undefined) ?? [0, 0.14, -0.06];
    const weaponRotation = (parts.weapon.userData.mountRotation as [number, number, number] | undefined) ?? [-0.08, Math.PI, -0.12];

    parts.leftLeg.rotation.x = THREE.MathUtils.lerp(
      parts.leftLeg.rotation.x,
      THREE.MathUtils.lerp(swing, -0.46, this.crouchBlend),
      0.22
    );
    parts.rightLeg.rotation.x = THREE.MathUtils.lerp(
      parts.rightLeg.rotation.x,
      THREE.MathUtils.lerp(-swing, -0.46, this.crouchBlend),
      0.22
    );
    parts.leftShin.rotation.x = THREE.MathUtils.lerp(
      parts.leftShin.rotation.x,
      THREE.MathUtils.lerp(Math.max(0, -swing) * 0.76, 0.92, this.crouchBlend),
      0.2
    );
    parts.rightShin.rotation.x = THREE.MathUtils.lerp(
      parts.rightShin.rotation.x,
      THREE.MathUtils.lerp(Math.max(0, swing) * 0.76, 0.92, this.crouchBlend),
      0.2
    );
    parts.leftLeg.position.y = 0.62 + Math.max(0, oppositeSwing) * Math.min(0.1, state.speed * 0.008);
    parts.rightLeg.position.y = 0.62 + Math.max(0, -oppositeSwing) * Math.min(0.1, state.speed * 0.008);
    parts.leftArm.rotation.x = THREE.MathUtils.lerp(
      parts.leftArm.rotation.x,
      state.carryingObjective ? -0.72 : 0.46 - swing * 0.08,
      1 - Math.exp(-delta * 16)
    );
    parts.rightArm.rotation.x = THREE.MathUtils.lerp(
      parts.rightArm.rotation.x,
      0.58 + swing * 0.055,
      1 - Math.exp(-delta * 16)
    );
    parts.leftForearm.rotation.x = THREE.MathUtils.lerp(
      parts.leftForearm.rotation.x,
      state.carryingObjective ? 1.24 : 0.92,
      0.18
    );
    parts.rightForearm.rotation.x = THREE.MathUtils.lerp(parts.rightForearm.rotation.x, 0.72, 0.18);
    parts.leftForearm.rotation.z = THREE.MathUtils.lerp(
      parts.leftForearm.rotation.z,
      state.carryingObjective ? 0.34 : 0.42,
      0.18
    );
    parts.rightForearm.rotation.z = THREE.MathUtils.lerp(parts.rightForearm.rotation.z, -0.22, 0.18);
    parts.torso.rotation.x = breath + this.gaitBlend * 0.075 + this.crouchBlend * 0.12;
    parts.torso.rotation.z = Math.sin(cycle * 0.5) * 0.05 * this.gaitBlend;
    parts.torso.rotation.y = THREE.MathUtils.lerp(parts.torso.rotation.y, torsoTwist, locomotionResponse);
    parts.head.rotation.x = THREE.MathUtils.lerp(
      parts.head.rotation.x,
      THREE.MathUtils.clamp(state.aimPitch ?? 0, -0.42, 0.42) - gaitBob * 0.25,
      1 - Math.exp(-delta * 18)
    );
    parts.head.rotation.y = Math.sin(state.elapsed * 0.85) * THREE.MathUtils.lerp(0.05, 0.012, this.gaitBlend);
    parts.head.rotation.z = THREE.MathUtils.lerp(parts.head.rotation.z, 0, 0.18);
    parts.leftArm.rotation.z = THREE.MathUtils.lerp(parts.leftArm.rotation.z, state.carryingObjective ? 0.12 : 0.28, 0.16);
    parts.rightArm.rotation.z = THREE.MathUtils.lerp(parts.rightArm.rotation.z, -0.2, 0.16);

    if (state.firing) this.fireKick = 1;
    this.fireKick = Math.max(0, this.fireKick - 0.18);
    parts.weapon.position.set(weaponPosition[0], weaponPosition[1], weaponPosition[2] + this.fireKick * 0.08);
    parts.weapon.rotation.set(
      weaponRotation[0] - this.fireKick * 0.12,
      weaponRotation[1],
      weaponRotation[2] + Math.sin(cycle) * Math.min(0.025, state.speed * 0.002)
    );

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
    } else if (cue.kind === "flag_capture") {
      parts.root.position.y += Math.abs(Math.sin(cueProgress * Math.PI * 2)) * 0.18;
      parts.leftArm.rotation.x = THREE.MathUtils.lerp(parts.leftArm.rotation.x, -2.35, snap);
      parts.rightArm.rotation.x = THREE.MathUtils.lerp(parts.rightArm.rotation.x, -2.35, snap);
      parts.leftArm.rotation.z = THREE.MathUtils.lerp(parts.leftArm.rotation.z, -0.34, snap);
      parts.rightArm.rotation.z = THREE.MathUtils.lerp(parts.rightArm.rotation.z, 0.34, snap);
    } else if (cue.kind === "victory") {
      if (this.victoryPose === "wave") {
        parts.rightArm.rotation.x = THREE.MathUtils.lerp(parts.rightArm.rotation.x, -2.15, snap);
        parts.rightArm.rotation.z = THREE.MathUtils.lerp(
          parts.rightArm.rotation.z,
          0.42 + Math.sin(cueProgress * Math.PI * 6) * 0.34,
          snap
        );
        parts.rightForearm.rotation.x = THREE.MathUtils.lerp(parts.rightForearm.rotation.x, 0.28, snap);
        parts.head.rotation.y = THREE.MathUtils.lerp(parts.head.rotation.y, -0.16, snap);
      } else if (this.victoryPose === "salute") {
        parts.rightArm.rotation.x = THREE.MathUtils.lerp(parts.rightArm.rotation.x, -1.42, snap);
        parts.rightArm.rotation.z = THREE.MathUtils.lerp(parts.rightArm.rotation.z, -0.72, snap);
        parts.rightForearm.rotation.x = THREE.MathUtils.lerp(parts.rightForearm.rotation.x, -1.22, snap);
        parts.head.rotation.x = THREE.MathUtils.lerp(parts.head.rotation.x, -0.08, snap);
      } else if (this.victoryPose === "power") {
        parts.root.position.y += pulse * 0.08;
        parts.torso.rotation.x = THREE.MathUtils.lerp(parts.torso.rotation.x, -0.14, snap);
        parts.leftArm.rotation.x = THREE.MathUtils.lerp(parts.leftArm.rotation.x, -0.36, snap);
        parts.rightArm.rotation.x = THREE.MathUtils.lerp(parts.rightArm.rotation.x, -0.36, snap);
        parts.leftArm.rotation.z = THREE.MathUtils.lerp(parts.leftArm.rotation.z, -1.08, snap);
        parts.rightArm.rotation.z = THREE.MathUtils.lerp(parts.rightArm.rotation.z, 1.08, snap);
      } else {
        parts.root.position.y += Math.abs(Math.sin(cueProgress * Math.PI * 2)) * 0.18;
        parts.leftArm.rotation.x = THREE.MathUtils.lerp(parts.leftArm.rotation.x, -2.35, snap);
        parts.rightArm.rotation.x = THREE.MathUtils.lerp(parts.rightArm.rotation.x, -2.35, snap);
        parts.leftArm.rotation.z = THREE.MathUtils.lerp(parts.leftArm.rotation.z, -0.34, snap);
        parts.rightArm.rotation.z = THREE.MathUtils.lerp(parts.rightArm.rotation.z, 0.34, snap);
      }
    } else if (cue.kind === "defeat") {
      parts.torso.rotation.x = THREE.MathUtils.lerp(parts.torso.rotation.x, 0.28 * cueProgress, snap);
      parts.head.rotation.x = THREE.MathUtils.lerp(parts.head.rotation.x, 0.42 * cueProgress, snap);
      parts.leftArm.rotation.x = THREE.MathUtils.lerp(parts.leftArm.rotation.x, 0.24, snap);
      parts.rightArm.rotation.x = THREE.MathUtils.lerp(parts.rightArm.rotation.x, 0.34, snap);
    }
  }
}
