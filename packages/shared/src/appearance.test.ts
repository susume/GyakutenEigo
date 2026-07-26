import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CHARACTER_CUSTOMIZATION_SETTINGS,
  DEFAULT_PLAYER_APPEARANCE,
  getCosmeticProgress,
  getLockedAppearanceItems,
  getPlayerAppearanceError,
  sanitizeCharacterCustomizationSettings,
  sanitizePlayerAppearance
} from "./index.js";

test("appearance sanitizer produces a complete safe default", () => {
  assert.deepEqual(sanitizePlayerAppearance(undefined), DEFAULT_PLAYER_APPEARANCE);
  assert.equal(sanitizePlayerAppearance({ clothingPrimaryColor: "#ffffff" }).appearanceVersion, 6);
  assert.equal(sanitizePlayerAppearance({ decalAssetId: "https://example.com/student.jpg" }).decalAssetId, undefined);
});

test("appearance validation rejects arbitrary URLs, legacy colours, fields, and versions", () => {
  assert.match(getPlayerAppearanceError({ ...DEFAULT_PLAYER_APPEARANCE, decalAssetId: "https://example.com/a.png" }) ?? "", /decal/i);
  assert.match(getPlayerAppearanceError({ ...DEFAULT_PLAYER_APPEARANCE, textureUrl: "https://example.com/a.png" }) ?? "", /unsupported/i);
  assert.match(getPlayerAppearanceError({ ...DEFAULT_PLAYER_APPEARANCE, clothingPrimaryColor: "#174a78" }) ?? "", /unsupported/i);
  assert.match(getPlayerAppearanceError({ ...DEFAULT_PLAYER_APPEARANCE, appearanceVersion: 99 }) ?? "", /version/i);
});

test("legacy accessory and retired Human profiles migrate to the Boy head", () => {
  assert.deepEqual(sanitizePlayerAppearance({
    characterPreset: "engineer",
    helmetStyle: "headset",
    backpackStyle: "radio_pack",
    clothingPrimaryColor: "#6b3f8c",
    appearanceVersion: 1
  }), {
    headStyleId: "boy_short_hair",
    backAccessoryId: "utility_pack",
    detailAccessoryId: "none",
    victoryPoseId: "champion",
    appearanceVersion: 6
  });
  assert.equal(sanitizePlayerAppearance({
    ...DEFAULT_PLAYER_APPEARANCE,
    headStyleId: undefined,
    headOption: "goggles",
    appearanceVersion: 3
  }).headStyleId, "boy_short_hair");
  assert.equal(sanitizePlayerAppearance({
    ...DEFAULT_PLAYER_APPEARANCE,
    headStyleId: "human" as never,
    appearanceVersion: 5
  }).headStyleId, "boy_short_hair");
});

test("retired preset policy sanitizes to mix-and-match customization", () => {
  assert.deepEqual(sanitizeCharacterCustomizationSettings(undefined), DEFAULT_CHARACTER_CUSTOMIZATION_SETTINGS);
  assert.equal(sanitizeCharacterCustomizationSettings({ uploadsEnabled: true }).uploadsEnabled, true);
  assert.equal("presetsOnly" in sanitizeCharacterCustomizationSettings({ presetsOnly: true }), false);
});

test("cosmetic progression unlocks catalogue levels without changing gameplay stats", () => {
  assert.deepEqual(
    getCosmeticProgress({ correctAnswers: 0, tags: 0, cosmeticXp: 0 }),
    {
      xp: 0,
      level: 1,
      levelName: "Rookie",
      levelStartXp: 0,
      nextLevelXp: 300,
      progressPercent: 0
    }
  );
  assert.equal(getCosmeticProgress({ correctAnswers: 0, tags: 0, cosmeticXp: 700 }).level, 3);
  const locked = getLockedAppearanceItems({
    ...DEFAULT_PLAYER_APPEARANCE,
    backAccessoryId: "boost_pack",
    detailAccessoryId: "champion_star",
    victoryPoseId: "power"
  }, 2);
  assert.deepEqual(locked.map((item) => item.id), ["champion_star", "power"]);
});
