import type { SpeakingUiState } from "../speakingLifecycle";

export type SpeakingAvatarState = "idle" | "listening" | "thinking" | "speaking" | "paused";

/** Presentation only: the conversation's existing UI state remains authoritative. */
export function speakingAvatarState(state: SpeakingUiState, inactive = false): SpeakingAvatarState {
  if (inactive) return "paused";
  return state === "ready" ? "idle" : state === "ai-speaking" ? "speaking" : state;
}

export const AVATAR_MAX_PIXEL_RATIO = 1.5;
export const AVATAR_FRAME_INTERVAL_MS = 1000 / 30;
export const MOUTH_PRESETS = ["aa", "ih", "ou", "ee", "oh"] as const;

export const avatarMotionScale = (reducedMotion: boolean, paused: boolean) =>
  (reducedMotion ? 0.12 : 1) * (paused ? 0.1 : 1);

const approach = (current: number, target: number, delta: number, speed = 10) =>
  current + (target - current) * (1 - Math.exp(-delta * speed));

const smooth = (value: number) => value * value * (3 - 2 * value);

// Gentle expression weights, tuned with the bundled face. Keep them below the
// point where happy/relaxed expressions dominate vowels or close the eyes.
const personality = {
  idle: { happy: 0.075, relaxed: 0.018 },
  listening: { happy: 0.095, relaxed: 0.022 },
  thinking: { happy: 0.035, relaxed: 0.045 },
  speaking: { happy: 0.11, relaxed: 0.015 },
  paused: { happy: 0.06, relaxed: 0.03 }
} satisfies Record<SpeakingAvatarState, { happy: number; relaxed: number }>;

/** Allocation-free procedural portrait animation; has no dependency on WebGL or TTS. */
export class AvatarBehavior {
  readonly pose = {
    blink: 0, headPitch: 0, headYaw: 0, headRoll: 0, breath: 0,
    gazeYaw: 0, gazePitch: 0, happy: 0, relaxed: 0, mouthOpen: 0,
    mouth: new Float32Array(MOUTH_PRESETS.length)
  };
  private time = 0;
  private blinkStart: number;
  private secondBlink = false;
  private nextGaze: number;
  private gazeReturn = 0;
  private gazeYaw = 0;
  private gazePitch = 0;
  private nextRest: number;
  private restRoll = -0.018;
  private nodStart = Infinity;
  private emphasisStart = Infinity;
  private emphasisDuration = 1;
  private state: SpeakingAvatarState = "idle";
  private stateStarted = 0;
  private speechTime = 0;
  private syllableDuration = 0.24;
  private vowel = 0;
  private openness = 0.5;
  private speechPause = false;
  private wasSpeaking = false;

  constructor(private readonly random = Math.random) {
    this.blinkStart = 1.6 + random() * 2.4;
    this.nextGaze = 5 + random() * 6;
    this.nextRest = 12 + random() * 12;
  }

  step(deltaSeconds: number, state: SpeakingAvatarState, reducedMotion: boolean) {
    // No large jumps after a suspended/hidden tab, slow frame, or resize.
    const delta = Math.max(0, Math.min(deltaSeconds, 0.1));
    this.time += delta;
    const p = this.pose;
    const scale = avatarMotionScale(reducedMotion, state === "paused");
    const speaking = state === "speaking";
    const listening = state === "listening";
    const thinking = state === "thinking";
    if (state !== this.state) {
      this.state = state;
      this.stateStarted = this.time;
      this.nodStart = listening ? this.time + 9 + this.random() * 14 : Infinity;
      this.emphasisStart = speaking ? this.time + 2.5 + this.random() * 5 : Infinity;
    }

    // Fast close, a brief closed moment, then a gentler reopening. A rare
    // second blink has a smaller amplitude and cannot start another double.
    const blinkAge = this.time - this.blinkStart;
    const blinkDuration = this.secondBlink ? 0.16 : 0.19;
    const close = 0.05;
    const hold = 0.025;
    const blinkWeight = this.secondBlink ? 0.75 : 1;
    p.blink = blinkAge < 0 || blinkAge >= blinkDuration ? 0
      : blinkAge < close ? smooth(blinkAge / close) * blinkWeight
      : blinkAge < close + hold ? blinkWeight
      : (1 - smooth((blinkAge - close - hold) / (blinkDuration - close - hold))) * blinkWeight;
    if (blinkAge >= blinkDuration) {
      if (!this.secondBlink && this.random() < 0.1) {
        this.secondBlink = true;
        this.blinkStart = this.time + 0.12 + this.random() * 0.08;
      } else {
        this.secondBlink = false;
        this.blinkStart = this.time + (listening ? 4.5 : 3.1) + this.random() * 4.8;
      }
    }

    if (this.time >= this.nextGaze) {
      this.nextGaze = this.time + 7 + this.random() * 8;
      this.gazeReturn = this.time + 1 + this.random() * 0.8;
      this.gazeYaw = (this.random() - 0.5) * 4;
      this.gazePitch = -0.3 - this.random() * 0.9;
    }
    const lookingAway = this.time < this.gazeReturn;
    // Consider the student's words briefly, then return to eye contact even
    // if the network remains busy. Gaze values are degrees; head pose is radians.
    const thoughtful = thinking ? Math.max(0, 1 - Math.max(0, this.time - this.stateStarted - 1.5) / 2.5) : 0;
    const attention = listening ? 0.25 : speaking ? 0.6 : 1;
    p.gazeYaw = approach(p.gazeYaw, (thoughtful * 3 + (lookingAway ? this.gazeYaw * attention : 0)) * scale, delta, 2);
    p.gazePitch = approach(p.gazePitch, (-thoughtful * 1.8 + (lookingAway ? this.gazePitch * attention : 0)) * scale, delta, 2);
    if (this.time >= this.nextRest) {
      this.nextRest = this.time + 14 + this.random() * 16;
      this.restRoll = (this.random() - 0.5) * 0.04;
    }
    const nodAge = this.time - this.nodStart;
    const nod = listening && nodAge >= 0 && nodAge < 1.15 ? Math.sin(Math.PI * nodAge / 1.15) ** 2 * 0.014 : 0;
    if (nodAge >= 1.15) this.nodStart = this.time + 13 + this.random() * 17;
    const emphasisAge = this.time - this.emphasisStart;
    const emphasis = speaking && emphasisAge >= 0 && emphasisAge < this.emphasisDuration
      ? Math.sin(Math.PI * emphasisAge / this.emphasisDuration) ** 2 * 0.011 : 0;
    if (emphasisAge >= this.emphasisDuration) {
      this.emphasisStart = this.time + 5 + this.random() * 9;
      this.emphasisDuration = 0.9 + this.random() * 0.7;
    }
    p.breath = approach(p.breath, Math.sin(this.time * 1.1) * 0.001 * scale, delta, 2);
    p.headPitch = approach(p.headPitch, (nod - emphasis + thoughtful * 0.006) * scale + p.breath * 0.3, delta, 3);
    p.headYaw = approach(p.headYaw, p.gazeYaw * Math.PI / 180 * 0.12, delta, 1.5);
    p.headRoll = approach(p.headRoll, (this.restRoll + thoughtful * 0.008) * scale, delta, 0.9);
    p.happy = approach(p.happy, personality[state].happy, delta, 4);
    p.relaxed = approach(p.relaxed, personality[state].relaxed, delta, 4);

    if (speaking && !this.wasSpeaking) this.speechTime = this.syllableDuration;
    if (speaking) {
      this.speechTime += delta;
      if (this.speechTime >= this.syllableDuration) {
        this.speechTime = 0;
        this.speechPause = this.random() < 0.24;
        this.syllableDuration = this.speechPause ? 0.18 + this.random() * 0.34 : 0.14 + this.random() * 0.2;
        this.vowel = Math.min(4, Math.floor(this.random() * 5));
        this.openness = 0.2 + this.random() * 0.22;
      }
    }
    this.wasSpeaking = speaking;
    const envelope = speaking && !this.speechPause
      ? Math.pow(Math.max(0, Math.sin(Math.PI * this.speechTime / this.syllableDuration)), 1.2) * this.openness : 0;
    // Crossfade vowels, including a fast, smooth release when playback stops.
    p.mouthOpen = approach(p.mouthOpen, envelope, delta, speaking ? 18 : 30);
    for (let i = 0; i < p.mouth.length; i += 1) {
      p.mouth[i] = approach(p.mouth[i]!, i === this.vowel ? envelope : 0, delta, speaking ? 18 : 30);
    }
    return p;
  }
}
