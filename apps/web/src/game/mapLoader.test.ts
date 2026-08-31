import assert from "node:assert/strict";
import test from "node:test";
import { loadArenaMapContext } from "./mapLoader.js";

test("Athletics resolves its own scene context instead of Desert Citadel", () => {
  const context = loadArenaMapContext("athletics_park");

  assert.equal(context.arenaMap.id, "athletics_park");
  assert.equal(context.arenaMap.title, "Skyline Adventure Park");
  assert.equal(context.arenaMap.palette.sky, "#9edcff");
  assert.equal(context.isDesertCitadel, false);
});
