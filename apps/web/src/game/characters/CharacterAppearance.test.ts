import test from "node:test";
import assert from "node:assert/strict";
import {
  CHARACTER_HITBOXES,
  CHARACTER_LOD_LEVELS,
  resolveCharacterAppearance,
  serializeCharacterAppearance
} from "./CharacterAppearance.js";

test("resolveCharacterAppearance gives both teams one uniform silhouette with distinct palettes", () => {
  const alpha = resolveCharacterAppearance({ team: "blue", playerId: "learner-1", gear: "starter_blaster" });
  const bravo = resolveCharacterAppearance({ team: "red", playerId: "learner-1", gear: "starter_blaster" });

  assert.equal(alpha.teamName, "Team Alpha");
  assert.equal(bravo.teamName, "Team Bravo");
  assert.notEqual(alpha.palette.uniform, bravo.palette.uniform);
  assert.deepEqual(alpha.silhouette, bravo.silhouette);
});

test("team palette remains authoritative when legacy colour fields are injected", () => {
  const injected = {
    characterPreset: "captain",
    headOption: "visor",
    accessoryId: "none",
    clothingPrimaryColor: "#00ff00",
    clothingSecondaryColor: "#ff00ff",
    appearanceVersion: 1
  };

  const alpha = resolveCharacterAppearance({
    team: "blue",
    playerId: "learner-7",
    appearance: injected as never
  });
  const bravo = resolveCharacterAppearance({
    team: "red",
    playerId: "learner-7",
    appearance: injected as never
  });

  assert.equal(alpha.palette.uniform, "#1671bd");
  assert.equal(alpha.palette.accent, "#49c8ff");
  assert.equal(bravo.palette.uniform, "#c93643");
  assert.equal(bravo.palette.accent, "#ff6a55");
});

test("serializeCharacterAppearance returns compact multiplayer-safe appearance state", () => {
  assert.deepEqual(
    serializeCharacterAppearance({ team: "blue", playerId: "learner-7", gear: "power_blaster" }),
    {
      team: "blue",
      variant: "heavy",
      headStyleId: "human",
      vest: "plate_carrier",
      backAccessoryId: "utility_pack",
      detailAccessoryId: "none",
      victoryPoseId: "champion",
      accent: "blue"
    }
  );
});

test("character support data keeps lightweight LOD and server-compatible hitboxes", () => {
  assert.deepEqual(
    CHARACTER_LOD_LEVELS.map((level) => level.name),
    ["LOD0", "LOD1", "LOD2", "LOD3"]
  );
  assert.equal(CHARACTER_LOD_LEVELS[0].maxDistance, 15);
  assert.equal(CHARACTER_LOD_LEVELS.at(-1)?.maxDistance, Infinity);
  assert.equal(CHARACTER_HITBOXES.head.damageMultiplier, 4);
  assert.equal(CHARACTER_HITBOXES.leftLeg.damageMultiplier, 0.75);
});
