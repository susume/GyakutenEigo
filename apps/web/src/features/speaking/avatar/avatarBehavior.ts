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

/** Allocation-free procedural portrait animation; has no dependency on WebGL or TTS. */
export class AvatarBehavior {
  readonly pose = {
    blink: 0, headPitch: 0, headYaw: 0, headRoll: 0, breath: 0,
    gazeYaw: 0, gazePitch: 0, happy: 0, relaxed: 0, mouthOpen: 0,
    mouth: new Float32Array(MOUTH_PRESETS.length)
  };
  private time = 0;
  private blinkStart: number;
  private nextGaze = 0;
  private gazeYaw = 0;
  private gazePitch = 0;
  private speechTime = 0;
  private syllableDuration = 0.24;
  private vowel = 0;
  private openness = 0.5;
  private speechPause = false;
  private wasSpeaking = false;

  constructor(private readonly random = Math.random) {
    this.blinkStart = 1 + random() * 2;
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

    const blinkAge = this.time - this.blinkStart;
    p.blink = blinkAge >= 0 && blinkAge < 0.18 ? Math.sin(Math.PI * blinkAge / 0.18) : 0;
    if (blinkAge >= 0.18) this.blinkStart = this.time + 2.8 + this.random() * 3.6;

    if (this.time >= this.nextGaze) {
      this.nextGaze = this.time + 3 + this.random() * 4;
      this.gazeYaw = (this.random() - 0.5) * 3;
      this.gazePitch = (this.random() - 0.5) * 1.6;
    }
    p.gazeYaw = approach(p.gazeYaw, (thinking ? 4 : this.gazeYaw * (listening ? 0.15 : 1)) * scale, delta, 3);
    p.gazePitch = approach(p.gazePitch, (thinking ? -2 : this.gazePitch) * scale, delta, 3);
    const nodPhase = this.time % 7.5;
    const nod = listening && nodPhase < 0.85 ? Math.sin(nodPhase / 0.85 * Math.PI * 2) * 0.022 : 0;
    p.headPitch = approach(p.headPitch, (Math.sin(this.time * 0.7) * 0.009 + nod + (speaking ? Math.sin(this.time * 2.1) * 0.012 : 0)) * scale, delta);
    p.headYaw = approach(p.headYaw, (thinking ? 0.035 : Math.sin(this.time * 0.43) * (listening ? 0.004 : 0.016)) * scale, delta);
    p.headRoll = approach(p.headRoll, Math.sin(this.time * 0.33) * 0.007 * scale, delta);
    p.breath = approach(p.breath, Math.sin(this.time * 1.65) * 0.004 * scale, delta);
    p.happy = approach(p.happy, speaking ? 0.035 : listening ? 0.02 : 0, delta);
    p.relaxed = approach(p.relaxed, thinking ? 0.045 : 0, delta);

    if (speaking && !this.wasSpeaking) this.speechTime = this.syllableDuration;
    if (speaking) {
      this.speechTime += delta;
      if (this.speechTime >= this.syllableDuration) {
        this.speechTime = 0;
        this.speechPause = this.random() < 0.18;
        this.syllableDuration = this.speechPause ? 0.16 + this.random() * 0.24 : 0.18 + this.random() * 0.16;
        this.vowel = Math.min(4, Math.floor(this.random() * 5));
        this.openness = 0.32 + this.random() * 0.34;
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
