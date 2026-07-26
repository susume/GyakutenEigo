import assert from "node:assert/strict";
import test from "node:test";
import {
  ARENA_PLAYER_EYE_HEIGHT,
  ARENA_SCALE,
  DESERT_CITADEL_MAIN_LEVEL_Y,
  DESERT_CITADEL_ROOFTOP_LEVEL_Y,
  findBotNavigationPath,
  getArenaBounds,
  getArenaFloorSurfaces,
  getArenaGroundHeightForPlayer,
  getArenaObstacles,
  getTeamSpawnsForMap,
  hasLineOfSight
} from "@quizstrike/shared";
import { DESERT_CITADEL, blocks, cylinders, floorMarks, props, signs } from "./desertCitadelMap.js";

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

test("Desert Citadel expands the playable footprint without scaling prop clutter", () => {
  assert.deepEqual(DESERT_CITADEL.footprint, {
    width: 500 * ARENA_SCALE,
    depth: 360 * ARENA_SCALE
  });
  assert.deepEqual(getArenaBounds("desert_citadel"), {
    limitX: 250 * ARENA_SCALE,
    limitZ: 180 * ARENA_SCALE
  });
  assert.ok(blocks.length >= 90, "architecture should define the city before props");
  assert.ok(props.length <= 32, "small decoration must remain deliberately sparse");
  assert.ok(props.filter((prop) => prop.kind === "crate").length <= 1);
  assert.ok(cylinders.length <= 10);
  assert.ok(floorMarks.some((mark) => mark.label.includes("AQUEDUCT")));
  assert.ok(signs.some((sign) => sign.label.includes("Grand Bazaar")));
});

test("Desert Citadel limits stacked floors to deliberate terrace and lookout footprints", () => {
  const groundX = -140 * ARENA_SCALE;
  const groundZ = 0;
  const terraceX = 0;
  const terraceZ = 0;
  const roofX = -105 * ARENA_SCALE;
  const roofZ = 76 * ARENA_SCALE;
  assert.deepEqual(getArenaFloorSurfaces("desert_citadel", groundX, groundZ), [0]);
  assert.deepEqual(
    getArenaFloorSurfaces("desert_citadel", terraceX, terraceZ),
    [0, DESERT_CITADEL_MAIN_LEVEL_Y]
  );
  assert.deepEqual(
    getArenaFloorSurfaces("desert_citadel", roofX, roofZ),
    [0, DESERT_CITADEL_ROOFTOP_LEVEL_Y]
  );
  assert.equal(
    getArenaGroundHeightForPlayer("desert_citadel", groundX, groundZ, ARENA_PLAYER_EYE_HEIGHT),
    0
  );
  assert.equal(
    getArenaGroundHeightForPlayer(
      "desert_citadel",
      terraceX,
      terraceZ,
      DESERT_CITADEL_MAIN_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT
    ),
    DESERT_CITADEL_MAIN_LEVEL_Y
  );
  assert.equal(
    getArenaGroundHeightForPlayer(
      "desert_citadel",
      roofX,
      roofZ,
      DESERT_CITADEL_ROOFTOP_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT
    ),
    DESERT_CITADEL_ROOFTOP_LEVEL_Y
  );
});

test("Desert Citadel stair flights connect ground, citadel, and lookout levels continuously", () => {
  const groundAt = (rawX: number, rawZ: number, footY: number) =>
    getArenaGroundHeightForPlayer(
      "desert_citadel",
      rawX * ARENA_SCALE,
      rawZ * ARENA_SCALE,
      footY + ARENA_PLAYER_EYE_HEIGHT,
      ARENA_PLAYER_EYE_HEIGHT,
      2.5
    );
  assert.equal(groundAt(-106, 0, 0), 0);
  assert.ok(groundAt(-86, 0, 5) > 4.9 && groundAt(-86, 0, 5) < 5.1);
  assert.equal(groundAt(-66, 0, DESERT_CITADEL_MAIN_LEVEL_Y), DESERT_CITADEL_MAIN_LEVEL_Y);
  assert.equal(groundAt(-216, 76, 0), 0);
  assert.ok(groundAt(-181, 76, 12) > 11.9 && groundAt(-181, 76, 12) < 12.1);
  assert.equal(groundAt(-146, 76, DESERT_CITADEL_ROOFTOP_LEVEL_Y), DESERT_CITADEL_ROOFTOP_LEVEL_Y);
});

test("Desert Citadel provides 20 clear, protected spawns per team", () => {
  const spawns = getTeamSpawnsForMap("desert_citadel");
  const obstacles = getArenaObstacles("desert_citadel");
  assert.equal(spawns.blue.length, 20);
  assert.equal(spawns.red.length, 20);
  assert.equal(new Set(spawns.blue.map((spawn) => `${spawn.x}:${spawn.z}`)).size, 20);
  assert.equal(new Set(spawns.red.map((spawn) => `${spawn.x}:${spawn.z}`)).size, 20);
  for (const spawn of [...spawns.blue, ...spawns.red]) {
    assert.equal(spawn.y, ARENA_PLAYER_EYE_HEIGHT);
    const overlaps = obstacles.filter((obstacle) => {
      if ((obstacle.minY ?? -Infinity) > 0.1) return false;
      if ((obstacle.maxY ?? Infinity) < 0) return false;
      if (obstacle.kind === "circle") return Math.hypot(spawn.x - obstacle.x, spawn.z - obstacle.z) <= obstacle.radius + 0.45;
      return spawn.x >= obstacle.x - obstacle.width / 2 - 0.45
        && spawn.x <= obstacle.x + obstacle.width / 2 + 0.45
        && spawn.z >= obstacle.z - obstacle.depth / 2 - 0.45
        && spawn.z <= obstacle.z + obstacle.depth / 2 + 0.45;
    });
    assert.deepEqual(overlaps, [], `${spawn.id} overlaps collision`);
  }
  const blueEye = spawns.blue[0];
  const redEye = spawns.red[0];
  assert.equal(hasLineOfSight({ from: blueEye, to: redEye, obstacles, padding: 0 }), false);
});

test("Desert Citadel bot navigation reaches all four route families and the rooftop layer", () => {
  const obstacles = getArenaObstacles("desert_citadel");
  const start = getTeamSpawnsForMap("desert_citadel").blue[0];
  const goals = [
    ["courtyard", { x: 0, y: DESERT_CITADEL_MAIN_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT, z: 0 }],
    ["bazaar", { x: -76 * ARENA_SCALE, y: ARENA_PLAYER_EYE_HEIGHT, z: 78 * ARENA_SCALE }],
    ["outer ruins", { x: -100 * ARENA_SCALE, y: ARENA_PLAYER_EYE_HEIGHT, z: -118 * ARENA_SCALE }],
    ["canal", { x: -174 * ARENA_SCALE, y: ARENA_PLAYER_EYE_HEIGHT, z: 133 * ARENA_SCALE }],
    ["rooftop", { x: -116 * ARENA_SCALE, y: DESERT_CITADEL_ROOFTOP_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT, z: 76 * ARENA_SCALE }]
  ] as const;
  for (const [label, goal] of goals) {
    const path = findBotNavigationPath({ from: start, to: goal, obstacles, mapId: "desert_citadel" });
    assert.ok(path.length > 0, `${label} should have a navigation path`);
    assert.ok(Math.abs(Number(path.at(-1)?.y) - goal.y) < 0.1, `${label} should finish on the requested level`);
  }
});

test("Desert Citadel route timings match the 40-player movement targets", () => {
  const obstacles = getArenaObstacles("desert_citadel");
  const blue = getTeamSpawnsForMap("desert_citadel").blue[0];
  const redObjective = {
    x: 235 * ARENA_SCALE,
    y: ARENA_PLAYER_EYE_HEIGHT,
    z: -58 * ARENA_SCALE
  };
  const courtyard = { x: 0, y: DESERT_CITADEL_MAIN_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT, z: 0 };
  const toCourt = findBotNavigationPath({ from: blue, to: courtyard, obstacles, mapId: "desert_citadel" });
  const toObjective = findBotNavigationPath({ from: blue, to: redObjective, obstacles, mapId: "desert_citadel" });
  const courtWalkSeconds = pathLength(blue, toCourt) / 10.8;
  const objectiveSprintSeconds = pathLength(blue, toObjective) / 14.8;
  assert.ok(courtWalkSeconds >= 12 && courtWalkSeconds <= 18, `spawn to courtyard was ${courtWalkSeconds.toFixed(1)}s`);
  assert.ok(objectiveSprintSeconds >= 19.5 && objectiveSprintSeconds <= 30, `fast objective route was ${objectiveSprintSeconds.toFixed(1)}s`);
});

test("40-player opening flow distributes evenly across five route choices", () => {
  const obstacles = getArenaObstacles("desert_citadel");
  const spawns = getTeamSpawnsForMap("desert_citadel");
  const laneCounts = new Map<string, number>();
  const routesFor = (team: "blue" | "red") => {
    const direction = team === "blue" ? 1 : -1;
    return [
      ["main", { x: direction * -108 * ARENA_SCALE, y: ARENA_PLAYER_EYE_HEIGHT, z: 0 }],
      ["bazaar", { x: -76 * ARENA_SCALE, y: ARENA_PLAYER_EYE_HEIGHT, z: 78 * ARENA_SCALE }],
      ["ruins", { x: direction * -108 * ARENA_SCALE, y: ARENA_PLAYER_EYE_HEIGHT, z: -118 * ARENA_SCALE }],
      ["canal", { x: direction * -174 * ARENA_SCALE, y: ARENA_PLAYER_EYE_HEIGHT, z: 133 * ARENA_SCALE }],
      ["upper", {
        x: (team === "blue" ? -116 : 90) * ARENA_SCALE,
        y: DESERT_CITADEL_ROOFTOP_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT,
        z: (team === "blue" ? 76 : 70) * ARENA_SCALE
      }]
    ] as const;
  };

  for (const team of ["blue", "red"] as const) {
    const routes = routesFor(team);
    for (const [index, spawn] of spawns[team].entries()) {
      const [lane, goal] = routes[index % routes.length];
      laneCounts.set(lane, (laneCounts.get(lane) ?? 0) + 1);
      const path = findBotNavigationPath({ from: spawn, to: goal, obstacles, mapId: "desert_citadel" });
      assert.ok(path.length > 0, `${team} player ${index + 1} could not enter ${lane}`);
    }
  }

  assert.deepEqual(Object.fromEntries(laneCounts), {
    main: 8,
    bazaar: 8,
    ruins: 8,
    canal: 8,
    upper: 8
  });
});
