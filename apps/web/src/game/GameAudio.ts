export type MovementAudioMode = "walk" | "run" | "crouch";

export type GameAudioCue =
  | "walk_step"
  | "run_step"
  | "crouch_step"
  | "jump"
  | "land"
  | "fire"
  | "heavy_fire"
  | "empty_fire"
  | "hit_confirm"
  | "player_tagged"
  | "eliminated"
  | "buy"
  | "menu_toggle"
  | "quiz_correct"
  | "quiz_wrong"
  | "zoom_in"
  | "zoom_out";

type AudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

export interface ToneDefinition {
  frequency: number;
  durationMs: number;
  gain: number;
  type: OscillatorType;
  frequencyEnd?: number;
  noise?: boolean;
}

export const GAME_AUDIO_CUES: Record<GameAudioCue, ToneDefinition> = {
  walk_step: { frequency: 105, durationMs: 54, gain: 0.035, type: "sine", frequencyEnd: 72 },
  run_step: { frequency: 132, durationMs: 48, gain: 0.045, type: "sine", frequencyEnd: 82 },
  crouch_step: { frequency: 78, durationMs: 68, gain: 0.024, type: "sine", frequencyEnd: 56 },
  jump: { frequency: 210, durationMs: 120, gain: 0.045, type: "triangle", frequencyEnd: 340 },
  land: { frequency: 88, durationMs: 96, gain: 0.048, type: "sine", frequencyEnd: 48 },
  fire: { frequency: 150, durationMs: 260, gain: 0.06, type: "sine", frequencyEnd: 55, noise: true },
  heavy_fire: { frequency: 92, durationMs: 420, gain: 0.09, type: "sawtooth", frequencyEnd: 38, noise: true },
  empty_fire: { frequency: 130, durationMs: 120, gain: 0.04, type: "sawtooth", frequencyEnd: 94 },
  hit_confirm: { frequency: 740, durationMs: 150, gain: 0.058, type: "triangle", frequencyEnd: 980 },
  player_tagged: { frequency: 190, durationMs: 190, gain: 0.064, type: "sawtooth", frequencyEnd: 118 },
  eliminated: { frequency: 112, durationMs: 340, gain: 0.072, type: "sawtooth", frequencyEnd: 62 },
  buy: { frequency: 520, durationMs: 160, gain: 0.05, type: "triangle", frequencyEnd: 780 },
  menu_toggle: { frequency: 330, durationMs: 80, gain: 0.032, type: "sine", frequencyEnd: 420 },
  quiz_correct: { frequency: 720, durationMs: 160, gain: 0.06, type: "triangle", frequencyEnd: 920 },
  quiz_wrong: { frequency: 160, durationMs: 190, gain: 0.058, type: "sine", frequencyEnd: 112 },
  zoom_in: { frequency: 430, durationMs: 130, gain: 0.036, type: "sine", frequencyEnd: 620 },
  zoom_out: { frequency: 360, durationMs: 120, gain: 0.032, type: "sine", frequencyEnd: 220 }
};

export const BGM_PATTERN: ToneDefinition[] = [
  { frequency: 196, durationMs: 360, gain: 0.026, type: "triangle" },
  { frequency: 246.94, durationMs: 360, gain: 0.024, type: "triangle" },
  { frequency: 293.66, durationMs: 360, gain: 0.024, type: "triangle" },
  { frequency: 246.94, durationMs: 360, gain: 0.022, type: "triangle" },
  { frequency: 220, durationMs: 360, gain: 0.024, type: "triangle" },
  { frequency: 261.63, durationMs: 360, gain: 0.024, type: "triangle" },
  { frequency: 329.63, durationMs: 360, gain: 0.026, type: "triangle" },
  { frequency: 261.63, durationMs: 520, gain: 0.022, type: "triangle" }
];

export const getMovementStepIntervalMs = (mode: MovementAudioMode) => {
  if (mode === "run") return 270;
  if (mode === "crouch") return 620;
  return 410;
};

const cueForMovementMode = (mode: MovementAudioMode): GameAudioCue => {
  if (mode === "run") return "run_step";
  if (mode === "crouch") return "crouch_step";
  return "walk_step";
};

class GameAudioController {
  private audio: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmTimer: number | null = null;
  private bgmIndex = 0;
  private bgmActive = false;
  private lastStepAt = 0;

  warm() {
    try {
      const audio = this.ensureAudio();
      if (audio?.state === "suspended") void audio.resume();
      if (this.bgmActive) this.scheduleBgm();
    } catch {
      // Browsers may block audio until a trusted user gesture.
    }
  }

  setBgmActive(active: boolean) {
    this.bgmActive = active;
    if (!active) {
      this.clearBgmTimer();
      return;
    }
    this.warm();
  }

  play(cue: GameAudioCue) {
    this.playTone(GAME_AUDIO_CUES[cue]);
  }

  playHeavyFire() {
    this.play("heavy_fire");
    if (typeof window === "undefined") return;
    window.setTimeout(() => this.playTone({ frequency: 58, durationMs: 520, gain: 0.035, type: "sine", frequencyEnd: 32, noise: true }), 140);
    window.setTimeout(() => this.playTone({ frequency: 44, durationMs: 620, gain: 0.022, type: "sine", frequencyEnd: 26 }), 310);
  }

  playMovementStep(mode: MovementAudioMode, nowMs: number) {
    const interval = getMovementStepIntervalMs(mode);
    if (nowMs - this.lastStepAt < interval) return;
    this.lastStepAt = nowMs;
    this.play(cueForMovementMode(mode));
  }

  private ensureAudio() {
    if (typeof window === "undefined") return null;
    const AudioCtor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
    if (!AudioCtor) return null;
    if (!this.audio || this.audio.state === "closed") {
      this.audio = new AudioCtor();
      this.masterGain = this.audio.createGain();
      this.masterGain.gain.setValueAtTime(0.72, this.audio.currentTime);
      this.masterGain.connect(this.audio.destination);
    }
    return this.audio;
  }

  private playTone(definition: ToneDefinition) {
    try {
      const audio = this.ensureAudio();
      if (!audio || !this.masterGain) return;
      if (audio.state === "suspended") void audio.resume();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const now = audio.currentTime;
      const end = now + definition.durationMs / 1000;
      oscillator.type = definition.type;
      oscillator.frequency.setValueAtTime(definition.frequency, now);
      if (definition.frequencyEnd) oscillator.frequency.exponentialRampToValueAtTime(definition.frequencyEnd, end);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(definition.gain, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(gain);
      gain.connect(this.masterGain);
      oscillator.start(now);
      oscillator.stop(end + 0.02);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
      if (definition.noise) this.playNoiseWhoosh(now, end, definition.gain * 0.9);
    } catch {
      // Audio feedback is decorative and should never break gameplay.
    }
  }

  private playNoiseWhoosh(start: number, end: number, peakGain: number) {
    if (!this.audio || !this.masterGain) return;
    const length = Math.max(1, Math.floor(this.audio.sampleRate * Math.max(0.05, end - start)));
    const buffer = this.audio.createBuffer(1, length, this.audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      const fade = 1 - index / length;
      data[index] = (Math.random() * 2 - 1) * fade;
    }
    const source = this.audio.createBufferSource();
    const filter = this.audio.createBiquadFilter();
    const gain = this.audio.createGain();
    source.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(520, start);
    filter.frequency.exponentialRampToValueAtTime(120, end);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peakGain, start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start(start);
    source.stop(end + 0.02);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }

  private scheduleBgm() {
    if (this.bgmTimer !== null || !this.bgmActive) return;
    const playNext = () => {
      if (!this.bgmActive) return;
      const note = BGM_PATTERN[this.bgmIndex % BGM_PATTERN.length];
      this.bgmIndex += 1;
      this.playTone(note);
      this.bgmTimer = window.setTimeout(() => {
        this.bgmTimer = null;
        playNext();
      }, note.durationMs + 110);
    };
    playNext();
  }

  private clearBgmTimer() {
    if (this.bgmTimer === null || typeof window === "undefined") return;
    window.clearTimeout(this.bgmTimer);
    this.bgmTimer = null;
  }
}

export const gameAudio = new GameAudioController();
