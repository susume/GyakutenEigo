import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CHARACTER_CUSTOMIZATION_SETTINGS,
  DEFAULT_PLAYER_APPEARANCE,
  SCHOOL_APPEARANCE_PRESETS,
  getPlayerAppearanceError,
  isApprovedAppearancePreset,
  sanitizeCharacterCustomizationSettings,
  sanitizePlayerAppearance
} from "./index.js";

test("appearance sanitizer produces a complete safe default", () => {
  assert.deepEqual(sanitizePlayerAppearance(undefined), DEFAULT_PLAYER_APPEARANCE);
  assert.equal(sanitizePlayerAppearance({ clothingPrimaryColor: "#ffffff" as never }).clothingPrimaryColor, DEFAULT_PLAYER_APPEARANCE.clothingPrimaryColor);
  assert.equal(sanitizePlayerAppearance({ decalAssetId: "https://example.com/student.jpg" }).decalAssetId, undefined);
});

test("appearance validation rejects arbitrary URLs, fields, colours, and versions", () => {
  assert.match(getPlayerAppearanceError({ ...DEFAULT_PLAYER_APPEARANCE, decalAssetId: "https://example.com/a.png" }) ?? "", /decal/i);
  assert.match(getPlayerAppearanceError({ ...DEFAULT_PLAYER_APPEARANCE, textureUrl: "https://example.com/a.png" }) ?? "", /unsupported/i);
  assert.match(getPlayerAppearanceError({ ...DEFAULT_PLAYER_APPEARANCE, helmetColor: "#000000" }) ?? "", /colour/i);
  assert.match(getPlayerAppearanceError({ ...DEFAULT_PLAYER_APPEARANCE, appearanceVersion: 99 }) ?? "", /version/i);
});

test("approved presets and customization policy remain deterministic", () => {
  assert.equal(isApprovedAppearancePreset({ ...SCHOOL_APPEARANCE_PRESETS[1].appearance }), true);
  assert.equal(isApprovedAppearancePreset({ ...DEFAULT_PLAYER_APPEARANCE, helmetStyle: "ridge" }), false);
  assert.deepEqual(sanitizeCharacterCustomizationSettings(undefined), DEFAULT_CHARACTER_CUSTOMIZATION_SETTINGS);
  assert.equal(sanitizeCharacterCustomizationSettings({ uploadsEnabled: true }).uploadsEnabled, true);
});
