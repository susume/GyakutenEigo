import assert from "node:assert/strict";
import test from "node:test";
import { ARENA_SCALE } from "@quizstrike/shared";
import { blocks } from "./desertCitadelMap.js";

test("Desert Citadel house roofs are raised above the original blockout height", () => {
  const houses = blocks.filter((block) => block.style === "house");
  assert.ok(houses.length >= 8);
  assert.ok(houses.every((block) => block.h > 8 * ARENA_SCALE));
});
