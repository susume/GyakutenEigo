import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_GAME_PREFERENCES,
  normalizeGamePreferences,
  resolveArenaQuality
} from "./gamePreferences";

test("auto quality starts from a measured middle setting", () => {
  assert.equal(resolveArenaQuality("auto", 2), "balanced");
  assert.equal(resolveArenaQuality("auto", 1), "balanced");
});

test("explicit quality preference is preserved", () => {
  assert.equal(resolveArenaQuality("performance", 3), "performance");
  assert.equal(resolveArenaQuality("high", 1), "high");
});

test("audio preferences preserve separate SFX and BGM levels", () => {
  const preferences = normalizeGamePreferences({ sfxVolume: 0.42, musicVolume: 0.27 });
  assert.equal(preferences.sfxVolume, 0.42);
  assert.equal(preferences.musicVolume, 0.27);
});

test("audio preferences migrate older saved settings and clamp unsafe levels", () => {
  assert.equal(normalizeGamePreferences({ musicVolume: 2 }).musicVolume, 1);
  assert.equal(normalizeGamePreferences({ sfxVolume: -0.5 }).sfxVolume, 0);
  assert.equal(normalizeGamePreferences({ musicVolume: Number.NaN }).musicVolume, DEFAULT_GAME_PREFERENCES.musicVolume);
  assert.equal(normalizeGamePreferences({}).sfxVolume, DEFAULT_GAME_PREFERENCES.sfxVolume);
});

test("modernized controls migrate saved preferences and clamp look sensitivity", () => {
  const migrated = normalizeGamePreferences({ arenaQuality: "performance" });
  assert.equal(migrated.contextualHud, true);
  assert.equal(migrated.lookSensitivity, 1);
  assert.equal(normalizeGamePreferences({ contextualHud: false }).contextualHud, false);
  assert.equal(normalizeGamePreferences({ lookSensitivity: 10 }).lookSensitivity, 2.5);
  assert.equal(normalizeGamePreferences({ lookSensitivity: -1 }).lookSensitivity, .2);
  assert.equal(normalizeGamePreferences({ lookSensitivity: Number.NaN }).lookSensitivity, 1);
});
