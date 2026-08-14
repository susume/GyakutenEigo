import assert from "node:assert/strict";
import test from "node:test";
import {
  ARENA_PLAYER_EYE_HEIGHT,
  ARENA_SCALE,
  DESERT_CITADEL_MAIN_LEVEL_Y,
  DESERT_CITADEL_ROOFTOP_LEVEL_Y,
  DESERT_CITADEL_STAIR_FLIGHTS,
  FREE_FOR_ALL_SPAWNS,
  findBotNavigationPath,
  getArenaBounds,
  getArenaFloorSurfaces,
  getArenaGroundHeightForPlayer,
  getArenaLevelLabel,
  getArenaObstacles,
  getCaptureZonesForMap,
  getSearchRetrieveItemsForMap,
  getTeamSpawnsForMap,
  hasLineOfSight,
  resolveAuthoritativeMovement
} from "@quizstrike/shared";
import { DESERT_CITADEL, DESERT_CITADEL_PHASE3_MANIFEST, blocks, cylinders, floorMarks, props, signs } from "./desertCitadelMap.js";
import {
  DESERT_CITADEL_IMPORTED_ASSETS,
  DESERT_CITADEL_PROP_SCALE,
  DESERT_CITADEL_STALL_SCALE
} from "./desertCitadelImportedAssets.js";

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

test("Split Crown is a purpose-built three-lane 40-player rebuild", () => {
  assert.deepEqual(DESERT_CITADEL.footprint, { width: 520 * ARENA_SCALE, depth: 400 * ARENA_SCALE });
  assert.ok(blocks.length >= 220, "authored architecture and exact stair risers should define the rebuilt fortress");
  assert.equal(DESERT_CITADEL.routes.filter((route) => route.includes("Lane")).length, 3);
  assert.equal(DESERT_CITADEL_STAIR_FLIGHTS.length, 10);
  assert.ok(DESERT_CITADEL_STAIR_FLIGHTS.every((flight) => (flight.endY - flight.startY) / flight.steps <= 0.75));
  assert.equal(floorMarks.length, 0);
  assert.equal(signs.length, 0);
  assert.ok(blocks.every((block) => block.label === undefined), "3D block labels must remain disabled");
  assert.ok(cylinders.every((cylinder) => cylinder.label === undefined), "3D cylinder labels must remain disabled");
  assert.equal(props.length, 0);
  assert.equal(props.some((prop) => prop.kind === "arch"), false);
  assert.equal(props.some((prop) => ["cart", "palm", "shade"].includes(prop.kind)), false);
  assert.equal(props.some((prop) => prop.id === "blue-bastion-banner"), false);
  assert.equal(props.some((prop) => prop.id === "crown-banner-west"), false);
  assert.equal(props.some((prop) => prop.id === "crown-banner-east"), false);
  assert.equal(props.some((prop) => prop.id === "red-bastion-banner"), false);
  assert.equal(blocks.some((block) => block.id === "blue-assembly-north-wall"), false);
  assert.equal(blocks.some((block) => block.id === "red-assembly-north-wall"), false);
  assert.equal(DESERT_CITADEL_IMPORTED_ASSETS.filter((asset) => asset.path.endsWith("covered-service-car.glb")).length, 1);
  assert.equal(DESERT_CITADEL_IMPORTED_ASSETS.filter((asset) => asset.path.endsWith("street-lamp.glb")).length, 4);
  const importedStalls = DESERT_CITADEL_IMPORTED_ASSETS.filter((asset) => asset.path.endsWith("bazaar-stall.glb"));
  assert.equal(importedStalls.length, 6);
  assert.equal(DESERT_CITADEL_PROP_SCALE, 3.25);
  assert.equal(DESERT_CITADEL_STALL_SCALE, 4);
  assert.deepEqual(importedStalls.map((stall) => stall.position[0]), [-140, -84, -28, 28, 84, 140]);
  assert.ok(importedStalls.every((stall) => stall.position[2] === -131));
  assert.ok(importedStalls.every((stall) => stall.scale === DESERT_CITADEL_STALL_SCALE && stall.rotationY === 0));
  assert.ok(
    blocks.filter((block) => block.id.startsWith("souk-stall-") || block.id === "cistern-service-car").every((block) => block.visual === false),
    "imported props must not render their geometric collision proxies"
  );
  assert.ok(
    blocks.filter((block) => block.id.startsWith("souk-stall-")).every((block) => block.collides === false),
    "decorative stalls must remain pass-through navigation space"
  );
  assert.equal(blocks.find((block) => block.id === "cistern-service-car")?.collides, true);
  const sundialCore = cylinders.find((cylinder) => cylinder.id === "royal-sundial-core");
  assert.ok(
    sundialCore && Math.abs(sundialCore.radius - 1.25 * ARENA_SCALE) < 0.011,
    "the sundial core must not become a sightline-blocking silo"
  );
  assert.deepEqual(
    ["court-floor", "citadel-skywalk", "west-market-roof", "east-market-roof"].filter((id) => blocks.some((block) => block.id === id)),
    [],
    "the retired Fountain Court and market-roof layout must not survive the rebuild"
  );
});

test("Desert Citadel stalls are walk-in spaces with counter-only collision and solid car cover", () => {
  const obstacles = getArenaObstacles("desert_citadel");
  assert.equal(obstacles.some((obstacle) => obstacle.id.startsWith("souk-stall-")), false);
  assert.equal(obstacles.filter((obstacle) => obstacle.id.startsWith("souk-table-")).length, 6);
  const tables = obstacles.filter((obstacle) => obstacle.id.startsWith("souk-table-") && obstacle.kind === "rect");
  assert.ok(tables.every((table) => Math.abs(table.width - 5.05 * DESERT_CITADEL_STALL_SCALE) < 0.3));
  assert.ok(tables.every((table) => Math.abs(table.depth - 1.05 * DESERT_CITADEL_STALL_SCALE) < 0.3));
  assert.ok(tables.every((table) => table.z === raw(0, -131).z && table.maxY === 3.64));

  const walkInStart = { ...raw(-158, -112), facing: 0 };
  const walkIn = resolveAuthoritativeMovement({
    current: walkInStart,
    requested: { ...walkInStart, z: -136 * ARENA_SCALE },
    elapsedMs: 1000,
    maxSpeed: 20,
    obstacles,
    groundY: 0,
    mapId: MAP_ID
  });
  assert.notEqual(walkIn.blocked, true, "players must be able to enter beside the central counter");

  const counterStart = { ...raw(-140, -116), facing: 0 };
  const counterHit = resolveAuthoritativeMovement({
    current: counterStart,
    requested: { ...counterStart, z: -130 * ARENA_SCALE },
    elapsedMs: 1000,
    maxSpeed: 20,
    obstacles,
    groundY: 0,
    mapId: MAP_ID
  });
  assert.equal(counterHit.blocked, true, "the central counter must stop the player");

  const counterEdgeStart = { ...raw(-155, -116), facing: 0 };
  const counterEdgeHit = resolveAuthoritativeMovement({
    current: counterEdgeStart,
    requested: { ...counterEdgeStart, z: -131 * ARENA_SCALE },
    elapsedMs: 1000,
    maxSpeed: 20,
    obstacles,
    groundY: 0,
    mapId: MAP_ID
  });
  assert.equal(counterEdgeHit.blocked, true, "the collider must cover the visible counter edge");

  const car = obstacles.find((obstacle) => obstacle.id === "cistern-service-car");
  assert.ok(car && car.kind === "rect");
  assert.equal(car.maxY, 4.61);
  assert.ok(car.width > car.depth, "the rotated car collider must follow its visible long axis");
});

test("geometry sanity enforces the Phase 3 manifest, bounds, support, and clean joins", () => {
  const expectedStructureIds = new Set(DESERT_CITADEL_PHASE3_MANIFEST.structureBlockIds);
  const expectedStairIds = new Set(
    DESERT_CITADEL_PHASE3_MANIFEST.stairFlightIds.flatMap((flightId) => {
      const flight = DESERT_CITADEL_STAIR_FLIGHTS.find((candidate) => candidate.id === flightId);
      return flight ? Array.from({ length: flight.steps }, (_, index) => `${flightId}-step-${index + 1}`) : [];
    })
  );
  const expectedBlockIds = new Set([...expectedStructureIds, ...expectedStairIds]);
  assert.equal(blocks.length, expectedBlockIds.size);
  assert.deepEqual(blocks.map((block) => block.id).filter((id) => !expectedBlockIds.has(id)), []);
  for (const id of expectedBlockIds) assert.ok(blocks.some((block) => block.id === id), `${id} is missing`);
  assert.deepEqual([...new Set(props.map((prop) => prop.id))].sort(), [...DESERT_CITADEL_PHASE3_MANIFEST.propIds].sort());
  assert.deepEqual([...new Set(cylinders.map((cylinder) => cylinder.id))].sort(), [...DESERT_CITADEL_PHASE3_MANIFEST.cylinderIds].sort());

  const bounds = getArenaBounds(MAP_ID);
  for (const block of blocks) {
    assert.ok([block.x, block.z, block.w, block.d, block.h, block.y ?? 0].every(Number.isFinite), `${block.id} has invalid geometry`);
    assert.ok(block.w > 0 && block.d > 0 && block.h > 0, `${block.id} has non-positive dimensions`);
    assert.ok(block.x - block.w / 2 >= -bounds.limitX - 0.01 && block.x + block.w / 2 <= bounds.limitX + 0.01, `${block.id} exceeds X bounds`);
    assert.ok(block.z - block.d / 2 >= -bounds.limitZ - 0.01 && block.z + block.d / 2 <= bounds.limitZ + 0.01, `${block.id} exceeds Z bounds`);
  }

  const colliders = blocks.filter((block) => block.collides);
  const yMin = (block: (typeof blocks)[number]) => (block.y ?? block.h / 2) - block.h / 2;
  const yMax = (block: (typeof blocks)[number]) => (block.y ?? block.h / 2) + block.h / 2;
  for (let first = 0; first < colliders.length; first += 1) {
    for (let second = first + 1; second < colliders.length; second += 1) {
      const left = colliders[first];
      const right = colliders[second];
      // Stair risers intentionally meet at their landing and can touch the
      // raised foundation they climb into; those contacts are solid joins,
      // not overlapping free-standing cover.
      if (left.style === "stair" || right.style === "stair") continue;
      const overlapX = Math.min(left.x + left.w / 2, right.x + right.w / 2) - Math.max(left.x - left.w / 2, right.x - right.w / 2);
      const overlapZ = Math.min(left.z + left.d / 2, right.z + right.d / 2) - Math.max(left.z - left.d / 2, right.z - right.d / 2);
      const overlapY = Math.min(yMax(left), yMax(right)) - Math.max(yMin(left), yMin(right));
      assert.ok(!(overlapX > 0.02 && overlapZ > 0.02 && overlapY > 0.02), `${left.id} overlaps ${right.id}`);
    }
  }

  const blockById = new Map(blocks.map((block) => [block.id, block]));
  const top = (id: string) => {
    const block = blockById.get(id)!;
    return (block.y ?? block.h / 2) + block.h / 2;
  };
  const bottom = (id: string) => {
    const block = blockById.get(id)!;
    return (block.y ?? block.h / 2) - block.h / 2;
  };
  assert.ok(Math.abs(top("royal-causeway-foundation") - bottom("royal-causeway-floor")) < 0.001);
  assert.ok(Math.abs(top("crown-rampart-foundation") - bottom("crown-rampart-floor")) < 0.001);
  assert.ok(Math.abs(top("falcon-obelisk") - bottom("falcon-obelisk-crown")) < 0.001);
  for (const prop of props.filter((candidate) => Number(candidate.y ?? 0) > 0)) {
    assert.equal(prop.y, DESERT_CITADEL_ROOFTOP_LEVEL_Y, `${prop.id} must sit on the Crown Rampart`);
    assert.deepEqual(getArenaFloorSurfaces(MAP_ID, prop.x, prop.z), [DESERT_CITADEL_ROOFTOP_LEVEL_Y]);
  }
});

test("lower, main, and upper surfaces have no accidental elevation recovery", () => {
  assert.deepEqual(getArenaFloorSurfaces(MAP_ID, 20 * ARENA_SCALE, -112 * ARENA_SCALE), [0]);
  assert.deepEqual(getArenaFloorSurfaces(MAP_ID, 0, 18 * ARENA_SCALE), [DESERT_CITADEL_MAIN_LEVEL_Y]);
  assert.deepEqual(getArenaFloorSurfaces(MAP_ID, 30 * ARENA_SCALE, -156 * ARENA_SCALE), [DESERT_CITADEL_ROOFTOP_LEVEL_Y]);
  assert.equal(getArenaLevelLabel(MAP_ID, 0), "lower");
  assert.equal(getArenaLevelLabel(MAP_ID, DESERT_CITADEL_MAIN_LEVEL_Y), "main");
  assert.equal(getArenaLevelLabel(MAP_ID, DESERT_CITADEL_ROOFTOP_LEVEL_Y), "upper");
  assert.equal(getArenaGroundHeightForPlayer(MAP_ID, 0, 18 * ARENA_SCALE, ARENA_PLAYER_EYE_HEIGHT), 0);
  assert.equal(getArenaGroundHeightForPlayer(MAP_ID, 30 * ARENA_SCALE, -156 * ARENA_SCALE, ARENA_PLAYER_EYE_HEIGHT), 0);
  assert.equal(
    getArenaGroundHeightForPlayer(MAP_ID, 0, 18 * ARENA_SCALE, DESERT_CITADEL_MAIN_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT),
    DESERT_CITADEL_MAIN_LEVEL_Y
  );
});

test("all ten stair flights climb continuously within the controller step limit", () => {
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
        1.4
      );
      assert.ok(next >= previous - 0.001, `${flight.id} drops at step ${index}`);
      assert.ok(next - previous <= 0.75 + 0.001, `${flight.id} exceeds the step limit`);
      previous = next;
    }
    assert.ok(Math.abs(previous - flight.endY) < 0.01, `${flight.id} misses its landing`);
  }
});

test("solid foundations reject shortcuts while all three spawn exits remain usable", () => {
  const obstacles = getArenaObstacles(MAP_ID);
  const foundationStart = { ...raw(0, 40), facing: 0 };
  const foundation = resolveAuthoritativeMovement({
    current: foundationStart,
    requested: { ...foundationStart, z: 30 * ARENA_SCALE },
    elapsedMs: 1000,
    maxSpeed: 20,
    obstacles,
    groundY: 0,
    mapId: MAP_ID
  });
  assert.equal(foundation.blocked, true);

  for (const z of [-53, 0, 53]) {
    const start = { ...raw(-212, z), facing: -Math.PI / 2 };
    const firstMove = resolveAuthoritativeMovement({
      current: start,
      requested: { ...start, x: -188 * ARENA_SCALE },
      elapsedMs: 2000,
      maxSpeed: 20,
      obstacles,
      groundY: 0,
      mapId: MAP_ID
    });
    assert.notEqual(firstMove.blocked, true, `Blue exit ${z} is blocked at the spawn screen`);
  }

  for (const x of [-228, 228]) {
    const start = { ...raw(x, -82), facing: 0 };
    const stairShortcut = resolveAuthoritativeMovement({
      current: start,
      requested: { ...start, z: -102 * ARENA_SCALE },
      elapsedMs: 1000,
      maxSpeed: 20,
      obstacles,
      groundY: 0,
      mapId: MAP_ID
    });
    assert.notEqual(stairShortcut.blocked, true, `${x < 0 ? "Blue" : "Red"} north stair access is blocked`);
  }
});

test("visual and authoritative collider footprints are identical", () => {
  const obstacles = new Map(getArenaObstacles(MAP_ID).map((obstacle) => [obstacle.id, obstacle]));
  for (const block of blocks.filter((candidate) => candidate.collides)) {
    const obstacle = obstacles.get(block.id);
    assert.ok(obstacle && obstacle.kind === "rect", `${block.id} lacks an authoritative rectangle`);
    if (!obstacle || obstacle.kind !== "rect") continue;
    assert.ok(Math.abs(obstacle.x - block.x) < 0.011, `${block.id} x mismatch`);
    assert.ok(Math.abs(obstacle.z - block.z) < 0.011, `${block.id} z mismatch`);
    assert.ok(Math.abs(obstacle.width - block.w) < 0.011, `${block.id} width mismatch`);
    assert.ok(Math.abs(obstacle.depth - block.d) < 0.011, `${block.id} depth mismatch`);
  }
  for (const cylinder of cylinders.filter((candidate) => candidate.collides)) {
    const obstacle = obstacles.get(cylinder.id);
    assert.ok(obstacle && obstacle.kind === "circle", `${cylinder.id} lacks an authoritative circle`);
    if (!obstacle || obstacle.kind !== "circle") continue;
    assert.ok(Math.abs(obstacle.x - cylinder.x) < 0.011);
    assert.ok(Math.abs(obstacle.z - cylinder.z) < 0.011);
    assert.ok(Math.abs(obstacle.radius - cylinder.radius) < 0.011);
  }
});

test("twenty-player spawn waves are clear, protected, and evenly spaced", () => {
  const spawns = getTeamSpawnsForMap(MAP_ID);
  const obstacles = getArenaObstacles(MAP_ID);
  assert.equal(spawns.blue.length, 20);
  assert.equal(spawns.red.length, 20);
  for (const team of [spawns.blue, spawns.red]) {
    assert.equal(new Set(team.map((spawn) => `${spawn.x}:${spawn.z}`)).size, 20);
    for (let first = 0; first < team.length; first += 1) {
      for (let second = first + 1; second < team.length; second += 1) {
        assert.ok(Math.hypot(team[first].x - team[second].x, team[first].z - team[second].z) >= 5.5, "spawn wave is too tightly packed");
      }
    }
  }
  for (const spawn of [...spawns.blue, ...spawns.red]) {
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

test("FFA spawns and redistributed objectives start on their authored levels", () => {
  assert.equal(FREE_FOR_ALL_SPAWNS.length, 60);
  const obstacles = getArenaObstacles(MAP_ID);
  for (const spawn of FREE_FOR_ALL_SPAWNS) {
    const requested = { ...spawn, x: spawn.x + 0.05, z: spawn.z + 0.05 };
    const movement = resolveAuthoritativeMovement({ current: spawn, requested, elapsedMs: 100, maxSpeed: 1, obstacles, mapId: MAP_ID });
    assert.notEqual(movement.blocked, true, `${spawn.id} starts blocked`);
  }
  for (const objective of [...getCaptureZonesForMap(MAP_ID), ...getSearchRetrieveItemsForMap(MAP_ID)]) {
    const surfaces = getArenaFloorSurfaces(MAP_ID, objective.x, objective.z);
    const expectedGround = "radius" in objective ? objective.y : Number(objective.y) - 1.4;
    assert.ok(surfaces.some((surface) => Math.abs(surface - expectedGround) < 0.01), `${objective.id} is not on an authored floor`);
  }
});

test("bots can reach all lanes, gate courts, and the four-entry Crown Rampart", () => {
  const obstacles = getArenaObstacles(MAP_ID);
  const start = getTeamSpawnsForMap(MAP_ID).blue[10];
  const goals = [
    ["Shaded Souk", raw(20, -112)],
    ["Royal Causeway", raw(0, 18, DESERT_CITADEL_MAIN_LEVEL_Y)],
    ["Dry Cistern", raw(24, 120)],
    ["West Gate Court", raw(-172, 80)],
    ["East Gate Court", raw(172, 80)],
    ["Crown Rampart", raw(30, -156, DESERT_CITADEL_ROOFTOP_LEVEL_Y)]
  ] as const;
  for (const [label, goal] of goals) {
    const path = findBotNavigationPath({ from: start, to: goal, obstacles, mapId: MAP_ID });
    assert.ok(path.length > 0, `${label} has no bot path`);
    assert.ok(Math.abs(Number(path.at(-1)?.y) - goal.y) < 0.1, `${label} ends on the wrong level`);
  }
  const crossing = findBotNavigationPath({
    from: raw(-150, -156, DESERT_CITADEL_ROOFTOP_LEVEL_Y),
    to: raw(150, -156, DESERT_CITADEL_ROOFTOP_LEVEL_Y),
    obstacles,
    mapId: MAP_ID
  });
  assert.ok(crossing.length > 0, "Crown Rampart cannot rotate end to end");
});

test("mirrored opening routes stay within the 20v20 timing and fairness envelope", () => {
  const obstacles = getArenaObstacles(MAP_ID);
  const spawns = getTeamSpawnsForMap(MAP_ID);
  const goals = [raw(20, -112), raw(0, 18, DESERT_CITADEL_MAIN_LEVEL_Y), raw(0, 150)];
  const starts = { blue: spawns.blue[10], red: spawns.red[10] };
  const distances = (team: "blue" | "red") => goals.map((goal) => {
    const path = findBotNavigationPath({ from: starts[team], to: goal, obstacles, mapId: MAP_ID });
    assert.ok(path.length > 0, `${team} cannot enter a primary lane`);
    return pathLength(starts[team], path);
  });
  const blue = distances("blue");
  const red = distances("red");
  blue.forEach((distance, index) => {
    const average = (distance + red[index]) / 2;
    assert.ok(Math.abs(distance - red[index]) / average < 0.15, `lane ${index} is more than 15% asymmetric`);
    assert.ok(distance / 14.8 > 7 && distance / 14.8 < 18, `Blue lane ${index} timing is outside 7–18 seconds`);
    assert.ok(red[index] / 14.8 > 7 && red[index] / 14.8 < 18, `Red lane ${index} timing is outside 7–18 seconds`);
  });
});

test("forty opening players can split 6/7/5/2 per team across four fronts", () => {
  const obstacles = getArenaObstacles(MAP_ID);
  const spawns = getTeamSpawnsForMap(MAP_ID);
  const goals = [
    raw(20, -112),
    raw(0, 18, DESERT_CITADEL_MAIN_LEVEL_Y),
    raw(0, 150),
    raw(30, -156, DESERT_CITADEL_ROOFTOP_LEVEL_Y)
  ];
  const assignments = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3];
  const counts = [0, 0, 0, 0];
  for (const team of ["blue", "red"] as const) {
    spawns[team].forEach((spawn, index) => {
      const front = assignments[index];
      counts[front] += 1;
      const path = findBotNavigationPath({ from: spawn, to: goals[front], obstacles, mapId: MAP_ID });
      assert.ok(path.length > 0, `${team} player ${index + 1} cannot reach front ${front}`);
    });
  }
  assert.deepEqual(counts, [12, 14, 10, 4]);
});
