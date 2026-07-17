import test from "node:test";
import assert from "node:assert/strict";
import {
  BGM_PATTERN,
  GAME_AUDIO_EVENT_CUES,
  GAME_AUDIO_ASSETS,
  GAME_AUDIO_CUES,
  getCombatAudioSpatial,
  getMovementStepIntervalMs,
  type GameAudioCue
} from "./GameAudio.js";

test("game audio defines cues for core movement and action feedback", () => {
  const requiredCues: GameAudioCue[] = [
    "walk_step",
    "run_step",
    "crouch_step",
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

test("combat audio spatialization follows attacker direction and range", () => {
  const right = getCombatAudioSpatial({
    attacker: { x: 10, z: 0 },
    target: { x: 0, z: 0, facing: 0 }
  });
  const farFront = getCombatAudioSpatial({
    attacker: { x: 0, z: 100 },
    target: { x: 0, z: 0, facing: 0 }
  });

  assert.ok((right.pan ?? 0) > 0.9, "an attacker on the right should pan right");
  assert.equal(farFront.pan, 0, "a front hit should remain centered");
  assert.equal(farFront.distance, 100);
});

test("semantic event inventory covers weapons, objectives, quiz, flow, and UI", () => {
  const required = [
    "weapon_fire_basic",
    "weapon_fire_quick",
    "weapon_fire_heavy_local",
    "weapon_fire_heavy_remote",
    "world_impact",
    "shield_impact",
    "cooldown_ready",
    "weapon_equip",
    "weapon_switch",
    "flag_pickup",
    "flag_drop",
    "flag_planted",
    "flag_capture",
    "quiz_open",
    "quiz_timer_warning",
    "answer_reveal",
    "player_join",
    "player_leave",
    "round_countdown",
    "round_start",
    "match_victory",
    "match_defeat",
    "ui_confirm",
    "ui_cancel",
    "room_joined",
    "room_join_failed",
    "settings_saved"
  ] as const;
  for (const cue of required) {
    assert.ok(GAME_AUDIO_EVENT_CUES[cue], `${cue} should be represented in the semantic sound inventory`);
  }
});

test("movement surface palette includes distinct material groups", () => {
  for (const surface of ["surface_wood", "surface_stone", "surface_sand", "surface_metal", "surface_water"] as const) {
    const definition = GAME_AUDIO_ASSETS[surface];
    assert.ok(definition, `${surface} should have a surface sample definition`);
    assert.ok(definition.files.length >= 2);
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
  assert.ok(BGM_PATTERN.every((note) => note.frequency <= 180), "the arena bed should stay low and unobtrusive");
});

test("core feedback cues use the bundled CC0 sample palette", () => {
  const sampleCues: GameAudioCue[] = [
    "walk_step",
    "run_step",
    "crouch_step",
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

  for (const cue of sampleCues) {
    const definition = GAME_AUDIO_ASSETS[cue];
    assert.ok(definition, `${cue} should have a bundled sample definition`);
    assert.ok(definition.files.length > 0, `${cue} should have at least one sample variation`);
    assert.ok(definition.gain > 0 && definition.gain <= 1, `${cue} should have a safe mix gain`);
  }
});
