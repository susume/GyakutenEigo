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
  leftHand?: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  leftShin: THREE.Object3D;
  rightShin: THREE.Object3D;
  weapon: THREE.Object3D;
  rearHandGrip?: THREE.Object3D;
  leftHandSupport?: THREE.Object3D;
}

export interface CharacterAnimationState {
  delta?: number;
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

export type CharacterAnimationCue = "fire" | "hit" | "respawn" | "jump" | "land" | "flag_plant" | "flag_capture" | "victory" | "defeat";

const cueDuration: Record<CharacterAnimationCue, number> = {
  fire: 0.24,
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
  private readonly ikTarget = new THREE.Vector3();
  private readonly ikShoulder = new THREE.Vector3();
  private readonly ikDirection = new THREE.Vector3();
  private readonly ikPole = new THREE.Vector3();
  private readonly ikElbow = new THREE.Vector3();
  private readonly ikForearmDirection = new THREE.Vector3();
  private readonly ikQuaternion = new THREE.Quaternion();
  private readonly ikInverseQuaternion = new THREE.Quaternion();
  private readonly weaponTorsoQuaternion = new THREE.Quaternion();
  private readonly weaponParentQuaternion = new THREE.Quaternion();
  private readonly weaponDesiredQuaternion = new THREE.Quaternion();
  private readonly weaponGripOffset = new THREE.Vector3();
  private readonly downVector = new THREE.Vector3(0, -1, 0);
  private readonly weaponEuler = new THREE.Euler();

  private alignWeaponToDominantHand(
    parts: CharacterAnimationParts,
    state: CharacterAnimationState
  ) {
    if (!parts.rearHandGrip || !parts.weapon.parent) return;
    parts.root.updateMatrixWorld(true);
    parts.torso.getWorldQuaternion(this.weaponTorsoQuaternion);
    parts.weapon.parent.getWorldQuaternion(this.weaponParentQuaternion);

    const authoredRotation = (
      parts.weapon.userData.mountRotation as [number, number, number] | undefined
    ) ?? [0, Math.PI, -0.055];
    const aimPitch = THREE.MathUtils.clamp(state.aimPitch ?? 0, -0.42, 0.42);
    const loweredReadyPitch = 0.085 - this.gaitBlend * 0.12 + this.crouchBlend * 0.015;
    this.weaponEuler.set(
      loweredReadyPitch + aimPitch * 0.65 - this.fireKick * 0.025,
      authoredRotation[1],
      authoredRotation[2]
    );
    this.weaponDesiredQuaternion.setFromEuler(this.weaponEuler);
    this.weaponDesiredQuaternion
      .premultiply(this.weaponTorsoQuaternion)
      .premultiply(this.ikInverseQuaternion.copy(this.weaponParentQuaternion).invert());
    parts.weapon.quaternion.copy(this.weaponDesiredQuaternion);

    // Place the authored rear-grip anchor directly in the dominant palm after
    // orientation and scale are applied.
    this.weaponGripOffset
      .copy(parts.rearHandGrip.position)
      .multiply(parts.weapon.scale)
      .applyQuaternion(parts.weapon.quaternion)
      .negate();
    parts.weapon.position.copy(this.weaponGripOffset);
  }

  private applySupportHandIK(parts: CharacterAnimationParts) {
    if (!parts.leftHand || !parts.leftHandSupport || !parts.leftArm.parent) return;

    // The weapon is owned by the right hand. Resolve its authored support socket into
    // torso space so the left arm follows the rifle instead of a coincidental pose.
    parts.root.updateMatrixWorld(true);
    parts.leftHandSupport.getWorldPosition(this.ikTarget);
    parts.torso.worldToLocal(this.ikTarget);
    this.ikShoulder.copy(parts.leftArm.position);
    this.ikDirection.copy(this.ikTarget).sub(this.ikShoulder);

    const upperLength = Math.max(0.001, parts.leftForearm.position.length());
    const lowerLength = Math.max(0.001, parts.leftHand.position.length());
    const targetDistance = THREE.MathUtils.clamp(
      this.ikDirection.length(),
      Math.abs(upperLength - lowerLength) + 0.015,
      upperLength + lowerLength - 0.015
    );
    if (this.ikDirection.lengthSq() < 0.0001) return;
    this.ikDirection.normalize();

    // Keep the stylised support elbow down and outside the torso.
    this.ikPole.set(-0.48, -0.22, 0.08);
    this.ikPole.addScaledVector(this.ikDirection, -this.ikPole.dot(this.ikDirection));
    if (this.ikPole.lengthSq() < 0.0001) this.ikPole.set(-1, 0, 0);
    this.ikPole.normalize();

    const along = (
      upperLength * upperLength
      + targetDistance * targetDistance
      - lowerLength * lowerLength
    ) / (2 * targetDistance);
    const bend = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));
    this.ikElbow
      .copy(this.ikShoulder)
      .addScaledVector(this.ikDirection, along)
      .addScaledVector(this.ikPole, bend);

    const upperDirection = this.ikElbow.sub(this.ikShoulder).normalize();
    this.ikQuaternion.setFromUnitVectors(this.downVector, upperDirection);
    parts.leftArm.quaternion.copy(this.ikQuaternion);

    const elbowPosition = this.ikShoulder
      .copy(parts.leftArm.position)
      .addScaledVector(upperDirection, upperLength);
    this.ikForearmDirection.copy(this.ikTarget).sub(elbowPosition).normalize();
    this.ikInverseQuaternion.copy(parts.leftArm.quaternion).invert();
    this.ikForearmDirection.applyQuaternion(this.ikInverseQuaternion).normalize();
    this.ikQuaternion.setFromUnitVectors(this.downVector, this.ikForearmDirection);
    parts.leftForearm.quaternion.copy(this.ikQuaternion);
    parts.leftHand.rotation.set(0.08, 0, -0.16);
  }

  constructor(private readonly victoryPose: PlayerVictoryPoseId = "champion") {}

  get hasActiveCue() {
    return Boolean(this.cue);
  }

  trigger(kind: CharacterAnimationCue) {
    const duration = cueDuration[kind];
    this.cue = { kind, duration, remaining: duration };
    if (kind === "fire") this.fireKick = 1;
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
    const turnLean = THREE.MathUtils.clamp((state.turnSpeed ?? 0) * -0.045, -0.16, 0.16);
    const backwards = (state.forwardSpeed ?? state.speed) < -0.25 ? -1 : 1;
    parts.root.rotation.z = THREE.MathUtils.lerp(parts.root.rotation.z, strafeLean + turnLean, locomotionResponse);
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
    const aimBlend = THREE.MathUtils.clamp(Math.abs(state.aimPitch ?? 0) * 4.5, 0, 1);

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
      0.58 - aimBlend * 0.15 + this.gaitBlend * 0.06 + swing * 0.045,
      1 - Math.exp(-delta * 16)
    );
    parts.leftForearm.rotation.x = THREE.MathUtils.lerp(
      parts.leftForearm.rotation.x,
      state.carryingObjective ? 1.24 : 0.92,
      0.18
    );
    parts.rightForearm.rotation.x = THREE.MathUtils.lerp(parts.rightForearm.rotation.x, 0.72 + aimBlend * 0.12, 0.18);
    parts.leftForearm.rotation.z = THREE.MathUtils.lerp(
      parts.leftForearm.rotation.z,
      state.carryingObjective ? 0.34 : 0.42,
      0.18
    );
    parts.rightForearm.rotation.z = THREE.MathUtils.lerp(parts.rightForearm.rotation.z, -0.22, 0.18);
    parts.torso.rotation.x = breath + this.gaitBlend * 0.075 + this.crouchBlend * 0.12;
    parts.torso.rotation.z = Math.sin(cycle * 0.5) * 0.05 * this.gaitBlend;
    const turnTwist = THREE.MathUtils.clamp((state.turnSpeed ?? 0) * 0.055, -0.2, 0.2);
    parts.torso.rotation.y = THREE.MathUtils.lerp(parts.torso.rotation.y, torsoTwist + turnTwist, locomotionResponse);
    parts.head.rotation.x = THREE.MathUtils.lerp(
      parts.head.rotation.x,
      THREE.MathUtils.clamp(state.aimPitch ?? 0, -0.42, 0.42) - gaitBob * 0.25,
      1 - Math.exp(-delta * 18)
    );
    parts.head.rotation.y = THREE.MathUtils.lerp(
      parts.head.rotation.y,
      Math.sin(state.elapsed * 0.85) * THREE.MathUtils.lerp(0.05, 0.012, this.gaitBlend) - turnTwist * 0.7,
      1 - Math.exp(-delta * 14)
    );
    parts.head.rotation.z = THREE.MathUtils.lerp(parts.head.rotation.z, 0, 0.18);
    parts.leftArm.rotation.z = THREE.MathUtils.lerp(parts.leftArm.rotation.z, state.carryingObjective ? 0.12 : 0.28, 0.16);
    parts.rightArm.rotation.z = THREE.MathUtils.lerp(parts.rightArm.rotation.z, -0.2, 0.16);

    if (state.firing) this.fireKick = 1;
    this.fireKick = Math.max(0, this.fireKick - 0.18);

    if (!cue) {
      this.alignWeaponToDominantHand(parts, state);
      if (!state.carryingObjective) this.applySupportHandIK(parts);
      return;
    }
    const pulse = Math.sin(cueProgress * Math.PI);
    const snap = Math.min(1, (state.delta ?? 1 / 60) * 18);
    if (cue.kind === "fire") {
      // Square the shoulders, brace the arms and kick the launcher so remote attacks
      // are readable from the player's body rather than only from sound.
      parts.torso.rotation.x = THREE.MathUtils.lerp(parts.torso.rotation.x, -0.13 * pulse, snap);
      parts.torso.rotation.y = THREE.MathUtils.lerp(parts.torso.rotation.y, 0, snap);
      parts.leftArm.rotation.x = THREE.MathUtils.lerp(parts.leftArm.rotation.x, 0.24, snap);
      parts.rightArm.rotation.x = THREE.MathUtils.lerp(parts.rightArm.rotation.x, 0.31, snap);
      parts.leftForearm.rotation.x = THREE.MathUtils.lerp(parts.leftForearm.rotation.x, 1.08, snap);
      parts.rightForearm.rotation.x = THREE.MathUtils.lerp(parts.rightForearm.rotation.x, 0.94, snap);
    } else if (cue.kind === "hit") {
      parts.root.rotation.z = THREE.MathUtils.lerp(parts.root.rotation.z, -0.24 * pulse, snap);
      parts.torso.rotation.y = THREE.MathUtils.lerp(parts.torso.rotation.y, 0.34 * pulse, snap);
      parts.head.rotation.z = THREE.MathUtils.lerp(parts.head.rotation.z, -0.18 * pulse, snap);
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
      if (parts.rearHandGrip && parts.leftHandSupport) {
        // A full arm flourish would drag a hand-owned rifle through the torso.
        // Keep the arena rifle in a proud two-handed high-ready instead.
        parts.root.position.y += pulse * 0.12;
        parts.torso.rotation.x = THREE.MathUtils.lerp(parts.torso.rotation.x, -0.1, snap);
        parts.torso.rotation.z = THREE.MathUtils.lerp(
          parts.torso.rotation.z,
          Math.sin(cueProgress * Math.PI * 4) * 0.08,
          snap
        );
        parts.rightArm.rotation.x = THREE.MathUtils.lerp(parts.rightArm.rotation.x, 0.42, snap);
        parts.rightArm.rotation.z = THREE.MathUtils.lerp(parts.rightArm.rotation.z, -0.24, snap);
        parts.rightForearm.rotation.x = THREE.MathUtils.lerp(parts.rightForearm.rotation.x, 0.88, snap);
        parts.head.rotation.y = THREE.MathUtils.lerp(
          parts.head.rotation.y,
          Math.sin(cueProgress * Math.PI * 3) * 0.12,
          snap
        );
      } else if (this.victoryPose === "wave") {
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
    this.alignWeaponToDominantHand(parts, state);
    if (!state.carryingObjective && cue.kind !== "flag_plant" && cue.kind !== "flag_capture") {
      this.applySupportHandIK(parts);
    }
  }
}
