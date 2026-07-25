import assert from "node:assert/strict";
import test from "node:test";
import { ARENA_SCALE, getArenaObstacles } from "@quizstrike/shared";
import { ARENA_MAPS } from "./arenaMaps";
import { blocks, cylinders, floorMarks } from "./templeRunoffMap";

const pointIsOpen = (x: number, z: number, padding = 0.55) =>
  !getArenaObstacles("temple_runoff").some((obstacle) => {
    if (obstacle.kind === "circle") {
      return Math.hypot(x - obstacle.x, z - obstacle.z) <= obstacle.radius + padding;
    }
    return Math.abs(x - obstacle.x) <= obstacle.width / 2 + padding
      && Math.abs(z - obstacle.z) <= obstacle.depth / 2 + padding;
  });

const routeCrossesArena = (rawZ: number, rawBandHalfDepth: number) => {
  const step = 2.5;
  const minX = -121 * ARENA_SCALE;
  const maxX = 121 * ARENA_SCALE;
  const minZ = (rawZ - rawBandHalfDepth) * ARENA_SCALE;
  const maxZ = (rawZ + rawBandHalfDepth) * ARENA_SCALE;
  const start = { x: minX, z: rawZ * ARENA_SCALE };
  const key = (x: number, z: number) => `${Math.round(x / step)}:${Math.round(z / step)}`;
  const queue = [start];
  const visited = new Set([key(start.x, start.z)]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.x >= maxX) return true;
    for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]] as const) {
      const next = { x: current.x + dx, z: current.z + dz };
      if (next.x < minX || next.x > maxX + step || next.z < minZ || next.z > maxZ || !pointIsOpen(next.x, next.z)) continue;
      const nextKey = key(next.x, next.z);
      if (visited.has(nextKey)) continue;
      visited.add(nextKey);
      queue.push(next);
    }
  }
  return false;
};

test("Temple Runoff is registered with four readable primary routes", () => {
  const map = ARENA_MAPS.find((candidate) => candidate.id === "temple_runoff");
  assert.ok(map);
  assert.equal(map.title, "Temple Runoff");
  assert.deepEqual(floorMarks.slice(0, 4).map((mark) => mark.label), [
    "SUN BRIDGE",
    "FLOODED CANAL",
    "RAIN COURT",
    "ROOTWAY"
  ]);
  assert.equal(routeCrossesArena(-112, 19), true, "Sun Bridge must cross the arena");
  assert.equal(routeCrossesArena(-43, 15), true, "Flooded Canal must cross the arena");
  assert.equal(routeCrossesArena(37, 24), true, "Rain Court must cross the arena");
  assert.equal(routeCrossesArena(112, 20), true, "Rootway must cross the arena");
});

test("Temple Runoff visual collision definitions mirror the shared authoritative proxies", () => {
  const visualRects = blocks.filter((block) => block.collides);
  const visualCircles = cylinders.filter((cylinder) => cylinder.collides);
  const authoritative = getArenaObstacles("temple_runoff");

  assert.equal(authoritative.length, visualRects.length + visualCircles.length);
  for (const block of visualRects) {
    const obstacle = authoritative.find((candidate) => candidate.id === block.id);
    assert.ok(obstacle && obstacle.kind === "rect", `${block.id} needs an authoritative rectangle`);
    assert.deepEqual(
      { x: obstacle.x, z: obstacle.z, width: obstacle.width, depth: obstacle.depth },
      { x: block.x, z: block.z, width: block.w, depth: block.d }
    );
  }
  for (const cylinder of visualCircles) {
    const obstacle = authoritative.find((candidate) => candidate.id === cylinder.id);
    assert.ok(obstacle && obstacle.kind === "circle", `${cylinder.id} needs an authoritative circle`);
    assert.deepEqual(
      { x: obstacle.x, z: obstacle.z, radius: obstacle.radius },
      { x: cylinder.x, z: cylinder.z, radius: cylinder.radius }
    );
  }
});

