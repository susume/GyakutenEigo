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
  assert.notEqual(alpha.silhouette.helmet, bravo.silhouette.helmet);
  assert.notEqual(alpha.silhouette.vest, bravo.silhouette.vest);
  assert.notEqual(alpha.silhouette.backpack, bravo.silhouette.backpack);
});

test("serializeCharacterAppearance returns compact multiplayer-safe appearance state", () => {
  assert.deepEqual(
    serializeCharacterAppearance({ team: "blue", playerId: "learner-7", gear: "power_blaster" }),
    {
      team: "blue",
      variant: "heavy",
      helmet: "visor",
      vest: "plate_carrier",
      backpack: "radio_pack",
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
