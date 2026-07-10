import test from "node:test";
import assert from "node:assert/strict";
import {
  BGM_PATTERN,
  GAME_AUDIO_CUES,
  getMovementStepIntervalMs,
  type GameAudioCue
} from "./GameAudio.js";

test("game audio defines cues for core movement and action feedback", () => {
  const requiredCues: GameAudioCue[] = [
    "walk_step",
    "run_step",
    "crouch_step",
    "jump",
    "land",
    "fire",
    "heavy_fire",
    "empty_fire",
    "hit_confirm",
    "player_tagged",
    "eliminated",
    "buy",
    "menu_toggle",
    "quiz_correct",
    "quiz_wrong",
    "zoom_in",
    "zoom_out"
  ];

  for (const cue of requiredCues) {
    assert.ok(GAME_AUDIO_CUES[cue], `${cue} should have an audio definition`);
    assert.ok(GAME_AUDIO_CUES[cue].frequency > 0, `${cue} should have a playable frequency`);
    assert.ok(GAME_AUDIO_CUES[cue].durationMs > 0, `${cue} should have a duration`);
  }
});

test("movement footsteps get faster as player movement becomes louder", () => {
  assert.ok(getMovementStepIntervalMs("run") < getMovementStepIntervalMs("walk"));
  assert.ok(getMovementStepIntervalMs("walk") < getMovementStepIntervalMs("crouch"));
});

test("snowball fire cue is a deep whoosh instead of a sharp beep", () => {
  assert.ok(GAME_AUDIO_CUES.fire.frequency <= 170);
  assert.ok(GAME_AUDIO_CUES.fire.frequencyEnd && GAME_AUDIO_CUES.fire.frequencyEnd < GAME_AUDIO_CUES.fire.frequency);
  assert.ok(GAME_AUDIO_CUES.fire.durationMs >= 220);
  assert.equal(GAME_AUDIO_CUES.fire.noise, true);
});

test("background music pattern is a quiet looping phrase", () => {
  assert.ok(BGM_PATTERN.length >= 8);
  assert.ok(BGM_PATTERN.every((note) => note.frequency > 0 && note.durationMs > 0 && note.gain <= 0.04));
});
