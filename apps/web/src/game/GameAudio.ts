export type MovementAudioMode = "walk" | "run" | "crouch";
export type MovementSurface = "snow" | "wood" | "stone" | "sand" | "metal" | "water";

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

export type SpatialAudioOptions = {
  /** Stereo position from -1 (left) to 1 (right). */
  pan?: number;
  /** Arena-space distance used for level and high-frequency rolloff. */
  distance?: number;
  /** Optional per-event intensity multiplier. */
  intensity?: number;
};

export interface ToneDefinition {
  frequency: number;
  durationMs: number;
  gain: number;
  type: OscillatorType;
  frequencyEnd?: number;
  noise?: boolean;
}

type SampleDefinition = {
  files: string[];
  gain: number;
  playbackRate?: number;
  pitchVariance?: number;
  maxVoices?: number;
};

type AudioSampleKey = GameAudioCue | `surface_${MovementSurface}`;

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
  { frequency: 110, durationMs: 820, gain: 0.011, type: "sine" },
  { frequency: 130.81, durationMs: 820, gain: 0.010, type: "sine" },
  { frequency: 146.83, durationMs: 820, gain: 0.010, type: "sine" },
  { frequency: 164.81, durationMs: 820, gain: 0.009, type: "sine" },
  { frequency: 123.47, durationMs: 820, gain: 0.010, type: "sine" },
  { frequency: 146.83, durationMs: 820, gain: 0.010, type: "sine" },
  { frequency: 174.61, durationMs: 820, gain: 0.011, type: "sine" },
  { frequency: 130.81, durationMs: 1040, gain: 0.009, type: "sine" }
];

const AUDIO_ROOT = "/assets/audio/kenney/";
const file = (name: string) => `${AUDIO_ROOT}${name}`;

/**
 * CC0 Kenney samples are deliberately kept in a small manifest so the game
 * can preload one coherent palette and fall back to the original synth cues
 * if a browser cannot decode OGG.
 */
export const GAME_AUDIO_ASSETS: Partial<Record<AudioSampleKey, SampleDefinition>> = {
  walk_step: { files: ["footstep_snow_000.ogg", "footstep_snow_001.ogg", "footstep_snow_002.ogg", "footstep_snow_003.ogg", "footstep_snow_004.ogg"], gain: 0.68, playbackRate: 1, pitchVariance: 0.06, maxVoices: 3 },
  run_step: { files: ["footstep_snow_000.ogg", "footstep_snow_001.ogg", "footstep_snow_002.ogg", "footstep_snow_003.ogg", "footstep_snow_004.ogg"], gain: 0.78, playbackRate: 1.14, pitchVariance: 0.07, maxVoices: 3 },
  crouch_step: { files: ["footstep_snow_000.ogg", "footstep_snow_001.ogg", "footstep_snow_002.ogg", "footstep_snow_003.ogg", "footstep_snow_004.ogg"], gain: 0.42, playbackRate: 0.82, pitchVariance: 0.04, maxVoices: 2 },
  land: { files: ["impactSoft_medium_002.ogg"], gain: 0.5, playbackRate: 0.74, pitchVariance: 0.04, maxVoices: 2 },
  fire: { files: ["impactSoft_medium_000.ogg", "impactSoft_medium_001.ogg", "impactSoft_medium_002.ogg"], gain: 0.46, playbackRate: 1.08, pitchVariance: 0.1, maxVoices: 3 },
  heavy_fire: { files: ["impactMetal_heavy_000.ogg"], gain: 0.72, playbackRate: 0.82, pitchVariance: 0.04, maxVoices: 2 },
  empty_fire: { files: ["switch12.ogg", "switch21.ogg"], gain: 0.54, playbackRate: 1, pitchVariance: 0.04, maxVoices: 2 },
  hit_confirm: { files: ["impactPunch_medium_000.ogg", "impactPunch_medium_001.ogg"], gain: 0.64, playbackRate: 1.08, pitchVariance: 0.08, maxVoices: 4 },
  player_tagged: { files: ["impactSoft_heavy_000.ogg"], gain: 0.58, playbackRate: 0.9, pitchVariance: 0.05, maxVoices: 3 },
  eliminated: { files: ["impactBell_heavy_000.ogg"], gain: 0.62, playbackRate: 0.76, pitchVariance: 0.04, maxVoices: 2 },
  buy: { files: ["handleCoins.ogg", "handleCoins2.ogg"], gain: 0.54, playbackRate: 1.04, pitchVariance: 0.05, maxVoices: 2 },
  menu_toggle: { files: ["click1.ogg", "click2.ogg", "click3.ogg"], gain: 0.5, playbackRate: 1.04, pitchVariance: 0.06, maxVoices: 4 },
  quiz_correct: { files: ["switch1.ogg"], gain: 0.34, playbackRate: 1.08, pitchVariance: 0.03, maxVoices: 2 },
  quiz_wrong: { files: ["switch12.ogg"], gain: 0.28, playbackRate: 0.92, pitchVariance: 0.03, maxVoices: 2 },
  zoom_in: { files: ["rollover1.ogg"], gain: 0.38, playbackRate: 1.14, pitchVariance: 0.05, maxVoices: 2 },
  zoom_out: { files: ["rollover1.ogg"], gain: 0.32, playbackRate: 0.86, pitchVariance: 0.05, maxVoices: 2 }
};

Object.assign(GAME_AUDIO_ASSETS, {
  surface_wood: { files: ["footstep_wood_000.ogg", "footstep_wood_001.ogg", "footstep_wood_002.ogg"], gain: 0.58, playbackRate: 1, pitchVariance: 0.05, maxVoices: 3 },
  surface_stone: { files: ["footstep_concrete_000.ogg", "footstep_concrete_001.ogg", "footstep_concrete_002.ogg"], gain: 0.64, playbackRate: 1, pitchVariance: 0.05, maxVoices: 3 },
  surface_sand: { files: ["footstep_snow_000.ogg", "footstep_snow_001.ogg", "footstep_snow_002.ogg"], gain: 0.52, playbackRate: 0.94, pitchVariance: 0.05, maxVoices: 3 },
  surface_metal: { files: ["footstep_concrete_000.ogg", "footstep_concrete_001.ogg", "footstep_concrete_002.ogg"], gain: 0.7, playbackRate: 1.12, pitchVariance: 0.05, maxVoices: 3 },
  surface_water: { files: ["impactSoft_medium_000.ogg", "impactSoft_medium_001.ogg"], gain: 0.24, playbackRate: 1.1, pitchVariance: 0.08, maxVoices: 2 }
} satisfies Partial<Record<AudioSampleKey, SampleDefinition>>);

export type AudioEventCue =
  | "weapon_fire_basic"
  | "weapon_fire_quick"
  | "weapon_fire_basic_remote"
  | "weapon_fire_quick_remote"
  | "weapon_fire_heavy_local"
  | "weapon_fire_heavy_remote"
  | "projectile_pass"
  | "world_impact"
  | "shield_impact"
  | "cooldown_ready"
  | "cooldown_tick"
  | "weapon_equip"
  | "weapon_switch"
  | "heavy_scope"
  | "heavy_charge"
  | "low_health"
  | "assist"
  | "respawn_countdown"
  | "temporary_invulnerability"
  | "teammate_blocked"
  | "out_of_bounds"
  | "flag_pickup"
  | "flag_drop"
  | "flag_return"
  | "flag_teammate"
  | "flag_enemy"
  | "flag_zone"
  | "flag_plant_start"
  | "flag_plant_interrupt"
  | "flag_planted"
  | "objective_countdown"
  | "objective_near_complete"
  | "flag_capture"
  | "flag_defended"
  | "flag_reset"
  | "quiz_open"
  | "quiz_timer_start"
  | "quiz_timer_warning"
  | "quiz_select"
  | "quiz_lock"
  | "answer_reveal"
  | "team_bonus"
  | "score_awarded"
  | "streak"
  | "quiz_complete"
  | "player_join"
  | "player_leave"
  | "team_select"
  | "match_ready"
  | "round_countdown"
  | "round_start"
  | "round_ending"
  | "overtime"
  | "round_win"
  | "round_loss"
  | "draw"
  | "match_victory"
  | "match_defeat"
  | "scoreboard_open"
  | "results_confirm"
  | "lobby_return"
  | "rematch_ready"
  | "ui_hover"
  | "ui_click_secondary"
  | "ui_back"
  | "ui_tab"
  | "ui_toggle"
  | "ui_dropdown"
  | "ui_slider"
  | "ui_confirm"
  | "ui_cancel"
  | "ui_warning"
  | "ui_error"
  | "modal_open"
  | "modal_close"
  | "code_copied"
  | "room_joined"
  | "room_join_failed"
  | "settings_saved";

const eventTone = (frequency: number, durationMs: number, gain: number, type: OscillatorType, frequencyEnd?: number, noise = false): ToneDefinition => ({
  frequency,
  durationMs,
  gain,
  type,
  frequencyEnd,
  noise
});

export const GAME_AUDIO_EVENT_CUES: Record<AudioEventCue, ToneDefinition> = {
  weapon_fire_basic: eventTone(174, 135, 0.038, "triangle", 92, true),
  weapon_fire_quick: eventTone(420, 82, 0.026, "triangle", 205, true),
  weapon_fire_basic_remote: eventTone(150, 155, 0.024, "triangle", 80, true),
  weapon_fire_quick_remote: eventTone(360, 72, 0.018, "triangle", 180, true),
  weapon_fire_heavy_local: eventTone(88, 420, 0.08, "sawtooth", 34, true),
  weapon_fire_heavy_remote: eventTone(78, 360, 0.04, "sine", 36, true),
  projectile_pass: eventTone(640, 180, 0.022, "sine", 260, true),
  world_impact: eventTone(160, 120, 0.034, "triangle", 72),
  shield_impact: eventTone(520, 115, 0.032, "triangle", 250),
  cooldown_ready: eventTone(610, 105, 0.026, "triangle", 860),
  cooldown_tick: eventTone(300, 55, 0.014, "sine", 260),
  weapon_equip: eventTone(260, 130, 0.025, "triangle", 420),
  weapon_switch: eventTone(340, 100, 0.022, "sine", 520),
  heavy_scope: eventTone(230, 155, 0.026, "sine", 660),
  heavy_charge: eventTone(92, 420, 0.026, "sine", 185),
  low_health: eventTone(190, 180, 0.03, "triangle", 125),
  assist: eventTone(460, 120, 0.022, "triangle", 650),
  respawn_countdown: eventTone(290, 120, 0.022, "sine", 240),
  temporary_invulnerability: eventTone(720, 180, 0.02, "sine", 1020),
  teammate_blocked: eventTone(245, 110, 0.018, "sine", 190),
  out_of_bounds: eventTone(180, 170, 0.026, "triangle", 125),
  flag_pickup: eventTone(410, 150, 0.028, "triangle", 650),
  flag_drop: eventTone(300, 170, 0.028, "triangle", 170),
  flag_return: eventTone(480, 190, 0.024, "sine", 760),
  flag_teammate: eventTone(360, 120, 0.018, "sine", 480),
  flag_enemy: eventTone(240, 150, 0.022, "triangle", 180),
  flag_zone: eventTone(310, 105, 0.018, "sine", 440),
  flag_plant_start: eventTone(260, 300, 0.02, "sine", 340),
  flag_plant_interrupt: eventTone(210, 125, 0.024, "triangle", 125),
  flag_planted: eventTone(520, 230, 0.03, "triangle", 780),
  objective_countdown: eventTone(350, 90, 0.022, "sine", 330),
  objective_near_complete: eventTone(580, 160, 0.026, "triangle", 860),
  flag_capture: eventTone(660, 260, 0.034, "triangle", 980),
  flag_defended: eventTone(410, 220, 0.026, "triangle", 620),
  flag_reset: eventTone(250, 180, 0.022, "sine", 130),
  quiz_open: eventTone(280, 110, 0.02, "sine", 430),
  quiz_timer_start: eventTone(450, 90, 0.018, "sine", 520),
  quiz_timer_warning: eventTone(330, 95, 0.018, "triangle", 280),
  quiz_select: eventTone(470, 65, 0.016, "sine", 560),
  quiz_lock: eventTone(520, 75, 0.02, "triangle", 420),
  answer_reveal: eventTone(400, 180, 0.02, "sine", 700),
  team_bonus: eventTone(520, 170, 0.026, "triangle", 760),
  score_awarded: eventTone(580, 100, 0.018, "sine", 740),
  streak: eventTone(620, 180, 0.026, "triangle", 880),
  quiz_complete: eventTone(330, 320, 0.024, "sine", 660),
  player_join: eventTone(370, 120, 0.018, "sine", 500),
  player_leave: eventTone(250, 120, 0.016, "sine", 180),
  team_select: eventTone(420, 90, 0.018, "sine", 560),
  match_ready: eventTone(430, 140, 0.024, "triangle", 640),
  round_countdown: eventTone(280, 105, 0.022, "sine", 240),
  round_start: eventTone(360, 280, 0.028, "triangle", 720),
  round_ending: eventTone(240, 200, 0.022, "triangle", 180),
  overtime: eventTone(420, 220, 0.026, "triangle", 280),
  round_win: eventTone(520, 260, 0.03, "triangle", 860),
  round_loss: eventTone(230, 250, 0.026, "sine", 120),
  draw: eventTone(330, 250, 0.02, "sine", 260),
  match_victory: eventTone(500, 420, 0.034, "triangle", 980),
  match_defeat: eventTone(210, 360, 0.026, "sine", 100),
  scoreboard_open: eventTone(390, 105, 0.018, "sine", 520),
  results_confirm: eventTone(540, 130, 0.022, "triangle", 720),
  lobby_return: eventTone(320, 140, 0.018, "sine", 220),
  rematch_ready: eventTone(470, 150, 0.022, "triangle", 620),
  ui_hover: eventTone(420, 35, 0.008, "sine", 480),
  ui_click_secondary: eventTone(300, 65, 0.014, "sine", 250),
  ui_back: eventTone(260, 85, 0.016, "triangle", 180),
  ui_tab: eventTone(450, 55, 0.014, "sine", 560),
  ui_toggle: eventTone(350, 75, 0.016, "sine", 450),
  ui_dropdown: eventTone(390, 75, 0.014, "sine", 500),
  ui_slider: eventTone(470, 35, 0.008, "sine", 510),
  ui_confirm: eventTone(520, 110, 0.022, "triangle", 740),
  ui_cancel: eventTone(230, 110, 0.018, "sine", 160),
  ui_warning: eventTone(260, 150, 0.022, "triangle", 190),
  ui_error: eventTone(180, 160, 0.022, "sine", 120),
  modal_open: eventTone(300, 105, 0.016, "sine", 430),
  modal_close: eventTone(360, 100, 0.014, "sine", 240),
  code_copied: eventTone(620, 120, 0.02, "triangle", 820),
  room_joined: eventTone(440, 180, 0.024, "triangle", 680),
  room_join_failed: eventTone(190, 180, 0.022, "triangle", 125),
  settings_saved: eventTone(500, 110, 0.018, "triangle", 680)
};

export const getMovementStepIntervalMs = (mode: MovementAudioMode) => {
  if (mode === "run") return 270;
  if (mode === "crouch") return 620;
  return 410;
};

export const getCombatAudioSpatial = ({
  attacker,
  target
}: {
  attacker: { x: number; z: number };
  target: { x: number; z: number; facing: number };
}): SpatialAudioOptions => {
  if (![attacker.x, attacker.z, target.x, target.z, target.facing].every(Number.isFinite)) return {};
  const dx = attacker.x - target.x;
  const dz = attacker.z - target.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 0.001) return { distance: 0 };
  const relativeAngle = Math.atan2(dx, dz) - target.facing;
  return { pan: Math.max(-1, Math.min(1, Math.sin(relativeAngle))), distance };
};

const cueForMovementMode = (mode: MovementAudioMode): GameAudioCue => {
  if (mode === "run") return "run_step";
  if (mode === "crouch") return "crouch_step";
  return "walk_step";
};

class GameAudioController {
  private audio: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private bgmTimer: number | null = null;
  private bgmIndex = 0;
  private bgmActive = false;
  private lastStepAt = 0;
  private muted = false;
  private musicVolume = 0.16;
  private assetLoadPromise: Promise<void> | null = null;
  private assetLoadScheduled = false;
  private noiseBuffer: AudioBuffer | null = null;
  private readonly assetBufferPromises = new Map<string, Promise<AudioBuffer | null>>();
  private readonly buffers = new Map<AudioSampleKey, AudioBuffer[]>();
  private readonly assetCursors = new Map<AudioSampleKey, number>();
  private readonly activeVoices = new Map<AudioSampleKey, number>();
  private readonly lastEventAt = new Map<AudioEventCue, number>();
  private readonly remoteStepAt = new Map<string, number>();

  warm() {
    try {
      const audio = this.ensureAudio();
      if (audio?.state === "suspended") void audio.resume();
      if (audio) this.scheduleAssetLoad(audio);
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

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.audio && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.72, this.audio.currentTime, 0.02);
    }
  }

  setMusicVolume(volume: number) {
    const nextVolume = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 0.16));
    this.musicVolume = nextVolume;
    if (this.audio && this.musicGain) {
      this.musicGain.gain.setTargetAtTime(nextVolume, this.audio.currentTime, 0.02);
    }
  }

  play(cue: GameAudioCue, spatial: SpatialAudioOptions = {}) {
    const audio = this.ensureAudio();
    if (!audio || !this.masterGain) return;
    if (audio.state === "suspended") void audio.resume();
    const buffers = this.buffers.get(cue);
    if (buffers?.length) {
      this.playSample(cue, buffers, spatial);
    } else {
      this.playTone(GAME_AUDIO_CUES[cue], spatial);
      this.scheduleAssetLoad(audio);
    }
    this.playCueAccent(cue, spatial);
  }

  playEvent(cue: AudioEventCue, spatial: SpatialAudioOptions = {}, throttleMs = 0) {
    const nowMs = typeof performance === "undefined" ? Date.now() : performance.now();
    const defaultThrottle = cue === "player_join" || cue === "player_leave" ? 320 : cue === "round_start" ? 600 : cue === "cooldown_tick" ? 240 : 0;
    const lastPlayed = this.lastEventAt.get(cue) ?? -Infinity;
    if (nowMs - lastPlayed < Math.max(throttleMs, defaultThrottle)) return;
    this.lastEventAt.set(cue, nowMs);
    if (cue === "weapon_fire_heavy_local") {
      this.playHeavyFire();
      return;
    }
    if (cue === "weapon_fire_basic" || cue === "weapon_fire_basic_remote") {
      this.play("fire", spatial);
      return;
    }
    if (cue === "weapon_fire_quick" || cue === "weapon_fire_quick_remote") {
      this.play("fire", spatial);
      this.playTone(GAME_AUDIO_EVENT_CUES[cue], spatial);
      return;
    }
    if (cue === "weapon_fire_heavy_remote") {
      this.play("heavy_fire", spatial);
      this.playTone(GAME_AUDIO_EVENT_CUES[cue], spatial);
      return;
    }
    const mappedSample: Partial<Record<AudioEventCue, GameAudioCue>> = {
      world_impact: "land",
      shield_impact: "hit_confirm",
      ui_click_secondary: "menu_toggle",
      ui_confirm: "menu_toggle",
      ui_cancel: "menu_toggle",
      code_copied: "menu_toggle",
      room_joined: "menu_toggle",
      room_join_failed: "empty_fire",
      settings_saved: "menu_toggle"
    };
    const sampleCue = mappedSample[cue];
    if (sampleCue) {
      this.play(sampleCue, spatial);
      return;
    }
    this.playTone(GAME_AUDIO_EVENT_CUES[cue], spatial);
  }

  playHeavyFire() {
    this.play("heavy_fire");
    if (typeof window === "undefined") return;
    window.setTimeout(() => this.playTone({ frequency: 58, durationMs: 520, gain: 0.035, type: "sine", frequencyEnd: 32, noise: true }), 140);
    window.setTimeout(() => this.playTone({ frequency: 44, durationMs: 620, gain: 0.022, type: "sine", frequencyEnd: 26 }), 310);
  }

  playMovementStep(mode: MovementAudioMode, nowMs: number, surface: MovementSurface = "snow") {
    const interval = getMovementStepIntervalMs(mode);
    if (nowMs - this.lastStepAt < interval) return;
    this.lastStepAt = nowMs;
    const cue = cueForMovementMode(mode);
    if (surface === "snow") {
      this.play(cue);
      return;
    }
    const surfaceKey: AudioSampleKey = `surface_${surface}`;
    const buffers = this.buffers.get(surfaceKey);
    if (!buffers?.length) {
      this.play(cue);
      return;
    }
    const modeRate = mode === "run" ? 1.14 : mode === "crouch" ? 0.82 : 1;
    this.playSample(surfaceKey, buffers, {}, modeRate);
  }

  playRemoteFootstep(sourceId: string, spatial: SpatialAudioOptions, surface: MovementSurface = "snow") {
    const nowMs = typeof performance === "undefined" ? Date.now() : performance.now();
    if (nowMs - (this.remoteStepAt.get(sourceId) ?? -Infinity) < 380) return;
    this.remoteStepAt.set(sourceId, nowMs);
    if (surface === "snow") {
      this.play("walk_step", spatial);
      return;
    }
    const surfaceKey: AudioSampleKey = `surface_${surface}`;
    const buffers = this.buffers.get(surfaceKey);
    if (buffers?.length) this.playSample(surfaceKey, buffers, spatial);
    else this.play("walk_step", spatial);
  }

  private ensureAudio() {
    if (typeof window === "undefined") return null;
    const AudioCtor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
    if (!AudioCtor) return null;
    if (!this.audio || this.audio.state === "closed") {
      this.audio = new AudioCtor();
      this.masterGain = this.audio.createGain();
      this.sfxGain = this.audio.createGain();
      this.musicGain = this.audio.createGain();
      this.noiseBuffer = null;
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.72, this.audio.currentTime);
      this.sfxGain.gain.setValueAtTime(0.86, this.audio.currentTime);
      this.musicGain.gain.setValueAtTime(this.musicVolume, this.audio.currentTime);
      this.sfxGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);
      this.masterGain.connect(this.audio.destination);
    }
    return this.audio;
  }

  private scheduleAssetLoad(audio: AudioContext) {
    if (this.assetLoadPromise || this.assetLoadScheduled) return;
    this.assetLoadScheduled = true;
    const start = () => {
      this.assetLoadScheduled = false;
      void this.loadAssets(audio);
    };
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(start, { timeout: 1200 });
    } else {
      window.setTimeout(start, 120);
    }
  }

  private loadAssets(audio: AudioContext) {
    if (this.assetLoadPromise) return this.assetLoadPromise;
    const entries = Object.entries(GAME_AUDIO_ASSETS) as [AudioSampleKey, SampleDefinition][];
    this.assetLoadPromise = Promise.all(entries.map(async ([cue, definition]) => {
      const loaded = await Promise.all(definition.files.map((asset) => this.loadAssetBuffer(audio, asset)));
      const buffers = loaded.filter((buffer): buffer is AudioBuffer => buffer !== null);
      if (buffers.length) this.buffers.set(cue, buffers);
    })).then(() => undefined).catch(() => undefined);
    return this.assetLoadPromise;
  }

  private loadAssetBuffer(audio: AudioContext, asset: string) {
    const existing = this.assetBufferPromises.get(asset);
    if (existing) return existing;
    const loading = (async () => {
      try {
        const response = await fetch(file(asset), { cache: "force-cache" });
        if (!response.ok) return null;
        return await audio.decodeAudioData(await response.arrayBuffer());
      } catch {
        return null;
      }
    })();
    this.assetBufferPromises.set(asset, loading);
    return loading;
  }

  private playSample(cue: AudioSampleKey, buffers: AudioBuffer[], spatial: SpatialAudioOptions, playbackRateMultiplier = 1) {
    if (!this.audio || !this.sfxGain) return;
    const definition = GAME_AUDIO_ASSETS[cue];
    if (!definition) return;
    const currentVoices = this.activeVoices.get(cue) ?? 0;
    if (currentVoices >= (definition.maxVoices ?? 3)) return;
    const cursor = this.assetCursors.get(cue) ?? 0;
    const buffer = buffers[cursor % buffers.length];
    this.assetCursors.set(cue, cursor + 1);
    const source = this.audio.createBufferSource();
    const gain = this.audio.createGain();
    const now = this.audio.currentTime;
    const pitchVariance = definition.pitchVariance ?? 0;
    const playbackRate = (definition.playbackRate ?? 1) * playbackRateMultiplier * (1 + (Math.random() * 2 - 1) * pitchVariance);
    source.buffer = buffer;
    source.playbackRate.setValueAtTime(playbackRate, now);
    gain.gain.setValueAtTime(Math.max(0.001, definition.gain * this.getSpatialGain(spatial)), now);
    source.connect(gain);
    const spatialNodes = this.connectSpatial(gain, spatial, now);
    source.start(now);
    this.activeVoices.set(cue, currentVoices + 1);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      spatialNodes.cleanup();
      this.activeVoices.set(cue, Math.max(0, (this.activeVoices.get(cue) ?? 1) - 1));
    };
  }

  private playTone(definition: ToneDefinition, spatial: SpatialAudioOptions = {}) {
    try {
      const audio = this.ensureAudio();
      if (!audio || !this.sfxGain) return;
      if (audio.state === "suspended") void audio.resume();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const now = audio.currentTime;
      const end = now + definition.durationMs / 1000;
      oscillator.type = definition.type;
      oscillator.frequency.setValueAtTime(definition.frequency, now);
      if (definition.frequencyEnd) oscillator.frequency.exponentialRampToValueAtTime(definition.frequencyEnd, end);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(definition.gain * this.getSpatialGain(spatial), now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(gain);
      const spatialNodes = this.connectSpatial(gain, spatial, now);
      oscillator.start(now);
      oscillator.stop(end + 0.02);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
        spatialNodes.cleanup();
      };
      if (definition.noise) this.playNoiseWhoosh(now, end, definition.gain * 0.9);
    } catch {
      // Audio feedback is decorative and should never break gameplay.
    }
  }

  private playCueAccent(cue: GameAudioCue, spatial: SpatialAudioOptions) {
    if (cue === "quiz_correct") {
      this.playTone({ frequency: 560, durationMs: 100, gain: 0.026, type: "triangle", frequencyEnd: 820 }, spatial);
      if (typeof window !== "undefined") window.setTimeout(() => this.playTone({ frequency: 820, durationMs: 120, gain: 0.02, type: "sine", frequencyEnd: 1100 }, spatial), 74);
    } else if (cue === "quiz_wrong") {
      this.playTone({ frequency: 230, durationMs: 150, gain: 0.025, type: "triangle", frequencyEnd: 150 }, spatial);
    } else if (cue === "hit_confirm") {
      this.playTone({ frequency: 860, durationMs: 90, gain: 0.02, type: "triangle", frequencyEnd: 1120 }, spatial);
    } else if (cue === "player_tagged") {
      this.playTone({ frequency: 230, durationMs: 140, gain: 0.024, type: "triangle", frequencyEnd: 150 }, spatial);
    } else if (cue === "buy") {
      this.playTone({ frequency: 620, durationMs: 80, gain: 0.018, type: "triangle", frequencyEnd: 860 }, spatial);
    }
  }

  private getSpatialGain({ distance = 0, intensity = 1 }: SpatialAudioOptions) {
    const distanceGain = Math.max(0.38, 1 - Math.min(340, Math.max(0, distance)) / 340 * 0.62);
    return Math.max(0, Math.min(1.5, intensity)) * distanceGain;
  }

  private connectSpatial(input: AudioNode, spatial: SpatialAudioOptions, now: number) {
    if (!this.sfxGain || !this.audio) return { cleanup: () => undefined };
    let output = input;
    let filter: BiquadFilterNode | null = null;
    let panner: StereoPannerNode | null = null;
    if (spatial.distance !== undefined) {
      filter = this.audio.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(Math.max(1800, 7200 - Math.min(5400, Math.max(0, spatial.distance) * 16)), now);
      filter.Q.setValueAtTime(0.35, now);
      output.connect(filter);
      output = filter;
    }
    if (spatial.pan !== undefined && Math.abs(spatial.pan) > 0.01) {
      panner = this.audio.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, spatial.pan)), now);
      output.connect(panner);
      output = panner;
    }
    output.connect(this.sfxGain);
    return {
      cleanup: () => {
        filter?.disconnect();
        panner?.disconnect();
      }
    };
  }

  private playNoiseWhoosh(start: number, end: number, peakGain: number) {
    if (!this.audio || !this.sfxGain) return;
    if (!this.noiseBuffer) {
      this.noiseBuffer = this.audio.createBuffer(1, 4096, this.audio.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let index = 0; index < data.length; index += 1) {
        data[index] = Math.random() * 2 - 1;
      }
    }
    const source = this.audio.createBufferSource();
    const filter = this.audio.createBiquadFilter();
    const gain = this.audio.createGain();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(520, start);
    filter.frequency.exponentialRampToValueAtTime(120, end);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peakGain, start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
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
      this.playMusicTone(note);
      this.bgmTimer = window.setTimeout(() => {
        this.bgmTimer = null;
        playNext();
      }, note.durationMs + 110);
    };
    playNext();
  }

  private playMusicTone(definition: ToneDefinition) {
    try {
      const audio = this.ensureAudio();
      if (!audio || !this.musicGain) return;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const now = audio.currentTime;
      const end = now + definition.durationMs / 1000;
      oscillator.type = definition.type;
      oscillator.frequency.setValueAtTime(definition.frequency, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(definition.gain, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(gain);
      gain.connect(this.musicGain);
      oscillator.start(now);
      oscillator.stop(end + 0.02);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    } catch {
      // Music is optional.
    }
  }

  private clearBgmTimer() {
    if (this.bgmTimer === null || typeof window === "undefined") return;
    window.clearTimeout(this.bgmTimer);
    this.bgmTimer = null;
  }
}

export const gameAudio = new GameAudioController();
