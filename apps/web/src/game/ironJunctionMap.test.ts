import assert from "node:assert/strict";
import test from "node:test";
import {
  ARENA_PLAYER_EYE_HEIGHT,
  ARENA_SCALE,
  IRON_JUNCTION_CATWALK_LEVEL_Y,
  IRON_JUNCTION_HIGHLINE_LEVEL_Y,
  getArenaFloorSurfaces,
  getArenaGroundHeightForPlayer
} from "@quizstrike/shared";
import { blocks } from "./ironJunctionMap.js";

test("Iron Junction exposes a raised Highline and Signal Catwalk over the yard", () => {
  assert.ok(blocks.some((block) => block.id === "iron-highline-deck"));
  assert.ok(blocks.some((block) => block.id === "iron-signal-catwalk"));
  assert.deepEqual(getArenaFloorSurfaces("iron_junction", 0, 75 * ARENA_SCALE), [0, IRON_JUNCTION_HIGHLINE_LEVEL_Y]);
  assert.deepEqual(getArenaFloorSurfaces("iron_junction", 0, -43 * ARENA_SCALE), [0, IRON_JUNCTION_CATWALK_LEVEL_Y]);
  assert.equal(getArenaGroundHeightForPlayer("iron_junction", 0, 75 * ARENA_SCALE, ARENA_PLAYER_EYE_HEIGHT), 0);
  assert.equal(
    getArenaGroundHeightForPlayer(
      "iron_junction",
      0,
      75 * ARENA_SCALE,
      IRON_JUNCTION_HIGHLINE_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT
    ),
    IRON_JUNCTION_HIGHLINE_LEVEL_Y
  );
});
