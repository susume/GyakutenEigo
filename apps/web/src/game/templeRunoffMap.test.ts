import assert from "node:assert/strict";
import test from "node:test";
import {
  ARENA_PLAYER_BODY_HEIGHT,
  ARENA_SCALE,
  TEMPLE_RUNOFF_MAIN_LEVEL_Y,
  TEMPLE_RUNOFF_STAIR_FLIGHTS,
  TEMPLE_RUNOFF_TEAM_SPAWNS,
  TEMPLE_RUNOFF_UPPER_LEVEL_Y,
  getArenaFloorSurfaces,
  getArenaObstacles,
  hasLineOfSight
} from "@quizstrike/shared";
import { ARENA_MAPS } from "./arenaMaps";
import { blocks, cylinders, floorMarks, props, signs } from "./templeRunoffMap";

test("Temple Runoff is a substantially larger three-level arena", () => {
  const map = ARENA_MAPS.find((candidate) => candidate.id === "temple_runoff");
  assert.ok(map);
  assert.equal(map.title, "Temple Runoff");
  assert.deepEqual(map.footprint, { width: 470 * ARENA_SCALE, depth: 400 * ARENA_SCALE });
  assert.equal(floorMarks.length, 0);
  assert.equal(signs.length, 0);
  assert.ok(blocks.every((block) => block.label === undefined));
  assert.ok(cylinders.every((cylinder) => cylinder.label === undefined));
  assert.ok(map.routes.length >= 6);
  assert.ok(props.length <= 10, "new space must not be filled with discretionary props");
  assert.equal(props.some((prop) => prop.id === "blue-standard"), false);
  assert.ok(props.some((prop) => prop.id === "red-standard"));
});

test("Temple Runoff replaces every playable incline with authored stone stairs", () => {
  const stairBlocks = blocks.filter((block) => block.style === "stair");
  assert.equal(
    stairBlocks.length,
    TEMPLE_RUNOFF_STAIR_FLIGHTS.reduce((total, flight) => total + flight.steps, 0)
  );
  assert.ok(blocks.every((block) => !block.id.includes("ramp")));
  assert.ok(blocks.every((block) => block.rotationX === undefined && block.rotationZ === undefined));
  for (const flight of TEMPLE_RUNOFF_STAIR_FLIGHTS) {
    assert.ok(stairBlocks.some((block) => block.id === `${flight.id}-step-1`));
    assert.ok(stairBlocks.some((block) => block.id === `${flight.id}-step-${flight.steps}`));
    assert.ok((flight.endY - flight.startY) / flight.steps <= 0.75);
  }
});

test("spawn exits, river, and upper bridge have structural sightline breaks", () => {
  const collidingIds = new Set(blocks.filter((block) => block.collides).map((block) => block.id));
  const spawnScreens = [...collidingIds].filter((id) => id.endsWith("-spawn-screen"));
  const lowerCover = [...collidingIds].filter((id) => id.startsWith("lower-"));
  const bridgeAltars = [...collidingIds].filter((id) => id.startsWith("sun-bridge-altar-"));

  assert.equal(spawnScreens.length, 8, "each 5-player spawn row needs a protected exit");
  assert.ok(lowerCover.length >= 7, "the river needs staggered cover across its full length");
  assert.deepEqual(bridgeAltars.sort(), ["sun-bridge-altar-north", "sun-bridge-altar-south"]);
  const obstacles = getArenaObstacles("temple_runoff");
  TEMPLE_RUNOFF_TEAM_SPAWNS.blue.forEach((spawn, index) => {
    assert.equal(
      hasLineOfSight({
        from: spawn,
        to: TEMPLE_RUNOFF_TEAM_SPAWNS.red[index],
        obstacles
      }),
      false,
      `${spawn.label} must not see the opposing spawn row`
    );
  });
  for (const id of bridgeAltars) {
    const altar = blocks.find((block) => block.id === id);
    assert.ok(altar);
    assert.equal((altar.y ?? 0) - altar.h / 2, TEMPLE_RUNOFF_UPPER_LEVEL_Y);
  }
});

test("Temple Runoff visual collision definitions mirror authoritative 3D proxies", () => {
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
    assert.equal(obstacle.minY, (block.y ?? block.h / 2) - block.h / 2);
    assert.equal(obstacle.maxY, (block.y ?? block.h / 2) + block.h / 2);
  }
  for (const cylinder of visualCircles) {
    const obstacle = authoritative.find((candidate) => candidate.id === cylinder.id);
    assert.ok(obstacle && obstacle.kind === "circle", `${cylinder.id} needs an authoritative circle`);
    assert.deepEqual(
      { x: obstacle.x, z: obstacle.z, radius: obstacle.radius },
      { x: cylinder.x, z: cylinder.z, radius: cylinder.radius }
    );
    assert.equal(obstacle.minY, (cylinder.y ?? cylinder.h / 2) - cylinder.h / 2);
    assert.equal(obstacle.maxY, (cylinder.y ?? cylinder.h / 2) + cylinder.h / 2);
  }
});

test("the canal remains playable under the raised central bridge", () => {
  const water = blocks.find((block) => block.id === "ceremonial-canal-water");
  const bridge = blocks.find((block) => block.id === "sun-bridge-deck");
  const northFloor = blocks.find((block) => block.id === "temple-main-north-floor");
  const southFloor = blocks.find((block) => block.id === "temple-main-south-floor");

  assert.ok(water && bridge && northFloor && southFloor);
  assert.ok((water.y ?? 0) < 0.1);
  assert.equal((northFloor.y ?? 0) + northFloor.h / 2, TEMPLE_RUNOFF_MAIN_LEVEL_Y);
  assert.equal((southFloor.y ?? 0) + southFloor.h / 2, TEMPLE_RUNOFF_MAIN_LEVEL_Y);
  assert.equal((bridge.y ?? 0) + bridge.h / 2, TEMPLE_RUNOFF_UPPER_LEVEL_Y);
  assert.deepEqual(getArenaFloorSurfaces("temple_runoff", 0, 0), [0, TEMPLE_RUNOFF_UPPER_LEVEL_Y]);
  assert.ok(TEMPLE_RUNOFF_UPPER_LEVEL_Y / ARENA_PLAYER_BODY_HEIGHT > 3.2);
});
