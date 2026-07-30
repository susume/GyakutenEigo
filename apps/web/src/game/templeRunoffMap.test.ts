import test from "node:test";
import assert from "node:assert/strict";
import { getArenaObstacles, getTeamSpawnsForMap } from "@quizstrike/shared";
import { blocks, cylinders, floorMarks, props, TEMPLE_RUNOFF } from "./templeRunoffMap";

test("Temple Runoff visible collision sources match authoritative proxies", () => {
  const authoritativeIds = new Set(getArenaObstacles("temple_runoff").map((obstacle) => obstacle.id));
  const visibleColliderIds = [
    ...blocks.filter((block) => block.collides).map((block) => block.id),
    ...cylinders.filter((cylinder) => cylinder.collides).map((cylinder) => cylinder.id)
  ];

  assert.deepEqual(visibleColliderIds.filter((id) => !authoritativeIds.has(id)), []);
  assert.deepEqual([...authoritativeIds].filter((id) => !visibleColliderIds.includes(id)), []);
});

test("Temple Runoff exposes a readable 20v20 content budget", () => {
  const spawns = getTeamSpawnsForMap("temple_runoff");

  assert.equal(TEMPLE_RUNOFF.id, "temple_runoff");
  assert.equal(TEMPLE_RUNOFF.routes.length, 6);
  assert.equal(TEMPLE_RUNOFF.districts.length, 8);
  assert.equal(spawns.blue.length, 24);
  assert.equal(spawns.red.length, 24);
  assert.equal(floorMarks.length, 5);
  assert.equal(blocks.length < 60, true);
  assert.equal(props.length <= 24, true);
});

