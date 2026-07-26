import assert from "node:assert/strict";
import test from "node:test";
import {
  ARENA_SCALE,
  DESERT_CITADEL_CITADEL_LEVEL_Y,
  DESERT_CITADEL_ROOFTOP_LEVEL_Y,
  getArenaFloorSurfaces,
  getArenaGroundHeightForPlayer,
  ARENA_PLAYER_EYE_HEIGHT
} from "@quizstrike/shared";
import { blocks } from "./desertCitadelMap.js";

test("Desert Citadel house roofs are raised above the original blockout height", () => {
  const houses = blocks.filter((block) => block.style === "house");
  assert.ok(houses.length >= 8);
  assert.ok(houses.every((block) => block.h > 8 * ARENA_SCALE));
});

test("Desert Citadel exposes rooftop and cistern-crown floors with safe ramps", () => {
  assert.deepEqual(getArenaFloorSurfaces("desert_citadel", -55 * ARENA_SCALE, 66 * ARENA_SCALE), [0, DESERT_CITADEL_ROOFTOP_LEVEL_Y]);
  assert.deepEqual(getArenaFloorSurfaces("desert_citadel", 0, 78 * ARENA_SCALE), [0, DESERT_CITADEL_CITADEL_LEVEL_Y]);
  assert.equal(getArenaGroundHeightForPlayer("desert_citadel", -55 * ARENA_SCALE, 66 * ARENA_SCALE, ARENA_PLAYER_EYE_HEIGHT), 0);
  assert.equal(
    getArenaGroundHeightForPlayer(
      "desert_citadel",
      -55 * ARENA_SCALE,
      66 * ARENA_SCALE,
      DESERT_CITADEL_ROOFTOP_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT
    ),
    DESERT_CITADEL_ROOFTOP_LEVEL_Y
  );
});
