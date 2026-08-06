import assert from "node:assert/strict";
import test from "node:test";
import {
  ARENA_PLAYER_EYE_HEIGHT,
  ARENA_SCALE,
  DESERT_CITADEL_MAIN_LEVEL_Y,
  DESERT_CITADEL_ROOFTOP_LEVEL_Y,
  DESERT_CITADEL_STAIR_FLIGHTS,
  findBotNavigationPath,
  getArenaBounds,
  getArenaFloorSurfaces,
  getArenaGroundHeightForPlayer,
  getArenaLevelLabel,
  getArenaObstacles,
  getTeamSpawnsForMap,
  hasLineOfSight,
  resolveAuthoritativeMovement
} from "@quizstrike/shared";
import { DESERT_CITADEL, DESERT_CITADEL_PHASE3_MANIFEST, blocks, cylinders, floorMarks, props, signs } from "./desertCitadelMap.js";

const MAP_ID = "desert_citadel" as const;
const raw = (x: number, z: number, y = 0) => ({
  x: x * ARENA_SCALE,
  y: y + ARENA_PLAYER_EYE_HEIGHT,
  z: z * ARENA_SCALE
});
const pathLength = (
  start: { x: number; y?: number; z: number },
  path: Array<{ x: number; y?: number; z: number }>
) => {
  let previous = start;
  let distance = 0;
  for (const point of path) {
    distance += Math.hypot(
      point.x - previous.x,
      point.z - previous.z,
      Number(point.y ?? previous.y ?? 0) - Number(previous.y ?? point.y ?? 0)
    );
    previous = point;
  }
  return distance;
};

test("Desert Citadel is a deliberately authored three-lane 40-player arena", () => {
  assert.deepEqual(DESERT_CITADEL.footprint, { width: 500 * ARENA_SCALE, depth: 360 * ARENA_SCALE });
  assert.ok(blocks.length >= 150, "architecture and stair risers should define the city before decoration");
  assert.ok(props.length <= 12, "small decoration must remain deliberately sparse");
  assert.equal(props.filter((prop) => prop.kind === "arch").length, 0, "decorative arches must not obstruct route reads");
  assert.ok(props.some((prop) => prop.id === "blue-base-banner") && props.some((prop) => prop.id === "red-base-banner"), "team orientation must survive the simplification");
  const rawProps = props.map((prop) => ({ ...prop, x: prop.x / ARENA_SCALE, z: prop.z / ARENA_SCALE }));
  assert.equal(
    rawProps.some((prop) => Math.abs(prop.z) <= 15 && (prop.x >= -110 && prop.x <= -62 || prop.x >= 62 && prop.x <= 110)),
    false,
    "both team stair mouths must remain visually clear"
  );
  const removedClutterIds = [
    "blue-objective-pavilion",
    "red-objective-pavilion",
    "blue-base-screen-north",
    "blue-base-screen-south",
    "red-base-screen-north",
    "red-base-screen-south",
    "blue-base-spawn-cover-north",
    "blue-base-spawn-cover-south",
    "red-base-spawn-cover-north",
    "red-base-spawn-cover-south",
    "court-broken-wall-west",
    "court-broken-wall-east",
    "court-planter",
    "west-market-roof-screen",
    "east-market-roof-screen",
    "ruins-foundation-west",
    "ruins-foundation-east",
    "ruins-arch-center-west",
    "ruins-arch-center-east",
    "caravan-yard-cover-south-west",
    "caravan-yard-cover-south-center",
    "caravan-yard-cover-south-east"
  ];
  assert.equal(removedClutterIds.some((id) => blocks.some((block) => block.id === id)), false, "non-purpose walls must stay out of the player routes");
  assert.ok(props.filter((prop) => prop.kind === "crate").length <= 1);
  assert.ok(cylinders.length <= 10);
  assert.deepEqual(floorMarks, [], "printed floor directions add visual noise");
  assert.deepEqual(signs, [], "architecture should replace floating map labels");
  assert.equal(DESERT_CITADEL.routes.filter((route) => route.includes("Lane")).length, 3);
  assert.equal(DESERT_CITADEL_STAIR_FLIGHTS.length, 6);
  assert.ok(DESERT_CITADEL_STAIR_FLIGHTS.every((flight) => (flight.endY - flight.startY) / flight.steps <= 0.75));
  assert.equal(blocks.some((block) => block.id.startsWith("canal-")), false, "the lower route should not render a river");
  assert.equal(cylinders.some((cylinder) => cylinder.id.startsWith("canal-")), false, "the lower route should not render river pools");
  assert.ok(blocks.some((block) => block.id === "caravan-yard-cover-north-center"), "the dry lower route still needs readable cover");
});

test("Desert Citadel geometry sanity has complete manifest traceability and clean joins", () => {
  const expectedStructureIds = new Set(DESERT_CITADEL_PHASE3_MANIFEST.structureBlockIds);
  const expectedStairIds = new Set(
    DESERT_CITADEL_PHASE3_MANIFEST.stairFlightIds.flatMap((flightId) =>
      DESERT_CITADEL_STAIR_FLIGHTS.find((flight) => flight.id === flightId)
        ? blocks.filter((block) => block.id.startsWith(`${flightId}-step-`)).map((block) => block.id)
        : []
    )
  );
  const expectedBlockIds = new Set([...expectedStructureIds, ...expectedStairIds]);
  assert.equal(blocks.length, expectedBlockIds.size, "every visible block must be in the Phase 3 manifest");
  assert.deepEqual(
    blocks.map((block) => block.id).filter((id) => !expectedBlockIds.has(id)),
    [],
    "no unplanned block may enter the map"
  );
  for (const id of expectedBlockIds) assert.ok(blocks.some((block) => block.id === id), `${id} is missing from the authored map`);
  assert.deepEqual([...new Set(props.map((prop) => prop.id))].sort(), [...DESERT_CITADEL_PHASE3_MANIFEST.propIds].sort());
  assert.deepEqual([...new Set(cylinders.map((cylinder) => cylinder.id))].sort(), [...DESERT_CITADEL_PHASE3_MANIFEST.cylinderIds].sort());

  const bounds = getArenaBounds(MAP_ID);
  for (const block of blocks) {
    assert.ok([block.x, block.z, block.w, block.d, block.h, block.y ?? 0].every(Number.isFinite), `${block.id} has non-finite geometry`);
    assert.ok(block.w > 0 && block.d > 0 && block.h > 0, `${block.id} has non-positive dimensions`);
    assert.ok(block.x - block.w / 2 >= -bounds.limitX - 1.3 && block.x + block.w / 2 <= bounds.limitX + 1.3, `${block.id} exceeds X bounds`);
    assert.ok(block.z - block.d / 2 >= -bounds.limitZ - 1.3 && block.z + block.d / 2 <= bounds.limitZ + 1.3, `${block.id} exceeds Z bounds`);
  }

  const colliders = blocks.filter((block) => block.collides);
  const yMin = (block: (typeof blocks)[number]) => (block.y ?? block.h / 2) - block.h / 2;
  const yMax = (block: (typeof blocks)[number]) => (block.y ?? block.h / 2) + block.h / 2;
  for (let first = 0; first < colliders.length; first += 1) {
    for (let second = first + 1; second < colliders.length; second += 1) {
      const left = colliders[first];
      const right = colliders[second];
      const overlapX = Math.min(left.x + left.w / 2, right.x + right.w / 2) - Math.max(left.x - left.w / 2, right.x - right.w / 2);
      const overlapZ = Math.min(left.z + left.d / 2, right.z + right.d / 2) - Math.max(left.z - left.d / 2, right.z - right.d / 2);
      const overlapY = Math.min(yMax(left), yMax(right)) - Math.max(yMin(left), yMin(right));
      assert.ok(!(overlapX > 0.02 && overlapZ > 0.02 && overlapY > 0.02), `${left.id} overlaps ${right.id}`);
    }
  }

  const authoredElevatedObjects = blocks.filter((block) => (block.y ?? 0) > 0 && block.style !== "stair");
  assert.deepEqual(
    authoredElevatedObjects.map((block) => block.id).sort(),
    [
      "citadel-skywalk", "citadel-skywalk-rail-north", "citadel-skywalk-rail-south", "court-floor", "court-foundation",
      "court-monument", "court-parapet-north-east", "court-parapet-north-west", "court-parapet-south-east",
      "court-parapet-south-west", "east-market-mass-north", "east-market-mass-south",
      "east-market-roof", "east-market-roof-rail-north", "east-market-roof-rail-south", "lion-gate-lintel",
      "ruins-obelisk-crown", "sun-gate-lintel", "west-market-mass-north", "west-market-mass-south", "west-market-roof",
      "west-market-roof-rail-north", "west-market-roof-rail-south"
    ].sort(),
    "elevated geometry must stay within the authored support manifest"
  );
});

test("Desert Citadel exposes lower, main, and upper surfaces without accidental stacked floors", () => {
  assert.deepEqual(getArenaFloorSurfaces(MAP_ID, -150 * ARENA_SCALE, -116 * ARENA_SCALE), [0]);
  assert.deepEqual(getArenaFloorSurfaces(MAP_ID, 0, 24 * ARENA_SCALE), [DESERT_CITADEL_MAIN_LEVEL_Y]);
  assert.deepEqual(getArenaFloorSurfaces(MAP_ID, -120 * ARENA_SCALE, 78 * ARENA_SCALE), [DESERT_CITADEL_ROOFTOP_LEVEL_Y]);
  assert.deepEqual(getArenaFloorSurfaces(MAP_ID, 120 * ARENA_SCALE, 78 * ARENA_SCALE), [DESERT_CITADEL_ROOFTOP_LEVEL_Y]);
  assert.deepEqual(getArenaFloorSurfaces(MAP_ID, 0, 78 * ARENA_SCALE), [DESERT_CITADEL_ROOFTOP_LEVEL_Y]);
  assert.equal(getArenaLevelLabel(MAP_ID, 0), "lower");
  assert.equal(getArenaLevelLabel(MAP_ID, DESERT_CITADEL_MAIN_LEVEL_Y), "main");
  assert.equal(getArenaLevelLabel(MAP_ID, DESERT_CITADEL_ROOFTOP_LEVEL_Y), "upper");
  assert.equal(getArenaGroundHeightForPlayer(MAP_ID, 0, 24 * ARENA_SCALE, ARENA_PLAYER_EYE_HEIGHT), 0);
  assert.equal(
    getArenaGroundHeightForPlayer(MAP_ID, -120 * ARENA_SCALE, 78 * ARENA_SCALE, ARENA_PLAYER_EYE_HEIGHT),
    0,
    "a lower player under a market roof must stay on the lower floor"
  );
  assert.equal(
    getArenaGroundHeightForPlayer(MAP_ID, 0, 78 * ARENA_SCALE, ARENA_PLAYER_EYE_HEIGHT),
    0,
    "a lower player under the Skywalk must not be lifted to the roof"
  );
  assert.equal(
    getArenaGroundHeightForPlayer(MAP_ID, 0, 24 * ARENA_SCALE, DESERT_CITADEL_MAIN_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT),
    DESERT_CITADEL_MAIN_LEVEL_Y
  );
});

test("every authored Desert Citadel stair flight climbs continuously on the shared floor resolver", () => {
  for (const flight of DESERT_CITADEL_STAIR_FLIGHTS) {
    let previous = flight.startY;
    for (let index = 0; index <= flight.steps; index += 1) {
      const progress = index / flight.steps;
      const centerAlong = flight.axis === "x" ? flight.x : flight.z;
      const along = flight.direction === 1
        ? centerAlong - flight.length / 2 + progress * flight.length
        : centerAlong + flight.length / 2 - progress * flight.length;
      const x = flight.axis === "x" ? along : flight.x;
      const z = flight.axis === "z" ? along : flight.z;
      const next = getArenaGroundHeightForPlayer(
        MAP_ID,
        x * ARENA_SCALE,
        z * ARENA_SCALE,
        previous + ARENA_PLAYER_EYE_HEIGHT,
        ARENA_PLAYER_EYE_HEIGHT,
        2.5
      );
      assert.ok(next >= previous - 0.001, `${flight.id} dropped at step ${index}`);
      previous = next;
    }
    assert.ok(Math.abs(previous - flight.endY) < 0.01, `${flight.id} did not reach its authored landing`);
  }
});

test("solid foundations reject invalid level shortcuts while base exits stay open", () => {
  const obstacles = getArenaObstacles(MAP_ID);
  const foundationStart = { ...raw(-76, 0), facing: 0 };
  const foundation = resolveAuthoritativeMovement({
    current: foundationStart,
    requested: { ...foundationStart, x: -64 * ARENA_SCALE },
    elapsedMs: 1000,
    maxSpeed: 20,
    obstacles,
    groundY: 0,
    mapId: MAP_ID
  });
  assert.equal(foundation.blocked, true);
  const baseExitStart = { ...raw(205, 0), facing: Math.PI / 2 };
  const baseExit = resolveAuthoritativeMovement({
    current: baseExitStart,
    requested: { ...baseExitStart, x: 188 * ARENA_SCALE },
    elapsedMs: 1000,
    maxSpeed: 20,
    obstacles,
    groundY: 0,
    mapId: MAP_ID
  });
  assert.notEqual(baseExit.blocked, true);
});

test("visual and authoritative Desert Citadel colliders share the same footprints", () => {
  const obstacles = new Map(getArenaObstacles(MAP_ID).map((obstacle) => [obstacle.id, obstacle]));
  for (const block of blocks.filter((candidate) => candidate.collides)) {
    assert.equal(block.rotationY ?? 0, 0, `${block.id} has a rotated client-only footprint`);
    const obstacle = obstacles.get(block.id);
    assert.ok(obstacle && obstacle.kind === "rect", `${block.id} is missing an authoritative rectangle`);
    if (!obstacle || obstacle.kind !== "rect") continue;
    assert.ok(Math.abs(obstacle.x - block.x) < 0.011, `${block.id} x mismatch`);
    assert.ok(Math.abs(obstacle.z - block.z) < 0.011, `${block.id} z mismatch`);
    assert.ok(Math.abs(obstacle.width - block.w) < 0.011, `${block.id} width mismatch`);
    assert.ok(Math.abs(obstacle.depth - block.d) < 0.011, `${block.id} depth mismatch`);
  }
  for (const cylinder of cylinders.filter((candidate) => candidate.collides)) {
    const obstacle = obstacles.get(cylinder.id);
    assert.ok(obstacle && obstacle.kind === "circle", `${cylinder.id} is missing an authoritative circle`);
    if (!obstacle || obstacle.kind !== "circle") continue;
    assert.ok(Math.abs(obstacle.x - cylinder.x) < 0.011, `${cylinder.id} x mismatch`);
    assert.ok(Math.abs(obstacle.z - cylinder.z) < 0.011, `${cylinder.id} z mismatch`);
    assert.ok(Math.abs(obstacle.radius - cylinder.radius) < 0.011, `${cylinder.id} radius mismatch`);
  }
});

test("Desert Citadel provides 20 clear spawns per team with protected first frames", () => {
  const spawns = getTeamSpawnsForMap(MAP_ID);
  const obstacles = getArenaObstacles(MAP_ID);
  assert.equal(spawns.blue.length, 20);
  assert.equal(spawns.red.length, 20);
  assert.equal(new Set(spawns.blue.map((spawn) => `${spawn.x}:${spawn.z}`)).size, 20);
  assert.equal(new Set(spawns.red.map((spawn) => `${spawn.x}:${spawn.z}`)).size, 20);
  for (const spawn of [...spawns.blue, ...spawns.red]) {
    assert.equal(spawn.y, ARENA_PLAYER_EYE_HEIGHT);
    const overlaps = obstacles.filter((obstacle) => {
      if ((obstacle.minY ?? -Infinity) > 0.1 || (obstacle.maxY ?? Infinity) < 0) return false;
      if (obstacle.kind === "circle") return Math.hypot(spawn.x - obstacle.x, spawn.z - obstacle.z) <= obstacle.radius + 0.45;
      return spawn.x >= obstacle.x - obstacle.width / 2 - 0.45
        && spawn.x <= obstacle.x + obstacle.width / 2 + 0.45
        && spawn.z >= obstacle.z - obstacle.depth / 2 - 0.45
        && spawn.z <= obstacle.z + obstacle.depth / 2 + 0.45;
    });
    assert.deepEqual(overlaps, [], `${spawn.id} overlaps collision`);
  }
  for (const blueSpawn of spawns.blue) {
    for (const redSpawn of spawns.red) {
      assert.equal(hasLineOfSight({ from: blueSpawn, to: redSpawn, obstacles, padding: 0 }), false, `${blueSpawn.id} can fire into ${redSpawn.id}`);
    }
  }
});

test("bots can reach all three lanes, both market approaches, and the shared roof route", () => {
  const obstacles = getArenaObstacles(MAP_ID);
  const start = getTeamSpawnsForMap(MAP_ID).blue[0];
  const goals = [
    ["north lane", raw(0, -118)],
    ["center fountain", raw(0, 18, DESERT_CITADEL_MAIN_LEVEL_Y)],
    ["south caravan yard", raw(0, 133)],
    ["west market approach", raw(-160, 78)],
    ["east market approach", raw(160, 78)],
    ["citadel skywalk", raw(0, 78, DESERT_CITADEL_ROOFTOP_LEVEL_Y)]
  ] as const;
  for (const [label, goal] of goals) {
    const path = findBotNavigationPath({ from: start, to: goal, obstacles, mapId: MAP_ID });
    assert.ok(path.length > 0, `${label} should have a navigation path`);
    assert.ok(Math.abs(Number(path.at(-1)?.y) - goal.y) < 0.1, `${label} should finish on the requested level`);
  }
  const roofCrossing = findBotNavigationPath({
    from: raw(-120, 78, DESERT_CITADEL_ROOFTOP_LEVEL_Y),
    to: raw(120, 78, DESERT_CITADEL_ROOFTOP_LEVEL_Y),
    obstacles,
    mapId: MAP_ID
  });
  assert.ok(roofCrossing.length > 0, "the upper route should rotate between mirrored roofs");
});

test("lane travel times are symmetric enough for 20v20 opening flow", () => {
  const obstacles = getArenaObstacles(MAP_ID);
  const spawns = getTeamSpawnsForMap(MAP_ID);
  const laneGoals = [raw(0, -118), raw(0, 18, DESERT_CITADEL_MAIN_LEVEL_Y), raw(0, 133)];
  const routeLengths = (team: "blue" | "red") => laneGoals.map((goal) => {
    const path = findBotNavigationPath({ from: spawns[team][0], to: goal, obstacles, mapId: MAP_ID });
    assert.ok(path.length > 0, `${team} could not enter a primary lane`);
    return pathLength(spawns[team][0], path);
  });
  const blue = routeLengths("blue");
  const red = routeLengths("red");
  blue.forEach((distance, index) => {
    const average = (distance + red[index]) / 2;
    assert.ok(Math.abs(distance - red[index]) / average < 0.15, `lane ${index} is too asymmetric`);
    assert.ok(distance / 14.8 > 7 && distance / 14.8 < 18, `blue lane ${index} is outside opening timing`);
    assert.ok(red[index] / 14.8 > 7 && red[index] / 14.8 < 18, `red lane ${index} is outside opening timing`);
  });
  const westApproach = raw(-160, 78);
  const eastApproach = raw(160, 78);
  const blueToEast = findBotNavigationPath({ from: spawns.blue[0], to: eastApproach, obstacles, mapId: MAP_ID });
  const redToWest = findBotNavigationPath({ from: spawns.red[0], to: westApproach, obstacles, mapId: MAP_ID });
  const mirroredAverage = (pathLength(spawns.blue[0], blueToEast) + pathLength(spawns.red[0], redToWest)) / 2;
  assert.ok(Math.abs(pathLength(spawns.blue[0], blueToEast) - pathLength(spawns.red[0], redToWest)) / mirroredAverage < 0.15);
});

test("opening roster can distribute 40 players across three primary lanes", () => {
  const obstacles = getArenaObstacles(MAP_ID);
  const spawns = getTeamSpawnsForMap(MAP_ID);
  const lanes = [raw(0, -118), raw(0, 18, DESERT_CITADEL_MAIN_LEVEL_Y), raw(0, 133)];
  const counts = [0, 0, 0];
  for (const team of ["blue", "red"] as const) {
    spawns[team].forEach((spawn, index) => {
      const lane = index % lanes.length;
      counts[lane] += 1;
      const path = findBotNavigationPath({ from: spawn, to: lanes[lane], obstacles, mapId: MAP_ID });
      assert.ok(path.length > 0, `${team} player ${index + 1} could not enter lane ${lane}`);
    });
  }
  assert.deepEqual(counts, [14, 14, 12]);
});
