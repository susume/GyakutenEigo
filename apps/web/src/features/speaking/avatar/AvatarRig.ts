import type { VRM } from "@pixiv/three-vrm";
import { Euler, Quaternion, Vector3 } from "three";
import { AvatarBehavior, MOUTH_PRESETS, type SpeakingAvatarState } from "./avatarBehavior";

/** Feature-detect once at load time; all expression and pose work stays out of React. */
export class AvatarRig {
  private readonly behavior = new AvatarBehavior();
  private readonly manager: VRM["expressionManager"];
  private readonly mouths: { name: string; index: number }[];
  private readonly missingMouths;
  private readonly blinkNames;
  private readonly happy;
  private readonly relaxed;
  private readonly head;
  private readonly spine;
  private readonly jaw;
  private readonly headRest;
  private readonly spineRest;
  private readonly jawRest;
  private readonly rotation = new Euler();
  private readonly offset = new Quaternion();

  constructor(private readonly vrm: VRM) {
    this.manager = vrm.expressionManager;
    this.manager?.resetValues();
    this.mouths = MOUTH_PRESETS.map((name, index) => ({ name, index }))
      .filter(({ name }) => this.manager?.getExpression(name));
    if (!this.mouths.length) {
      const name = ["mouthOpen", "jawOpen"].find((candidate) => this.manager?.getExpression(candidate));
      if (name) this.mouths.push({ name, index: -1 });
    }
    this.missingMouths = MOUTH_PRESETS.map((_, i) => !this.mouths.some((mouth) => mouth.index === i));
    this.blinkNames = this.manager?.getExpression("blink") ? ["blink"]
      : ["blinkLeft", "blinkRight"].filter((name) => this.manager?.getExpression(name));
    const safeExpression = (name: string) => {
      const expression = this.manager?.getExpression(name);
      // Some faces block vowels/blinks at ANY positive smile weight.
      return Boolean(expression && expression.overrideMouth !== "block" && expression.overrideBlink !== "block");
    };
    this.happy = safeExpression("happy");
    this.relaxed = safeExpression("relaxed");
    this.head = vrm.humanoid.getNormalizedBoneNode("head");
    this.spine = vrm.humanoid.getNormalizedBoneNode("chest") ?? vrm.humanoid.getNormalizedBoneNode("spine");
    this.jaw = vrm.humanoid.getNormalizedBoneNode("jaw");
    this.headRest = this.head?.quaternion.clone();
    this.spineRest = this.spine?.quaternion.clone();
    this.jawRest = this.jaw?.quaternion.clone();
    if (vrm.lookAt) vrm.lookAt.autoUpdate = false;
    // VRM 0/1 rigs can face opposite directions. Derive the arm pose from
    // the actual normalized bone offsets so both orientations lower the arms.
    for (const side of ["left", "right"] as const) {
      const upper = vrm.humanoid.getNormalizedBoneNode(`${side}UpperArm`);
      const lower = vrm.humanoid.getNormalizedBoneNode(`${side}LowerArm`);
      if (!upper || !lower || lower.position.lengthSq() < 1e-8) continue;
      const direction = lower.position.clone().normalize();
      const relaxedDirection = new Vector3(Math.sign(direction.x) * 0.36, -0.93, 0).normalize();
      upper.quaternion.multiply(new Quaternion().setFromUnitVectors(direction, relaxedDirection));
    }
  }

  update(delta: number, state: SpeakingAvatarState, reducedMotion: boolean) {
    const p = this.behavior.step(delta, state, reducedMotion);
    for (const name of this.blinkNames) this.manager!.setValue(name, p.blink);
    let missingMouthWeight = 0;
    for (let i = 0; i < MOUTH_PRESETS.length; i += 1) {
      if (this.missingMouths[i]) missingMouthWeight += p.mouth[i]!;
    }
    for (let i = 0; i < this.mouths.length; i += 1) {
      const mouth = this.mouths[i]!;
      this.manager!.setValue(mouth.name, mouth.index === -1 ? p.mouthOpen
        : p.mouth[mouth.index]! + (i === 0 ? missingMouthWeight : 0));
    }
    if (this.happy) this.manager!.setValue("happy", p.happy);
    if (this.relaxed) this.manager!.setValue("relaxed", p.relaxed);
    if (this.head && this.headRest) {
      this.offset.setFromEuler(this.rotation.set(p.headPitch, p.headYaw, p.headRoll));
      this.head.quaternion.copy(this.headRest).multiply(this.offset);
    }
    if (this.spine && this.spineRest) {
      this.offset.setFromEuler(this.rotation.set(p.breath, 0, 0));
      this.spine.quaternion.copy(this.spineRest).multiply(this.offset);
    }
    if (!this.mouths.length && this.jaw && this.jawRest) {
      this.offset.setFromEuler(this.rotation.set(p.mouthOpen * 0.18, 0, 0));
      this.jaw.quaternion.copy(this.jawRest).multiply(this.offset);
    }
    if (this.vrm.lookAt) {
      this.vrm.lookAt.yaw = p.gazeYaw;
      this.vrm.lookAt.pitch = p.gazePitch;
    }
    this.vrm.update(delta);
  }
}
