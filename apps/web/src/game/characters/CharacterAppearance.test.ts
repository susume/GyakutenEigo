import test from "node:test";
import assert from "node:assert/strict";
import {
  CHARACTER_HITBOXES,
  CHARACTER_LOD_LEVELS,
  resolveCharacterAppearance,
  serializeCharacterAppearance
} from "./CharacterAppearance.js";

test("resolveCharacterAppearance gives Alpha and Bravo distinct sports identities", () => {
  const alpha = resolveCharacterAppearance({ team: "blue", playerId: "alpha-1", gear: "starter_blaster" });
  const bravo = resolveCharacterAppearance({ team: "red", playerId: "bravo-1", gear: "starter_blaster" });

  assert.equal(alpha.teamName, "Team Alpha");
  assert.equal(bravo.teamName, "Team Bravo");
  assert.notEqual(alpha.palette.uniform, bravo.palette.uniform);
  assert.notEqual(alpha.silhouette.vest, bravo.silhouette.vest);
  assert.notEqual(alpha.silhouette.widthScale, bravo.silhouette.widthScale);
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

  assert.equal(alpha.palette.uniform, "#174a78");
  assert.equal(alpha.palette.accent, "#31b6ff");
  assert.equal(bravo.palette.uniform, "#8d2f3f");
  assert.equal(bravo.palette.accent, "#ff6b46");
});

test("serializeCharacterAppearance returns compact multiplayer-safe appearance state", () => {
  assert.deepEqual(
    serializeCharacterAppearance({ team: "blue", playerId: "learner-7", gear: "power_blaster" }),
    {
      team: "blue",
      variant: "heavy",
      headOption: "visor",
      vest: "plate_carrier",
      accessoryId: "utility_pack",
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
